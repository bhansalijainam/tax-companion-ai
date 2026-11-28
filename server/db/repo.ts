/**
 * The only module that reads or writes workspace tables.
 *
 * Every method takes `firmId` first, and every query filters on it. The firm id
 * comes from the signed-in session (server/auth.ts), never from the request body.
 * Another firm's rows are reported as NotFound, so ids can't be probed.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { applyExtraction } from '../../src/ai/pipeline.js';
import { detectKind, rulesExtract } from '../../src/ai/extraction/rulesExtractor.js';
import { DOC_KIND_LABEL, type CaseDocument, type DocKind } from '../../src/domain/types.js';
import { LINK_TTL_DAYS, MAX_AUDIT_ENTRIES, MAX_BYTES_PER_LINK, MAX_FILES_PER_LINK, MAX_TEXT_CHARS, uploadRequestView, type UploadRequestView } from '../../src/domain/upload.js';
import type { CaseFile } from '../../src/domain/types.js';
import { evaluateChecklist, summarizeChecklist, applyStatus, type ChecklistSummary } from '../../src/domain/checklist.js';

export class NotFoundError extends Error { constructor() { super('Not found'); this.name = 'NotFoundError'; } }
export class ConflictError extends Error { constructor() { super('This case was changed by someone else. Reload to see the latest version.'); this.name = 'ConflictError'; } }
export class LockedError extends Error { constructor() { super('This case is final. A partner must reopen it before it can be edited.'); this.name = 'LockedError'; } }
export class ForbiddenError extends Error { constructor(msg: string) { super(msg); this.name = 'ForbiddenError'; } }
export class ValidationError extends Error { constructor(msg: string) { super(msg); this.name = 'ValidationError'; } }
/** An upload link that is unknown, expired or revoked. Deliberately one message for all three. */
export class GoneError extends Error { constructor() { super('This upload link has expired or was turned off. Ask your CA to send a new one.'); this.name = 'GoneError'; } }

export interface UploadLinkRow { id: string; created_at: string; expires_at: string; revoked_at: string | null; file_count: number; }
export interface ClientFile { name: string; mime: string; bytes: Buffer; kind?: DocKind; }

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
/** Shape check only; says nothing about whether the link exists */
export const isTokenShaped = (token: string) => TOKEN_RE.test(token);
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export type Role = 'partner' | 'preparer';
export type CaseStatus = 'draft' | 'in_review' | 'final';

export interface ClientRow { id: string; name: string; pan: string | null; created_at: string; }
export interface ClientListItem extends ClientRow { case_id: string | null; fy: string | null; status: CaseStatus | null; updated_at: string | null; summary: ChecklistSummary | null; }
export interface CaseRow { id: string; client_id: string; fy: string; status: CaseStatus; version: number; data: CaseFile; updated_by: string; updated_at: string; }
export interface AuditRow { id: string; actor_user_id: string | null; actor_kind: string; action: string; detail: string; at: string; }

/** Binary payloads never go into the case document. */
const stripBinaries = (c: CaseFile): CaseFile => ({ ...c, documents: c.documents.map(({ base64: _b, ...d }) => d) });
/** Status-independent checklist summary; "filed" is applied at read time from the case status. */
const summaryOf = (c: CaseFile): ChecklistSummary => summarizeChecklist(evaluateChecklist(c));

export class Repo {
  constructor(private pool: Pool) {}

  private async tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('begin');
      const out = await fn(c);
      await c.query('commit');
      return out;
    } catch (e) {
      await c.query('rollback');
      throw e;
    } finally {
      c.release();
    }
  }

  async listClients(firmId: string, search?: string): Promise<ClientListItem[]> {
    const { rows } = await this.pool.query<ClientListItem>(
      `select cl.id, cl.name, cl.pan, cl.created_at,
              cs.id as case_id, cs.fy, cs.status, cs.updated_at, cs.summary
         from clients cl
         left join lateral (
           select id, fy, status, updated_at, summary from cases
            where cases.client_id = cl.id and cases.firm_id = $1
            order by fy desc limit 1
         ) cs on true
        where cl.firm_id = $1 and ($2::text is null or cl.name ilike '%' || $2 || '%')
        order by coalesce(cs.updated_at, cl.created_at) desc
        limit 500`,
      [firmId, search?.trim() || null],
    );
    // Backfill summaries for cases saved before M2 (one-off per case)
    const stale = rows.filter((r) => r.case_id && !r.summary);
    if (stale.length) {
      const { rows: cases } = await this.pool.query<{ id: string; data: CaseFile }>(
        `select id, data from cases where firm_id = $1 and id = any($2::uuid[])`, [firmId, stale.map((r) => r.case_id)],
      );
      for (const cs of cases) {
        const summary = summaryOf(cs.data);
        await this.pool.query(`update cases set summary = $1 where id = $2 and firm_id = $3`, [summary, cs.id, firmId]);
        for (const r of stale) if (r.case_id === cs.id) r.summary = summary;
      }
    }
    return rows.map((r) => (r.summary ? { ...r, summary: applyStatus(r.summary, r.status) } : r));
  }

  async createClient(
    firmId: string, userId: string,
    input: { name: string; pan?: string | null; fy: string; phone?: string; profile?: CaseFile['profile'] },
    initial: CaseFile,
  ): Promise<{ client: ClientRow; caseId: string }> {
    return this.tx(async (c) => {
      const { rows: [client] } = await c.query<ClientRow>(
        `insert into clients (firm_id, name, pan, created_by) values ($1, $2, $3, $4)
         returning id, name, pan, created_at`,
        [firmId, input.name, input.pan || null, userId],
      );
      const data: CaseFile = stripBinaries({
        ...initial,
        client: { ...initial.client, name: input.name, pan: input.pan || '', fy: input.fy, ay: nextAy(input.fy), ...(input.phone ? { phone: input.phone } : {}) },
        ...(input.profile ? { profile: input.profile } : {}),
        audit: [],
      });
      const { rows: [cs] } = await c.query<{ id: string }>(
        `insert into cases (firm_id, client_id, fy, data, updated_by, summary) values ($1, $2, $3, $4, $5, $6) returning id`,
        [firmId, client.id, input.fy, data, userId, summaryOf(data)],
      );
      await c.query(
        `insert into audit_events (firm_id, case_id, actor_user_id, actor_kind, action, detail) values ($1, $2, $3, 'ca', 'case.created', $4)`,
        [firmId, cs.id, userId, `${input.name}, FY ${input.fy}`],
      );
      return { client, caseId: cs.id };
    });
  }

  async getCase(firmId: string, caseId: string): Promise<CaseRow> {
    if (!isUuid(caseId)) throw new NotFoundError();
    const { rows } = await this.pool.query<CaseRow>(
      `select id, client_id, fy, status, version, data, updated_by, updated_at from cases where id = $1 and firm_id = $2`,
      [caseId, firmId],
    );
    if (!rows[0]) throw new NotFoundError();
    return rows[0];
  }

  /**
   * Optimistic concurrency: succeeds only if the stored version is `expectedVersion`.
   * Audit history in `data` must extend the stored history; new entries are copied to
   * audit_events, attributed to the signed-in user.
   */
  async saveCase(firmId: string, caseId: string, userId: string, expectedVersion: number, data: CaseFile): Promise<number> {
    if (!isUuid(caseId)) throw new NotFoundError();
    return this.tx(async (c) => {
      const { rows: [cur] } = await c.query<{ version: number; status: CaseStatus; data: CaseFile }>(
        `select version, status, data from cases where id = $1 and firm_id = $2 for update`,
        [caseId, firmId],
      );
      if (!cur) throw new NotFoundError();
      if (cur.status === 'final') throw new LockedError();
      if (cur.version !== expectedVersion) throw new ConflictError();

      const before = cur.data.audit ?? [];
      const after = data.audit ?? [];
      if (after.slice(before.length).some((e) => e.actor === 'client')) {
        throw new ValidationError('Client events are recorded by the server only.');
      }
      const prefixIntact = after.length >= before.length && before.every((e, i) => JSON.stringify(e) === JSON.stringify(after[i]));
      if (!prefixIntact) throw new ValidationError('The audit history in this save does not match the stored history.');

      const next = cur.version + 1;
      await c.query(
        `update cases set data = $1, version = $2, updated_by = $3, updated_at = now(), summary = $6 where id = $4 and firm_id = $5`,
        [stripBinaries(data), next, userId, caseId, firmId, summaryOf(data)],
      );
      // Files whose document the CA removed are deleted too (data minimisation)
      await c.query(
        `delete from case_files where case_id = $1 and firm_id = $2 and not (doc_id = any($3::text[]))`,
        [caseId, firmId, data.documents.map((d) => d.id)],
      );
      for (const e of after.slice(before.length)) {
        await c.query(
          `insert into audit_events (firm_id, case_id, actor_user_id, actor_kind, action, detail) values ($1, $2, $3, $4, $5, $6)`,
          [firmId, caseId, e.actor === 'ca' ? userId : null, e.actor, e.action.slice(0, 100), e.detail.slice(0, 2000)],
        );
      }
      return next;
    });
  }

  async setStatus(firmId: string, caseId: string, userId: string, role: Role, status: CaseStatus): Promise<void> {
    if (!isUuid(caseId)) throw new NotFoundError();
    await this.tx(async (c) => {
      const { rows: [cur] } = await c.query<{ status: CaseStatus }>(
        `select status from cases where id = $1 and firm_id = $2 for update`, [caseId, firmId],
      );
      if (!cur) throw new NotFoundError();
      const finalising = status === 'final';
      const reopening = cur.status === 'final' && status !== 'final';
      if ((finalising || reopening) && role !== 'partner') {
        throw new ForbiddenError('Only a partner can finalise or reopen a case.');
      }
      if (cur.status === status) return;
      await c.query(`update cases set status = $1, updated_by = $2, updated_at = now() where id = $3 and firm_id = $4`, [status, userId, caseId, firmId]);
      const action = finalising ? 'case.final' : reopening ? 'case.reopened' : `case.${status}`;
      await c.query(
        `insert into audit_events (firm_id, case_id, actor_user_id, actor_kind, action, detail) values ($1, $2, $3, 'ca', $4, $5)`,
        [firmId, caseId, userId, action, `${cur.status} → ${status}`],
      );
    });
  }

  // ---- Client upload links (M3) ----

  async createUploadLink(firmId: string, caseId: string, userId: string): Promise<{ id: string; token: string; expiresAt: string }> {
    const cs = await this.getCase(firmId, caseId);
    if (cs.status === 'final') throw new LockedError();
    const token = randomBytes(32).toString('base64url');
    return this.tx(async (c) => {
      const { rows: [link] } = await c.query<{ id: string; expires_at: Date }>(
        `insert into upload_links (firm_id, case_id, token_hash, created_by, expires_at)
         values ($1, $2, $3, $4, now() + make_interval(days => $5)) returning id, expires_at`,
        [firmId, caseId, hashToken(token), userId, LINK_TTL_DAYS],
      );
      await c.query(
        `insert into audit_events (firm_id, case_id, actor_user_id, actor_kind, action, detail) values ($1, $2, $3, 'ca', 'upload_link.created', $4)`,
        [firmId, caseId, userId, `Expires ${link.expires_at.toISOString().slice(0, 10)}`],
      );
      return { id: link.id, token, expiresAt: link.expires_at.toISOString() };
    });
  }

  async listUploadLinks(firmId: string, caseId: string): Promise<UploadLinkRow[]> {
    await this.getCase(firmId, caseId);
    const { rows } = await this.pool.query<UploadLinkRow>(
      `select id, created_at, expires_at, revoked_at, file_count from upload_links
        where firm_id = $1 and case_id = $2 order by created_at desc limit 50`,
      [firmId, caseId],
    );
    return rows;
  }

  async revokeUploadLinks(firmId: string, caseId: string, userId: string): Promise<number> {
    await this.getCase(firmId, caseId);
    return this.tx(async (c) => {
      const { rowCount } = await c.query(
        `update upload_links set revoked_at = now() where firm_id = $1 and case_id = $2 and revoked_at is null and expires_at > now()`,
        [firmId, caseId],
      );
      if (rowCount) {
        await c.query(
          `insert into audit_events (firm_id, case_id, actor_user_id, actor_kind, action, detail) values ($1, $2, $3, 'ca', 'upload_link.revoked', $4)`,
          [firmId, caseId, userId, `${rowCount} link${rowCount === 1 ? '' : 's'} turned off`],
        );
      }
      return rowCount ?? 0;
    });
  }

  /** Link plus its case, or GoneError. `lock` takes row locks for an upload. */
  private async openLink(c: Pool | PoolClient, token: string, lock: boolean) {
    if (!TOKEN_RE.test(token)) throw new GoneError();
    const { rows: [link] } = await c.query<{ id: string; firm_id: string; case_id: string; expires_at: Date; file_count: number; byte_count: string }>(
      `select id, firm_id, case_id, expires_at, file_count, byte_count from upload_links
        where token_hash = $1 and revoked_at is null and expires_at > now()${lock ? ' for update' : ''}`,
      [hashToken(token)],
    );
    if (!link) throw new GoneError();
    const { rows: [cs] } = await c.query<{ status: CaseStatus; version: number; data: CaseFile }>(
      `select status, version, data from cases where id = $1 and firm_id = $2${lock ? ' for update' : ''}`,
      [link.case_id, link.firm_id],
    );
    if (!cs) throw new GoneError();
    return { link, cs };
  }

  private async firmName(firmId: string): Promise<string> {
    try {
      const { rows } = await this.pool.query<{ name: string }>(`select name from organization where id = $1`, [firmId]);
      return rows[0]?.name ?? 'Your CA';
    } catch {
      return 'Your CA'; // auth tables absent (tests without Better Auth migrations)
    }
  }

  /** What the public upload page shows. No firm id, case id, PAN or amounts leave the server. */
  async getUploadRequest(token: string): Promise<UploadRequestView> {
    const { link, cs } = await this.openLink(this.pool, token, false);
    return uploadRequestView(cs.data, { firmName: await this.firmName(link.firm_id), expiresAt: link.expires_at.toISOString(), closed: cs.status === 'final' });
  }

  /**
   * Stores a client's file and adds it to their case in one transaction: the file row,
   * the document (read by the rules baseline when it is text), an audit row attributed
   * to the client, a fresh checklist summary, and the link's usage counters.
   */
  async acceptClientUpload(token: string, file: ClientFile): Promise<UploadRequestView> {
    const view = await this.tx(async (c) => {
      const { link, cs } = await this.openLink(c, token, true);
      if (cs.status === 'final') throw new LockedError();
      if (link.file_count >= MAX_FILES_PER_LINK || Number(link.byte_count) + file.bytes.length > MAX_BYTES_PER_LINK) {
        throw new ValidationError('This link has reached its upload limit. Ask your CA for a new one.');
      }
      if (cs.data.documents.length >= 200) throw new ValidationError('This case already has too many documents. Ask your CA.');
      // The case schema caps the audit trail; one more entry would make the case unsaveable
      if ((cs.data.audit ?? []).length >= MAX_AUDIT_ENTRIES) throw new ValidationError('Your CA’s file for you is full. Please ask them to contact you.');

      const now = new Date().toISOString();
      const isText = file.mime.startsWith('text/');
      const text = isText ? file.bytes.toString('utf8') : undefined;
      // Never read part of a statement: a cut-off file would look fully read
      if (text && text.length > MAX_TEXT_CHARS) {
        throw new ValidationError('That text file is too long to read in one go. Send it as a PDF, or split it into smaller files.');
      }
      const kind: DocKind = file.kind ?? (text ? detectKind(text) : 'other');
      let doc: CaseDocument = {
        id: `up-${randomUUID()}`, name: file.name, kind, mimeType: file.mime, size: file.bytes.length,
        ...(text ? { text } : {}), status: 'queued', source: 'client', uploadedAt: now,
      };
      let data: CaseFile = cs.data;
      if (text) {
        const applied = applyExtraction(doc, { output: rulesExtract(doc, kind), extractor: 'rules:v1', latencyMs: 0 });
        doc = { ...doc, ...applied.doc, kind } as CaseDocument;
        data = { ...data, facts: [...data.facts, ...applied.facts], modelFlags: [...data.modelFlags, ...applied.flags] };
      }
      const event = { at: now, actor: 'client' as const, action: 'client.uploaded', detail: `${file.name} (${DOC_KIND_LABEL[kind]})` };
      data = { ...data, documents: [...data.documents, doc], audit: [...data.audit, event] };

      await c.query(
        `insert into case_files (firm_id, case_id, doc_id, name, mime_type, size, sha256, content, upload_link_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [link.firm_id, link.case_id, doc.id, file.name, file.mime, file.bytes.length, createHash('sha256').update(file.bytes).digest('hex'), file.bytes, link.id],
      );
      await c.query(
        `update cases set data = $1, version = version + 1, updated_by = 'client-link', updated_at = now(), summary = $2 where id = $3 and firm_id = $4`,
        [data, summaryOf(data), link.case_id, link.firm_id],
      );
      await c.query(
        `insert into audit_events (firm_id, case_id, actor_user_id, actor_kind, action, detail) values ($1, $2, null, 'client', $3, $4)`,
        [link.firm_id, link.case_id, event.action, event.detail],
      );
      await c.query(`update upload_links set file_count = file_count + 1, byte_count = byte_count + $2 where id = $1`, [link.id, file.bytes.length]);
      return { data, firmId: link.firm_id, expiresAt: link.expires_at.toISOString() };
    });
    return uploadRequestView(view.data, { firmName: await this.firmName(view.firmId), expiresAt: view.expiresAt, closed: false });
  }

  /** A stored client file, for members of the case's firm only. */
  async getCaseFile(firmId: string, caseId: string, docId: string): Promise<{ name: string; mime_type: string; content: Buffer }> {
    if (!isUuid(caseId)) throw new NotFoundError();
    const { rows } = await this.pool.query<{ name: string; mime_type: string; content: Buffer }>(
      `select name, mime_type, content from case_files where firm_id = $1 and case_id = $2 and doc_id = $3`,
      [firmId, caseId, docId],
    );
    if (!rows[0]) throw new NotFoundError();
    return rows[0];
  }

  async listAudit(firmId: string, caseId: string): Promise<AuditRow[]> {
    await this.getCase(firmId, caseId); // NotFound across firms
    const { rows } = await this.pool.query<AuditRow>(
      `select id::text, actor_user_id, actor_kind, action, detail, at from audit_events where case_id = $1 and firm_id = $2 order by id`,
      [caseId, firmId],
    );
    return rows;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s);

/** "2024-25" → "2025-26" */
export function nextAy(fy: string): string {
  const start = Number(fy.slice(0, 4)) + 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}
