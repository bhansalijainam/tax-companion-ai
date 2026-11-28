/**
 * Client upload links (M3): limits, accepted files, and what the client's page may see.
 * Shared by the server (enforcement) and the browser (early, friendly errors).
 */
import { evaluateChecklist, type ItemStatus } from './checklist.js';
import { DOC_KINDS, type CaseFile, type DocKind } from './types.js';

export const LINK_TTL_DAYS = 14;
/** Vercel functions accept request bodies up to 4.5 MB */
export const MAX_FILE_BYTES = 4_000_000;
export const MAX_FILES_PER_LINK = 40;
export const MAX_BYTES_PER_LINK = 60_000_000;
/** Matches the case schema (server/caseSchema.ts): document text and audit trail caps */
export const MAX_TEXT_CHARS = 400_000;
export const MAX_AUDIT_ENTRIES = 20_000;

export const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG photo',
  'image/png': 'PNG image',
  'image/webp': 'WebP image',
  'text/plain': 'Text file',
  'text/csv': 'CSV file',
};
export const ACCEPT_ATTR = Object.keys(ACCEPTED_TYPES).join(',') + ',.pdf,.jpg,.jpeg,.png,.webp,.txt,.csv';

const EXT_TYPE: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', txt: 'text/plain', csv: 'text/csv' };

/** Browsers sometimes send an empty or generic type; fall back to the extension. */
export function normaliseMime(type: string, name: string): string | null {
  const t = type.split(';')[0].trim().toLowerCase();
  if (ACCEPTED_TYPES[t]) return t;
  const ext = name.toLowerCase().split('.').pop() ?? '';
  return t === '' || t === 'application/octet-stream' ? EXT_TYPE[ext] ?? null : null;
}

/** Magic bytes, so a renamed executable can't be stored as a "PDF" */
export function contentMatchesType(bytes: Uint8Array, mime: string): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  switch (mime) {
    case 'application/pdf': return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case 'image/jpeg': return starts(0xff, 0xd8, 0xff);
    case 'image/png': return starts(0x89, 0x50, 0x4e, 0x47);
    case 'image/webp': return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    case 'text/plain':
    case 'text/csv': return !bytes.subarray(0, 4096).includes(0); // no NUL bytes in text
    default: return false;
  }
}

/** File names are shown back to the CA; keep them printable and short. */
export function safeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const cleaned = name.replace(/[\\/]/g, '_').replace(/[\u0000-\u001f\u007f<>"`]/g, '').trim().slice(-200);
  return cleaned || 'document';
}

export const isDocKind = (k: unknown): k is DocKind => typeof k === 'string' && (DOC_KINDS as string[]).includes(k);

/** Everything the public upload page shows. No PAN, no amounts, no other documents. */
export interface UploadRequestView {
  firmName: string;
  clientFirstName: string;
  fy: string;
  expiresAt: string;
  closed: boolean;
  items: { id: string; kind: DocKind; label: string; why: string; status: ItemStatus; optional?: boolean; note?: string }[];
  uploaded: { name: string; at: string; kind: DocKind }[];
}

export function uploadRequestView(c: CaseFile, opts: { firmName: string; expiresAt: string; closed: boolean }): UploadRequestView {
  const ch = evaluateChecklist(c);
  return {
    firmName: opts.firmName,
    clientFirstName: c.client.name.trim().split(/\s+/)[0] || 'there',
    fy: c.client.fy,
    expiresAt: opts.expiresAt,
    closed: opts.closed,
    items: ch.items.map(({ id, kind, label, why, status, optional, note }) => ({ id, kind, label, why, status, optional, note: status === 'missing' ? note : undefined })),
    uploaded: c.documents.filter((d) => d.source === 'client').map((d) => ({ name: d.name, at: d.uploadedAt ?? '', kind: d.kind })),
  };
}
