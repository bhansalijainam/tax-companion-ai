import { Pool } from 'pg';

/**
 * One pool per function instance (Fluid Compute shares it across concurrent requests).
 * Created lazily so builds and demo-only deployments never need DATABASE_URL.
 */
let pool: Pool | null = null;

export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL || undefined;
}

export function workspaceEnabled(): boolean {
  return Boolean(databaseUrl());
}

export function getPool(): Pool {
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL is not set');
  if (!pool) pool = new Pool({ connectionString: url, max: 5 });
  return pool;
}
