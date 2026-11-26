// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { databaseUrl, migrationUrl, poolConfig } from './pool';

describe('database URL selection', () => {
  it('supports Neon / Prisma names, pooled first at runtime', () => {
    const env = { DATABASE_URL: 'postgres://direct', DATABASE_URL_POOLED: 'postgres://pooled' };
    expect(databaseUrl(env)).toBe('postgres://pooled');
    expect(migrationUrl(env)).toBe('postgres://direct');
  });

  it('supports Supabase names: pooled at runtime, direct for migrations', () => {
    const env = { POSTGRES_URL: 'postgres://pooler:6543', POSTGRES_URL_NON_POOLING: 'postgres://db:5432' };
    expect(databaseUrl(env)).toBe('postgres://pooler:6543');
    expect(migrationUrl(env)).toBe('postgres://db:5432');
  });

  it('reports no database for demo-only deployments', () => {
    expect(databaseUrl({})).toBeUndefined();
    expect(migrationUrl({})).toBeUndefined();
  });
});

describe('TLS', () => {
  it('leaves the URL alone when no CA is supplied', () => {
    expect(poolConfig('postgres://u:p@h:5432/db?sslmode=require', {})).toEqual({ connectionString: 'postgres://u:p@h:5432/db?sslmode=require', max: 5 });
  });

  it('verifies against a supplied CA and drops URL ssl params that would override it', () => {
    const cfg = poolConfig('postgres://u:p@h.pooler.supabase.com:6543/postgres?sslmode=require&x=1', { DATABASE_SSL_CA: '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----' });
    expect(cfg.ssl).toEqual({ ca: '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----', rejectUnauthorized: true });
    expect(cfg.connectionString).not.toContain('sslmode');
    expect(cfg.connectionString).toContain('x=1');
  });
});
