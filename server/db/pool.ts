import { Pool, type PoolConfig } from 'pg';

/**
 * Database connection for the practice workspace. Works with any Postgres from the
 * Vercel Marketplace:
 *   Neon / Prisma Postgres → DATABASE_URL (+ DATABASE_URL_POOLED)
 *   Supabase               → POSTGRES_URL (pooled) + POSTGRES_URL_NON_POOLING (direct)
 *
 * One pool per function instance (Fluid Compute shares it across concurrent requests),
 * created lazily so builds and demo-only deployments never need a database.
 */
let pool: Pool | null = null;

type Env = Record<string, string | undefined>;

/** URL for request handling: pooled first. */
export function databaseUrl(env: Env = process.env): string | undefined {
  return env.DATABASE_URL_POOLED || env.DATABASE_URL || env.POSTGRES_URL || undefined;
}

/** URL for migrations: direct (non-pooled) first, since DDL is safest outside a transaction pooler. */
export function migrationUrl(env: Env = process.env): string | undefined {
  return env.DATABASE_URL || env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL || env.DATABASE_URL_POOLED || undefined;
}

export function workspaceEnabled(): boolean {
  return Boolean(databaseUrl());
}

/**
 * TLS stays verified. Providers whose certificates chain to their own CA (Supabase)
 * supply that CA via DATABASE_SSL_CA (PEM). The URL's sslmode is removed in that case,
 * because node-postgres lets URL parameters override the `ssl` option.
 */
export function poolConfig(url: string, env: Env = process.env): PoolConfig {
  const ca = env.DATABASE_SSL_CA?.replace(/\\n/g, '\n').trim();
  if (!ca) return { connectionString: url, max: 5 };
  const u = new URL(url);
  for (const p of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) u.searchParams.delete(p);
  return { connectionString: u.toString(), max: 5, ssl: { ca, rejectUnauthorized: true } };
}

export function getPool(): Pool {
  const url = databaseUrl();
  if (!url) throw new Error('No database configured (DATABASE_URL or POSTGRES_URL)');
  if (!pool) pool = new Pool(poolConfig(url));
  return pool;
}
