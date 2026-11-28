/**
 * Where a case file lives. The demo keeps today's browser storage; a signed-in firm
 * uses the server, with optimistic concurrency so two preparers can't silently
 * overwrite each other.
 */
import { buildSampleCase } from '../ai/pipeline';
import type { CaseFile } from '../domain/types';

export type CaseStatus = 'draft' | 'in_review' | 'final';
export type Role = 'partner' | 'preparer';

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'conflict' | 'locked' | 'error'; message: string };

export interface LoadedCase {
  data: CaseFile;
  status?: CaseStatus;
  role?: Role;
}

export interface UploadLinkInfo { url: string; expiresAt: string; }
export interface UploadLinkStatus { active: number; files: number; latestExpiresAt?: string; }

/** Client upload links (M3). The plaintext link exists only in the response that creates it. */
export interface UploadLinkApi {
  create(): Promise<UploadLinkInfo>;
  status(): Promise<UploadLinkStatus>;
  revokeAll(): Promise<number>;
}

export interface CaseStore {
  readonly kind: 'local' | 'api';
  /** Synchronous first value, if available without a network round trip */
  initial(): CaseFile | null;
  load(): Promise<LoadedCase>;
  save(data: CaseFile): Promise<SaveResult>;
  setStatus?(status: CaseStatus): Promise<SaveResult & { status?: CaseStatus }>;
  uploadLinks?: UploadLinkApi;
  /** base64 of a client-uploaded file kept on the server, for extraction */
  fetchFile?(docId: string): Promise<string>;
}

const STORAGE_KEY = 'tax-companion:case:v1';
const withoutBinaries = (c: CaseFile): CaseFile => ({ ...c, documents: c.documents.map(({ base64: _b, ...d }) => d) });

export class LocalCaseStore implements CaseStore {
  readonly kind = 'local';
  initial(): CaseFile {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as CaseFile;
    } catch {
      /* fall through to the sample case */
    }
    return buildSampleCase();
  }
  async load(): Promise<LoadedCase> {
    return { data: this.initial() };
  }
  async save(data: CaseFile): Promise<SaveResult> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutBinaries(data)));
    } catch {
      /* storage full or unavailable: state still works in memory */
    }
    return { ok: true };
  }
}

export class ApiCaseStore implements CaseStore {
  readonly kind = 'api';
  private version = 0;

  constructor(readonly caseId: string, private fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {}

  initial(): null {
    return null;
  }

  async load(): Promise<LoadedCase> {
    const res = await this.fetchImpl(`/api/cases/${encodeURIComponent(this.caseId)}`, { credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Could not load the case (${res.status})`);
    this.version = body.version;
    return { data: body.data, status: body.status, role: body.role };
  }

  async save(data: CaseFile): Promise<SaveResult> {
    try {
      const res = await this.fetchImpl(`/api/cases/${encodeURIComponent(this.caseId)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: this.version, data: withoutBinaries(data) }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        this.version = body.version;
        return { ok: true };
      }
      if (res.status === 409) return { ok: false, reason: body.code === 'locked' ? 'locked' : 'conflict', message: body.error };
      return { ok: false, reason: 'error', message: body.error ?? `Save failed (${res.status})` };
    } catch {
      return { ok: false, reason: 'error', message: 'Could not reach the server. Your changes are kept on this page.' };
    }
  }

  readonly uploadLinks: UploadLinkApi = {
    create: async () => {
      const body = await this.call('upload-links', { method: 'POST' });
      return { url: `${location.origin}/u/${body.token}`, expiresAt: body.expiresAt };
    },
    status: async () => {
      const { links } = (await this.call('upload-links')) as { links: { expires_at: string; revoked_at: string | null; file_count: number }[] };
      const active = links.filter((l) => !l.revoked_at && new Date(l.expires_at) > new Date());
      return { active: active.length, files: links.reduce((n, l) => n + l.file_count, 0), latestExpiresAt: active[0]?.expires_at };
    },
    revokeAll: async () => (await this.call('upload-links', { method: 'DELETE' })).revoked,
  };

  async fetchFile(docId: string): Promise<string> {
    const res = await this.fetchImpl(`/api/cases/${encodeURIComponent(this.caseId)}/files/${encodeURIComponent(docId)}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Could not fetch the client's file (${res.status})`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  private async call(sub: string, init: RequestInit = {}) {
    const res = await this.fetchImpl(`/api/cases/${encodeURIComponent(this.caseId)}/${sub}`, { credentials: 'include', ...init });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
    return body;
  }

  async setStatus(status: CaseStatus) {
    const res = await this.fetchImpl(`/api/cases/${encodeURIComponent(this.caseId)}/status`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false as const, reason: 'error' as const, message: body.error ?? 'Could not change the status' };
    this.version = body.version;
    return { ok: true as const, status: body.status as CaseStatus };
  }
}
