// @vitest-environment node
/**
 * Tenant isolation and concurrency are the two invariants that matter most in the
 * practice workspace (docs/product/capabilities/practice-workspace.md). These tests
 * run against a real Postgres: set TEST_DATABASE_URL (CI provides one).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';

const { Pool } = pg;
type Pool = pg.Pool;
import { applySchema } from './migrate.js';
import { SCHEMA_SQL } from './schema.js';
import { ConflictError, LockedError, NotFoundError, Repo } from './repo.js';
import { buildSampleCase, emptyCase } from '../../src/ai/pipeline.js';
import { EMPTY_PROFILE } from '../../src/domain/checklist.js';
import { buildPracticeCase, PRACTICE_PERSONAS } from '../../src/fixtures/samplePractice.js';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d('repo (Postgres)', () => {
  let pool: Pool;
  let repo: Repo;
  const A = `firm-a-${Date.now()}`;
  const B = `firm-b-${Date.now()}`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    await applySchema(pool);
    repo = new Repo(pool);
  });
  afterAll(async () => {
    await pool.query('delete from cases where firm_id = any($1)', [[A, B]]);
    await pool.query('delete from clients where firm_id = any($1)', [[A, B]]);
    await pool.end();
  });

  it('creates a client with its first case and lists it only for its firm', async () => {
    const { client, caseId } = await repo.createClient(A, 'user-a', { name: 'Rahul Sharma', pan: 'AAAPZ9999Z', fy: '2024-25' }, emptyCase());
    expect(client.name).toBe('Rahul Sharma');
    expect(caseId).toBeTruthy();
    expect((await repo.listClients(A)).map((c) => c.id)).toContain(client.id);
    expect((await repo.listClients(B)).map((c) => c.id)).not.toContain(client.id);
  });

  it('stores a checklist summary on create and save, and the list applies the case status', async () => {
    const profile = { ...EMPTY_PROFILE, salaried: true, employers: 1, capitalGains: true };
    const { client, caseId } = await repo.createClient(A, 'user-a', { name: 'Checklist Client', fy: '2024-25', phone: '98765 43210', profile }, emptyCase());
    let row = (await repo.listClients(A)).find((c) => c.id === client.id)!;
    expect(row.summary?.stage).toBe('not-started');
    expect(row.summary?.items.map((i) => i.kind)).toEqual(['form16', 'capital-gains', 'bank-statement', 'ais']);
    expect(row.summary?.phone).toBe('98765 43210');

    const c = buildPracticeCase(PRACTICE_PERSONAS.find((p) => p.id === 'c03')!); // everything but capital gains
    await repo.saveCase(A, caseId, 'user-a', 1, { ...c, audit: [] });
    row = (await repo.listClients(A)).find((x) => x.id === client.id)!;
    expect(row.summary?.stage).toBe('awaiting-docs');
    expect(row.summary?.items.find((i) => i.kind === 'capital-gains')?.status).toBe('missing');

    await repo.setStatus(A, caseId, 'user-a', 'partner', 'final');
    row = (await repo.listClients(A)).find((x) => x.id === client.id)!;
    expect(row.summary?.stage).toBe('filed');
  });

  it('backfills the summary for cases saved before checklists existed', async () => {
    const { client, caseId } = await repo.createClient(A, 'user-a', { name: 'Legacy Client', fy: '2024-25' }, emptyCase());
    await pool.query('update cases set summary = null, data = $1 where id = $2', [buildSampleCase(), caseId]);
    const row = (await repo.listClients(A)).find((x) => x.id === client.id)!;
    expect(row.summary?.items.some((i) => i.kind === 'capital-gains')).toBe(true); // inferred from the documents
    const { rows } = await pool.query('select summary from cases where id = $1', [caseId]);
    expect(rows[0].summary).not.toBeNull();
  });

  it('re-applying the schema takes no locks that would block reads or writes', async () => {
    // Deploys re-run the schema while the app is serving; strong locks there deadlock with saves
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query(SCHEMA_SQL);
      const { rows } = await c.query<{ relname: string; mode: string }>(
        `select c.relname, l.mode from pg_locks l join pg_class c on c.oid = l.relation
          where l.pid = pg_backend_pid()
            and l.mode in ('ShareLock', 'ShareRowExclusiveLock', 'ExclusiveLock', 'AccessExclusiveLock')
            and c.relname = any($1)`,
        [['clients', 'cases', 'audit_events', 'upload_links', 'case_files']],
      );
      expect(rows).toEqual([]);
    } finally {
      await c.query('rollback');
      c.release();
    }
  });

  it('never returns another firm’s case', async () => {
    const { caseId } = await repo.createClient(A, 'user-a', { name: 'Secret', fy: '2024-25' }, emptyCase());
    await expect(repo.getCase(B, caseId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.saveCase(B, caseId, 'user-b', 1, emptyCase())).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.listAudit(B, caseId)).rejects.toBeInstanceOf(NotFoundError);
    const own = await repo.getCase(A, caseId);
    expect(own.version).toBe(1);
  });

  it('rejects a save from a stale version instead of overwriting', async () => {
    const { caseId } = await repo.createClient(A, 'user-a', { name: 'Concurrent', fy: '2024-25' }, emptyCase());
    const v2 = await repo.saveCase(A, caseId, 'user-a', 1, { ...emptyCase(), client: { ...emptyCase().client, name: 'first edit' } });
    expect(v2).toBe(2);
    await expect(repo.saveCase(A, caseId, 'user-a2', 1, emptyCase())).rejects.toBeInstanceOf(ConflictError);
    expect((await repo.getCase(A, caseId)).data.client.name).toBe('first edit');
  });

  it('records new client-side audit events as server audit rows attributed to the session user', async () => {
    const { caseId } = await repo.createClient(A, 'user-a', { name: 'Audit', fy: '2024-25' }, emptyCase());
    const c = emptyCase();
    c.audit.push({ at: new Date().toISOString(), actor: 'ca', action: 'fact.accepted', detail: '3 facts' });
    await repo.saveCase(A, caseId, 'user-a', 1, c);
    const rows = await repo.listAudit(A, caseId);
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['case.created', 'fact.accepted']));
    expect(rows.find((r) => r.action === 'fact.accepted')?.actor_user_id).toBe('user-a');
  });

  it('refuses a save that rewrites earlier audit history', async () => {
    const { caseId } = await repo.createClient(A, 'user-a', { name: 'Tamper', fy: '2024-25' }, emptyCase());
    const c = emptyCase();
    c.audit.push({ at: '2026-01-01T00:00:00.000Z', actor: 'ca', action: 'fact.accepted', detail: 'x' });
    await repo.saveCase(A, caseId, 'user-a', 1, c);
    const tampered = emptyCase();
    tampered.audit.push({ at: '2026-01-01T00:00:00.000Z', actor: 'ca', action: 'fact.accepted', detail: 'EDITED' });
    await expect(repo.saveCase(A, caseId, 'user-a', 2, tampered)).rejects.toThrow(/audit/i);
  });

  it('makes the audit table append-only at the database level', async () => {
    const { caseId } = await repo.createClient(A, 'user-a', { name: 'Append', fy: '2024-25' }, emptyCase());
    await expect(pool.query('update audit_events set detail = $1 where case_id = $2', ['x', caseId])).rejects.toThrow(/append-only/);
    await expect(pool.query('delete from audit_events where case_id = $1', [caseId])).rejects.toThrow(/append-only/);
  });

  it('only partners can finalise, and a final case is read-only until reopened', async () => {
    const { caseId } = await repo.createClient(A, 'user-a', { name: 'Final', fy: '2024-25' }, emptyCase());
    await expect(repo.setStatus(A, caseId, 'user-p', 'preparer', 'final')).rejects.toThrow(/partner/i);
    await repo.setStatus(A, caseId, 'user-p', 'partner', 'final');
    await expect(repo.saveCase(A, caseId, 'user-a', 1, emptyCase())).rejects.toBeInstanceOf(LockedError);
    await repo.setStatus(A, caseId, 'user-p', 'partner', 'in_review');
    expect(await repo.saveCase(A, caseId, 'user-a', 1, emptyCase())).toBe(2);
    const actions = (await repo.listAudit(A, caseId)).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['case.final', 'case.reopened']));
  });

  it('still lets a case deletion (retention / client request) remove its audit trail', async () => {
    const { caseId } = await repo.createClient(A, 'user-a', { name: 'Delete me', fy: '2024-25' }, emptyCase());
    await pool.query('delete from cases where id = $1', [caseId]);
    const { rows } = await pool.query('select count(*)::int as n from audit_events where case_id = $1', [caseId]);
    expect(rows[0].n).toBe(0);
  });

  it('does not allow one firm to move another firm’s case to final', async () => {
    const { caseId } = await repo.createClient(A, 'user-a', { name: 'Other', fy: '2024-25' }, emptyCase());
    await expect(repo.setStatus(B, caseId, 'user-b', 'partner', 'final')).rejects.toBeInstanceOf(NotFoundError);
  });
});
