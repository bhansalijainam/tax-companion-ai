/**
 * The only module that reads or writes workspace tables.
 *
 * Every method takes `firmId` first, and every query filters on it. The firm id
 * comes from the signed-in session (server/auth.ts), never from the request body.
 * Another firm's rows are reported as NotFound, so ids can't be probed.
 */
import type { Pool, PoolClient } from 'pg';
import type { CaseFile } from '../../src/domain/types';

export class NotFoundError extends Error { constructor() { super('Not found'); this.name = 'NotFoundError'; } }
export class ConflictError extends Error { constructor() { super('This case was changed by someone else. Reload to see the latest version.'); this.name = 'ConflictError'; } }
export class LockedError extends Error { constructor() { super('This case is final. A partner must reopen it before it can be edited.'); this.name = 'LockedError'; } }
export class ForbiddenError extends Error { constructor(msg: string) { super(msg); this.name = 'ForbiddenError'; } }
export class ValidationError extends Error { constructor(msg: string) { super(msg); this.name = 'ValidationError'; } }

export type Role = 'partner' | 'preparer';
export type CaseStatus = 'draft' | 'in_review' | 'final';

export interface ClientRow { id: string; name: string; pan: string | null; created_at: string; }
export interface ClientListItem extends ClientRow { case_id: string | null; fy: string | null; status: CaseStatus | null; updated_at: string | null; }
export interface CaseRow { id: string; client_id: string; fy: string; status: CaseStatus; version: number; data: CaseFile; updated_by: string; updated_at: string; }
export interface AuditRow { id: string; actor_user_id: string | null; actor_kind: string; action: string; detail: string; at: string; }

/** Binary payloads never go into the case document. */
const stripBinaries = (c: CaseFile): CaseFile => ({ ...c, documents: c.documents.map(({ base64: _b, ...d }) => d) });

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
              cs.id as case_id, cs.fy, cs.status, cs.updated_at
         from clients cl
         left join lateral (
           select id, fy, status, updated_at from cases
            where cases.client_id = cl.id and cases.firm_id = $1
            order by fy desc limit 1
         ) cs on true
        where cl.firm_id = $1 and ($2::text is null or cl.name ilike '%' || $2 || '%')
        order by coalesce(cs.updated_at, cl.created_at) desc
        limit 500`,
      [firmId, search?.trim() || null],
    );
    return rows;
  }

  async createClient(
    firmId: string, userId: string,
    input: { name: string; pan?: string | null; fy: string },
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
        client: { ...initial.client, name: input.name, pan: input.pan || '', fy: input.fy, ay: nextAy(input.fy) },
        audit: [],
      });
      const { rows: [cs] } = await c.query<{ id: string }>(
        `insert into cases (firm_id, client_id, fy, data, updated_by) values ($1, $2, $3, $4, $5) returning id`,
        [firmId, client.id, input.fy, data, userId],
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
      const prefixIntact = after.length >= before.length && before.every((e, i) => JSON.stringify(e) === JSON.stringify(after[i]));
      if (!prefixIntact) throw new ValidationError('The audit history in this save does not match the stored history.');

      const next = cur.version + 1;
      await c.query(
        `update cases set data = $1, version = $2, updated_by = $3, updated_at = now() where id = $4 and firm_id = $5`,
        [stripBinaries(data), next, userId, caseId, firmId],
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
