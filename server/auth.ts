/**
 * Sign-in for the practice workspace: Better Auth, with users, sessions and firms
 * (organizations) stored in our own Postgres. Provider-specific code lives only here.
 *
 * Roles: Better Auth 'owner' / 'admin' → partner; 'member' → preparer.
 */
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { organization } from 'better-auth/plugins/organization';
import type { Pool } from 'pg';
import type { Role } from './db/repo.js';
import { getPool } from './db/pool.js';

export function authOptions(pool: Pool): BetterAuthOptions {
  return {
    database: pool,
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL, // unset on previews: inferred from the request
    emailAndPassword: { enabled: true, minPasswordLength: 10 },
    plugins: [
      organization({
        creatorRole: 'owner',
        organizationLimit: 3,
        // Invitations are shared as links by a partner in the pilot (no email provider yet).
      }),
    ],
    // Session cookie cache stays off: the active firm must be read fresh on every request.
    session: { cookieCache: { enabled: false } },
    // Sessions also gate paid AI routes, so keep Better Auth's own rate limiting on.
    // Tests sign up many users in parallel files; only the test runner can turn the limiter off
    rateLimit: { enabled: !(process.env.NODE_ENV === 'test' && process.env.AUTH_RATE_LIMIT === 'off'), storage: 'database' },
  };
}

type Auth = ReturnType<typeof betterAuth>;
let authInstance: Auth | null = null;
let authPool: Pool | null = null;

/** Lazily created so demo-only deployments never touch the database. */
export function getAuth(pool: Pool = getPool()): Auth {
  // Sessions must never be signed with a fallback secret in a real deployment
  if (process.env.VERCEL_ENV === 'production' && (process.env.BETTER_AUTH_SECRET ?? '').length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be set (32+ characters) in production');
  }
  if (!authInstance || authPool !== pool) {
    authInstance = betterAuth(authOptions(pool));
    authPool = pool;
  }
  return authInstance;
}

export interface Member {
  userId: string;
  email: string;
  firmId: string;
  role: Role;
}

export type MemberResult =
  | { ok: true; member: Member }
  | { ok: false; status: 401 | 403; error: string };

/** Resolve the signed-in user and their active firm from the request cookies. */
export async function resolveMember(req: Request, pool?: Pool): Promise<MemberResult> {
  const auth = getAuth(pool);
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return { ok: false, status: 401, error: 'Sign in to continue.' };
  const firmId = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId;
  if (!firmId) return { ok: false, status: 403, error: 'Create or join a firm first.' };
  const db = pool ?? getPool();
  const { rows } = await db.query<{ role: string }>(
    `select role from member where "organizationId" = $1 and "userId" = $2`,
    [firmId, session.user.id],
  );
  if (!rows[0]) return { ok: false, status: 403, error: 'You are not a member of this firm.' };
  const roles = rows[0].role.split(',').map((r) => r.trim());
  return {
    ok: true,
    member: {
      userId: session.user.id,
      email: session.user.email,
      firmId,
      role: roles.includes('owner') || roles.includes('admin') ? 'partner' : 'preparer',
    },
  };
}
