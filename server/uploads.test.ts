// @vitest-environment node
/**
 * Client upload links (M3), end to end over HTTP against Postgres. The token is the only
 * credential on the client's side, so these tests are about what it can and can't reach.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';

const { Pool } = pg;
type Pool = pg.Pool;
import { migrateAll } from './db/migrate.js';
import { routeWorkspace } from './workspace.js';
import { hashToken } from './db/repo.js';
import { sampleDocText, PRACTICE_PERSONAS } from '../src/fixtures/samplePractice.js';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;
const BASE = 'http://localhost:8080';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
const PROFILE = { salaried: true, employers: 1, paysRent: false, homeLoan: false, educationLoan: false, rentalIncome: false, capitalGains: true, business: false, investments80C: false, healthInsurance: false };

d('client upload links (HTTP + Postgres)', () => {
  let pool: Pool;
  const run = `${Date.now()}`;

  const call = async (path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) => {
    const req = new Request(BASE + path, {
      method: init.method ?? 'GET',
      headers: { 'content-type': 'application/json', origin: BASE, ...(init.cookie ? { cookie: init.cookie } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const res = (await routeWorkspace(req, pool))!;
    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: res.status, body: body as any, headers: res.headers, cookies: res.headers.getSetCookie() }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  /** The client's side: no cookie, raw file body */
  const upload = async (token: string, bytes: Buffer | string, opts: { name?: string; type?: string; kind?: string } = {}) => {
    const body = typeof bytes === 'string' ? Buffer.from(bytes) : bytes;
    const req = new Request(`${BASE}/api/upload/${token}`, {
      method: 'POST',
      headers: {
        'content-type': opts.type ?? 'text/plain',
        'x-file-name': encodeURIComponent(opts.name ?? 'doc.txt'),
        'content-length': String(body.length),
        ...(opts.kind ? { 'x-doc-kind': opts.kind } : {}),
      },
      body,
    });
    const res = (await routeWorkspace(req, pool))!;
    return { status: res.status, body: await res.json(), headers: res.headers };
  };

  const cookieFrom = (setCookies: string[]) => setCookies.map((c) => c.split(';')[0]).join('; ');
  const newPartner = async (label: string) => {
    const email = `${label}-${run}@example.test`;
    const signUp = await call('/api/auth/sign-up/email', { method: 'POST', body: { email, password: 'correct horse battery', name: label } });
    const cookie = cookieFrom(signUp.cookies);
    const org = await call('/api/auth/organization/create', { method: 'POST', cookie, body: { name: `${label} & Co`, slug: `${label}-up-${run}` } });
    return { cookie, firmId: org.body.id as string };
  };
  const newCase = async (cookie: string, name = 'Vikram Mehta') =>
    (await call('/api/clients', { method: 'POST', cookie, body: { name, profile: PROFILE } })).body.caseId as string;

  let A: { cookie: string; firmId: string };
  let B: { cookie: string; firmId: string };

  beforeAll(async () => {
    process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough-1234567890';
    process.env.BETTER_AUTH_URL = BASE;
    process.env.AUTH_RATE_LIMIT = 'off';
    pool = new Pool({ connectionString: url });
    await migrateAll(pool);
    A = await newPartner('upalpha');
    B = await newPartner('upbeta');
  });
  afterAll(async () => {
    await pool.query('delete from clients where firm_id = any($1)', [[A?.firmId, B?.firmId]]);
    await pool.end();
  });

  it('a firm member makes a link; only its hash is stored', async () => {
    const caseId = await newCase(A.cookie);
    const made = await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: A.cookie });
    expect(made.status).toBe(201);
    expect(made.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const { rows } = await pool.query('select token_hash from upload_links where case_id = $1', [caseId]);
    expect(rows[0].token_hash).toBe(hashToken(made.body.token));
    expect(JSON.stringify(rows)).not.toContain(made.body.token);
    const listed = await call(`/api/cases/${caseId}/upload-links`, { cookie: A.cookie });
    expect(JSON.stringify(listed.body)).not.toContain(made.body.token);
  });

  it('another firm cannot make, list or revoke links on the case, or download its files', async () => {
    const caseId = await newCase(A.cookie);
    expect((await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: B.cookie })).status).toBe(404);
    expect((await call(`/api/cases/${caseId}/upload-links`, { cookie: B.cookie })).status).toBe(404);
    expect((await call(`/api/cases/${caseId}/upload-links`, { method: 'DELETE', cookie: B.cookie })).status).toBe(404);
    expect((await call(`/api/cases/${caseId}/upload-links`, { method: 'POST' })).status).toBe(401);
  });

  it('the client page shows what is needed, and nothing private', async () => {
    const caseId = await newCase(A.cookie, 'Vikram Mehta');
    await call(`/api/cases/${caseId}`, { cookie: A.cookie }); // case exists
    const { token } = (await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: A.cookie })).body;
    const view = await call(`/api/upload/${token}`);
    expect(view.status).toBe(200);
    expect(view.body.firmName).toBe('upalpha & Co');
    expect(view.body.clientFirstName).toBe('Vikram');
    expect(view.body.items.map((i: { kind: string }) => i.kind)).toEqual(['form16', 'capital-gains', 'bank-statement', 'ais']);
    const raw = JSON.stringify(view.body);
    expect(raw).not.toContain(caseId);
    expect(raw).not.toContain(A.firmId);
    expect(view.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('a text upload is read, lands in the right case, and updates the checklist and audit', async () => {
    const caseId = await newCase(A.cookie);
    const { token } = (await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: A.cookie })).body;
    const vikram = PRACTICE_PERSONAS.find((p) => p.id === 'c03')!;
    const res = await upload(token, sampleDocText(vikram, 'capital-gains').text, { name: 'Broker PnL.txt', kind: 'capital-gains' });
    expect(res.status).toBe(201);
    expect(res.body.items.find((i: { kind: string }) => i.kind === 'capital-gains').status).toBe('ok');

    const cs = (await call(`/api/cases/${caseId}`, { cookie: A.cookie })).body;
    const doc = cs.data.documents.find((x: { source?: string }) => x.source === 'client');
    expect(doc).toMatchObject({ kind: 'capital-gains', status: 'extracted', name: 'Broker PnL.txt' });
    expect(cs.data.facts.some((f: { field: string }) => f.field === 'capitalGains.ltcg112A')).toBe(true);
    expect(cs.version).toBe(2);

    const audit = (await call(`/api/cases/${caseId}/audit`, { cookie: A.cookie })).body.events;
    expect(audit.at(-1)).toMatchObject({ actor_kind: 'client', action: 'client.uploaded', actor_user_id: null });
    const list = (await call('/api/clients', { cookie: A.cookie })).body.clients.find((c: { case_id: string }) => c.case_id === caseId);
    expect(list.summary.items.find((i: { kind: string }) => i.kind === 'capital-gains').status).toBe('ok');
  });

  it('stores PDFs for the firm to download, as an attachment', async () => {
    const caseId = await newCase(A.cookie);
    const { token } = (await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: A.cookie })).body;
    expect((await upload(token, PDF, { name: 'form16.pdf', type: 'application/pdf', kind: 'form16' })).status).toBe(201);
    const doc = (await call(`/api/cases/${caseId}`, { cookie: A.cookie })).body.data.documents[0];
    expect(doc).toMatchObject({ status: 'queued', source: 'client', mimeType: 'application/pdf' });
    expect(doc.base64).toBeUndefined();

    const req = (cookie?: string) => routeWorkspace(new Request(`${BASE}/api/cases/${caseId}/files/${doc.id}`, { headers: cookie ? { cookie } : {} }), pool)!;
    const own = await req(A.cookie);
    expect(own.status).toBe(200);
    expect(Buffer.from(await own.arrayBuffer()).equals(PDF)).toBe(true);
    expect(own.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(own.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await req(B.cookie)).status).toBe(404);
    expect((await req()).status).toBe(401);
  });

  it('rejects wrong types, disguised files, empty and oversized files', async () => {
    const caseId = await newCase(A.cookie);
    const { token } = (await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: A.cookie })).body;
    expect((await upload(token, 'MZ\x90\x00', { name: 'setup.exe', type: 'application/x-msdownload' })).status).toBe(415);
    expect((await upload(token, 'not really a pdf', { name: 'form16.pdf', type: 'application/pdf' })).status).toBe(415);
    expect((await upload(token, '', { name: 'empty.txt' })).status).toBe(400);
    expect((await upload(token, Buffer.alloc(4_000_001, 0x41), { name: 'big.txt' })).status).toBe(413);
    expect((await call(`/api/cases/${caseId}`, { cookie: A.cookie })).body.data.documents).toHaveLength(0);
  });

  it('cleans file names so they are safe to show', async () => {
    const caseId = await newCase(A.cookie);
    const { token } = (await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: A.cookie })).body;
    await upload(token, 'plain text', { name: '../../etc/<script>alert(1)</script>.txt' });
    const name = (await call(`/api/cases/${caseId}`, { cookie: A.cookie })).body.data.documents[0].name;
    expect(name).not.toMatch(/[<>/\\]/);
  });

  it('unknown, revoked and expired links all answer 410 and write nothing', async () => {
    const caseId = await newCase(A.cookie);
    expect((await call('/api/upload/not-a-token')).status).toBe(410);
    expect((await upload('A'.repeat(43), 'x')).status).toBe(410);

    const { token } = (await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: A.cookie })).body;
    expect((await call(`/api/cases/${caseId}/upload-links`, { method: 'DELETE', cookie: A.cookie })).body.revoked).toBe(1);
    expect((await call(`/api/upload/${token}`)).status).toBe(410);
    expect((await upload(token, 'x')).status).toBe(410);

    const { token: t2 } = (await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: A.cookie })).body;
    await pool.query(`update upload_links set expires_at = now() - interval '1 minute' where token_hash = $1`, [hashToken(t2)]);
    expect((await upload(t2, 'x')).status).toBe(410);
    expect((await call(`/api/cases/${caseId}`, { cookie: A.cookie })).body.data.documents).toHaveLength(0);
  });

  it('a filed case no longer accepts uploads, and no new links can be made for it', async () => {
    const caseId = await newCase(A.cookie);
    const { token } = (await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: A.cookie })).body;
    await call(`/api/cases/${caseId}/status`, { method: 'POST', cookie: A.cookie, body: { status: 'final' } });
    expect((await upload(token, 'x')).status).toBe(409);
    expect((await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: A.cookie })).status).toBe(409);
  });

  it('a CA save cannot forge client events, and removing a document deletes its file', async () => {
    const caseId = await newCase(A.cookie);
    const { token } = (await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: A.cookie })).body;
    await upload(token, PDF, { name: 'a.pdf', type: 'application/pdf' });
    const cs = (await call(`/api/cases/${caseId}`, { cookie: A.cookie })).body;

    const forged = { ...cs.data, audit: [...cs.data.audit, { at: new Date().toISOString(), actor: 'client', action: 'client.uploaded', detail: 'fake' }] };
    expect((await call(`/api/cases/${caseId}`, { method: 'PUT', cookie: A.cookie, body: { version: cs.version, data: forged } })).status).toBe(400);

    const removed = { ...cs.data, documents: [], audit: [...cs.data.audit, { at: new Date().toISOString(), actor: 'ca', action: 'document.removed', detail: 'a.pdf' }] };
    expect((await call(`/api/cases/${caseId}`, { method: 'PUT', cookie: A.cookie, body: { version: cs.version, data: removed } })).status).toBe(200);
    const { rows } = await pool.query('select count(*)::int as n from case_files where case_id = $1', [caseId]);
    expect(rows[0].n).toBe(0);
  });

  it('caps the number of files per link', async () => {
    const caseId = await newCase(A.cookie);
    const { token } = (await call(`/api/cases/${caseId}/upload-links`, { method: 'POST', cookie: A.cookie })).body;
    await pool.query('update upload_links set file_count = 40 where token_hash = $1', [hashToken(token)]);
    const res = await upload(token, 'x');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/upload limit/);
  });
});
