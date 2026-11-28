/**
 * Practice workspace HTTP handlers (Web Fetch API, same shape as server/handlers.ts).
 * Every handler resolves the signed-in member first; the firm id comes only from there.
 */
import { z } from 'zod';
import type { Pool } from 'pg';
import { emptyCase } from '../src/ai/pipeline.js';
import { getAuth, resolveMember, type Member } from './auth.js';
import { ClientProfileSchema, parseCaseFile } from './caseSchema.js';
import { getPool } from './db/pool.js';
import { ConflictError, ForbiddenError, GoneError, LockedError, NotFoundError, Repo, ValidationError } from './db/repo.js';
import { contentMatchesType, isDocKind, MAX_FILE_BYTES, normaliseMime, safeFileName } from '../src/domain/upload.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const MAX_BODY_BYTES = 4_000_000;
async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new ValidationError('Request too large');
  return JSON.parse(text);
}

function workspaceError(err: unknown): Response {
  if (err instanceof NotFoundError) return json({ error: 'Not found' }, 404);
  if (err instanceof ConflictError) return json({ error: err.message, code: 'conflict' }, 409);
  if (err instanceof LockedError) return json({ error: err.message, code: 'locked' }, 409);
  if (err instanceof ForbiddenError) return json({ error: err.message }, 403);
  if (err instanceof ValidationError) return json({ error: err.message }, 400);
  if (err instanceof z.ZodError || err instanceof SyntaxError) return json({ error: 'Invalid request body' }, 400);
  console.error('[workspace]', err instanceof Error ? err.message : err);
  return json({ error: 'Internal error' }, 500);
}

type Handler = (req: Request, m: Member, repo: Repo, params: Record<string, string>) => Promise<Response>;

/** Wraps a handler with member resolution and error mapping. `pool` is injectable for tests. */
export function withMember(fn: Handler, pool?: Pool) {
  return async (req: Request, params: Record<string, string> = {}): Promise<Response> => {
    try {
      const db = pool ?? getPool();
      const r = await resolveMember(req, db);
      if (!r.ok) return json({ error: r.error }, r.status);
      return await fn(req, r.member, new Repo(db), params);
    } catch (err) {
      return workspaceError(err);
    }
  };
}

const CreateClient = z.object({
  name: z.string().trim().min(1).max(200),
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN must look like ABCDE1234F').optional().or(z.literal('')),
  fy: z.string().regex(/^\d{4}-\d{2}$/).default('2024-25'),
  phone: z.string().trim().max(20).regex(/^[0-9+()\-\s]*$/, 'Phone number can only contain digits, spaces, +, - and brackets').optional(),
  profile: ClientProfileSchema.optional(),
});
const SaveCase = z.object({ version: z.number().int().positive(), data: z.unknown() });
const SetStatus = z.object({ status: z.enum(['draft', 'in_review', 'final']) });

export const clientsHandler: Handler = async (req, m, repo) => {
  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams.get('q') ?? undefined;
    return json({ clients: await repo.listClients(m.firmId, q) });
  }
  if (req.method === 'POST') {
    const body = CreateClient.parse(await readJson(req));
    const out = await repo.createClient(m.firmId, m.userId, { name: body.name, pan: body.pan || null, fy: body.fy, phone: body.phone || undefined, profile: body.profile }, emptyCase());
    return json(out, 201);
  }
  return json({ error: 'Method not allowed' }, 405);
};

export const caseHandler: Handler = async (req, m, repo, { id }) => {
  if (req.method === 'GET') {
    const c = await repo.getCase(m.firmId, id);
    return json({ ...c, role: m.role });
  }
  if (req.method === 'PUT') {
    const body = SaveCase.parse(await readJson(req));
    const version = await repo.saveCase(m.firmId, id, m.userId, body.version, parseCaseFile(body.data));
    return json({ version });
  }
  return json({ error: 'Method not allowed' }, 405);
};

export const caseStatusHandler: Handler = async (req, m, repo, { id }) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const { status } = SetStatus.parse(await readJson(req));
  await repo.setStatus(m.firmId, id, m.userId, m.role, status);
  return json(await repo.getCase(m.firmId, id).then(({ status: s, version }) => ({ status: s, version })));
};

export const caseAuditHandler: Handler = async (req, m, repo, { id }) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  return json({ events: await repo.listAudit(m.firmId, id) });
};

export const uploadLinksHandler: Handler = async (req, m, repo, { id }) => {
  if (req.method === 'GET') return json({ links: await repo.listUploadLinks(m.firmId, id) });
  if (req.method === 'POST') return json(await repo.createUploadLink(m.firmId, id, m.userId), 201);
  if (req.method === 'DELETE') return json({ revoked: await repo.revokeUploadLinks(m.firmId, id, m.userId) });
  return json({ error: 'Method not allowed' }, 405);
};

/** A client's stored file, for the firm's members. Served as a download, never rendered inline. */
export const caseFileHandler: Handler = async (req, m, repo, { id, docId }) => {
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const f = await repo.getCaseFile(m.firmId, id, decodeURIComponent(docId));
  return new Response(new Uint8Array(f.content), {
    headers: {
      'content-type': f.mime_type,
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      'cache-control': 'private, no-store',
    },
  });
};

const publicJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex' },
  });

/**
 * /api/upload/:token: the client's side. No sign-in; the unguessable token is the credential
 * and it reaches exactly one case. Unknown, expired and revoked tokens look identical (410).
 */
export async function clientUploadHandler(req: Request, token: string, pool?: Pool): Promise<Response> {
  try {
    const repo = new Repo(pool ?? getPool());
    if (req.method === 'GET') return publicJson(await repo.getUploadRequest(token));
    if (req.method !== 'POST') return publicJson({ error: 'Method not allowed' }, 405);

    const declared = Number(req.headers.get('content-length') ?? '0');
    if (declared > MAX_FILE_BYTES) return publicJson({ error: 'That file is larger than 4 MB. Send a smaller copy, or a photo of each page.' }, 413);
    const name = safeFileName(decodeURIComponent(req.headers.get('x-file-name') ?? 'document'));
    const mime = normaliseMime(req.headers.get('content-type') ?? '', name);
    if (!mime) return publicJson({ error: 'Please upload a PDF, a photo (JPEG, PNG, WebP) or a text/CSV file.' }, 415);
    const kindHeader = req.headers.get('x-doc-kind');
    const kind = kindHeader && isDocKind(kindHeader) ? kindHeader : undefined;

    const bytes = Buffer.from(await req.arrayBuffer());
    if (bytes.length === 0) return publicJson({ error: 'That file is empty.' }, 400);
    if (bytes.length > MAX_FILE_BYTES) return publicJson({ error: 'That file is larger than 4 MB. Send a smaller copy, or a photo of each page.' }, 413);
    if (!contentMatchesType(bytes, mime)) return publicJson({ error: 'That file’s contents don’t match its type. Please upload the original PDF or photo.' }, 415);

    return publicJson(await repo.acceptClientUpload(token, { name, mime, bytes, kind }), 201);
  } catch (err) {
    if (err instanceof GoneError) return publicJson({ error: err.message }, 410);
    if (err instanceof LockedError) return publicJson({ error: 'Your return has already been filed, so this link no longer accepts files. Contact your CA if something changed.' }, 409);
    if (err instanceof ValidationError) return publicJson({ error: err.message }, 400);
    console.error('[upload]', err instanceof Error ? err.message : err);
    return publicJson({ error: 'Something went wrong. Please try again in a minute.' }, 500);
  }
}

export const meHandler: Handler = async (_req, m) => json({ member: m });

/** Better Auth's own endpoints (sign-up, sign-in, organizations, invitations). */
export function handleAuth(req: Request, pool?: Pool): Promise<Response> {
  return getAuth(pool ?? getPool()).handler(req);
}

/** Path router shared by Vercel functions and the Vite dev middleware. */
export function routeWorkspace(req: Request, pool?: Pool): Promise<Response> | null {
  const path = new URL(req.url).pathname;
  if (path.startsWith('/api/auth/')) return handleAuth(req, pool);
  if (path === '/api/me') return withMember(meHandler, pool)(req);
  if (path === '/api/clients') return withMember(clientsHandler, pool)(req);
  let m = path.match(/^\/api\/cases\/([^/]+)$/);
  if (m) return withMember(caseHandler, pool)(req, { id: m[1] });
  m = path.match(/^\/api\/cases\/([^/]+)\/status$/);
  if (m) return withMember(caseStatusHandler, pool)(req, { id: m[1] });
  m = path.match(/^\/api\/cases\/([^/]+)\/audit$/);
  if (m) return withMember(caseAuditHandler, pool)(req, { id: m[1] });
  m = path.match(/^\/api\/cases\/([^/]+)\/upload-links$/);
  if (m) return withMember(uploadLinksHandler, pool)(req, { id: m[1] });
  m = path.match(/^\/api\/cases\/([^/]+)\/files\/([^/]+)$/);
  if (m) return withMember(caseFileHandler, pool)(req, { id: m[1], docId: m[2] });
  m = path.match(/^\/api\/upload\/([^/]+)$/);
  if (m) return clientUploadHandler(req, m[1], pool);
  return null;
}
