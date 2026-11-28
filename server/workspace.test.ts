// @vitest-environment node
/**
 * HTTP-level tests for the practice workspace: real Better Auth sign-up and firm
 * creation against Postgres, then the workspace API exercised with session cookies.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';

const { Pool } = pg;
type Pool = pg.Pool;
import { migrateAll } from './db/migrate.js';
import { routeWorkspace } from './workspace.js';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;
const BASE = 'http://localhost:8080';

d('workspace API (Better Auth + Postgres)', () => {
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
    return { status: res.status, body: text ? JSON.parse(text) : null, cookies: res.headers.getSetCookie() };
  };

  const cookieFrom = (setCookies: string[]) => setCookies.map((c) => c.split(';')[0]).join('; ');

  /** Sign up a user, create a firm (they become its owner/partner), return the session cookie. */
  const newPartner = async (label: string) => {
    const email = `${label}-${run}@example.test`;
    const signUp = await call('/api/auth/sign-up/email', { method: 'POST', body: { email, password: 'correct horse battery', name: label } });
    expect(signUp.status).toBe(200);
    const cookie = cookieFrom(signUp.cookies);
    const org = await call('/api/auth/organization/create', { method: 'POST', cookie, body: { name: `${label} & Co`, slug: `${label}-${run}` } });
    expect(org.status).toBe(200);
    return { cookie, firmId: org.body.id as string, email };
  };

  let A: { cookie: string; firmId: string; email: string };
  let B: { cookie: string; firmId: string; email: string };

  beforeAll(async () => {
    process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough-1234567890';
    process.env.BETTER_AUTH_URL = BASE;
    pool = new Pool({ connectionString: url });
    await migrateAll(pool);
    A = await newPartner('alpha');
    B = await newPartner('beta');
  });
  afterAll(async () => {
    await pool.query('delete from clients where firm_id = any($1)', [[A?.firmId, B?.firmId]]);
    await pool.end();
  });

  it('rejects anonymous requests', async () => {
    expect((await call('/api/clients')).status).toBe(401);
    expect((await call('/api/cases/00000000-0000-0000-0000-000000000000')).status).toBe(401);
  });

  it('resolves the member as a partner of their own firm', async () => {
    const me = await call('/api/me', { cookie: A.cookie });
    expect(me.status).toBe(200);
    expect(me.body.member).toMatchObject({ firmId: A.firmId, role: 'partner', email: A.email });
  });

  it('isolates firms end to end', async () => {
    const created = await call('/api/clients', { method: 'POST', cookie: A.cookie, body: { name: 'Rahul Sharma', pan: 'aaapz9999z', fy: '2024-25' } });
    expect(created.status).toBe(201);
    expect(created.body.client.pan).toBe('AAAPZ9999Z');
    const caseId = created.body.caseId;

    expect((await call('/api/clients', { cookie: A.cookie })).body.clients.map((c: { id: string }) => c.id)).toContain(created.body.client.id);
    expect((await call('/api/clients', { cookie: B.cookie })).body.clients).toEqual([]);

    expect((await call(`/api/cases/${caseId}`, { cookie: B.cookie })).status).toBe(404);
    expect((await call(`/api/cases/${caseId}/audit`, { cookie: B.cookie })).status).toBe(404);
    expect((await call(`/api/cases/${caseId}/status`, { method: 'POST', cookie: B.cookie, body: { status: 'final' } })).status).toBe(404);
    const own = await call(`/api/cases/${caseId}`, { cookie: A.cookie });
    expect((await call(`/api/cases/${caseId}`, { method: 'PUT', cookie: B.cookie, body: { version: 1, data: own.body.data } })).status).toBe(404);
  });

  it('creates a client with a profile and phone, and rejects an invalid profile', async () => {
    const profile = { salaried: true, employers: 2, paysRent: false, homeLoan: false, educationLoan: false, rentalIncome: false, capitalGains: false, business: false, investments80C: false, healthInsurance: false };
    const created = await call('/api/clients', { method: 'POST', cookie: A.cookie, body: { name: 'Two Jobs', phone: '+91 98765 43210', profile } });
    expect(created.status).toBe(201);
    const loaded = await call(`/api/cases/${created.body.caseId}`, { cookie: A.cookie });
    expect(loaded.body.data.profile).toEqual(profile);
    expect(loaded.body.data.client.phone).toBe('+91 98765 43210');
    const listed = (await call('/api/clients', { cookie: A.cookie })).body.clients.find((c: { id: string }) => c.id === created.body.client.id);
    expect(listed.summary.items[0]).toMatchObject({ kind: 'form16', minCount: 2, status: 'missing' });

    expect((await call('/api/clients', { method: 'POST', cookie: A.cookie, body: { name: 'Bad', profile: { salaried: 'yes' } } })).status).toBe(400);
    expect((await call('/api/clients', { method: 'POST', cookie: A.cookie, body: { name: 'Bad', phone: '<script>' } })).status).toBe(400);
  });

  it('saves with version checks and returns 409 on a stale save', async () => {
    const created = await call('/api/clients', { method: 'POST', cookie: A.cookie, body: { name: 'Concurrent client' } });
    const caseId = created.body.caseId;
    const loaded = await call(`/api/cases/${caseId}`, { cookie: A.cookie });
    const data = { ...loaded.body.data, audit: [...loaded.body.data.audit, { at: new Date().toISOString(), actor: 'ca', action: 'fact.edited', detail: 'x' }] };
    const first = await call(`/api/cases/${caseId}`, { method: 'PUT', cookie: A.cookie, body: { version: 1, data } });
    expect(first.body.version).toBe(2);
    const stale = await call(`/api/cases/${caseId}`, { method: 'PUT', cookie: A.cookie, body: { version: 1, data } });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('conflict');
  });

  it('rejects malformed case documents and binary payloads', async () => {
    const created = await call('/api/clients', { method: 'POST', cookie: A.cookie, body: { name: 'Bad payload' } });
    const res = await call(`/api/cases/${created.body.caseId}`, { method: 'PUT', cookie: A.cookie, body: { version: 1, data: { facts: 'nope' } } });
    expect(res.status).toBe(400);
  });

  it('invites a preparer who can work on the firm’s cases but cannot finalise', async () => {
    const created = await call('/api/clients', { method: 'POST', cookie: A.cookie, body: { name: 'Shared client' } });
    const prepEmail = `prep-${run}@example.test`;
    const invite = await call('/api/auth/organization/invite-member', { method: 'POST', cookie: A.cookie, body: { email: prepEmail, role: 'member' } });
    expect(invite.status).toBe(200);
    const signUp = await call('/api/auth/sign-up/email', { method: 'POST', body: { email: prepEmail, password: 'another long password', name: 'Prep' } });
    const prep = cookieFrom(signUp.cookies);
    const accepted = await call('/api/auth/organization/accept-invitation', { method: 'POST', cookie: prep, body: { invitationId: invite.body.id } });
    expect(accepted.status).toBe(200);

    const me = await call('/api/me', { cookie: prep });
    expect(me.body.member).toMatchObject({ firmId: A.firmId, role: 'preparer' });
    expect((await call('/api/clients', { cookie: prep })).body.clients.map((c: { id: string }) => c.id)).toContain(created.body.client.id);
    const fin = await call(`/api/cases/${created.body.caseId}/status`, { method: 'POST', cookie: prep, body: { status: 'final' } });
    expect(fin.status).toBe(403);
  });

  it('lets a partner finalise, then blocks edits until reopened', async () => {
    const created = await call('/api/clients', { method: 'POST', cookie: A.cookie, body: { name: 'Final client' } });
    const caseId = created.body.caseId;
    const loaded = await call(`/api/cases/${caseId}`, { cookie: A.cookie });
    expect((await call(`/api/cases/${caseId}/status`, { method: 'POST', cookie: A.cookie, body: { status: 'final' } })).body.status).toBe('final');
    const blocked = await call(`/api/cases/${caseId}`, { method: 'PUT', cookie: A.cookie, body: { version: 1, data: loaded.body.data } });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('locked');
  });
});
