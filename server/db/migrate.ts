/**
 * Applies the Better Auth schema (users, sessions, organizations, members,
 * invitations) and the workspace schema. Idempotent.
 *
 *   npm run db:migrate        # uses DATABASE_URL (loads .env.local if present)
 *   npm run vercel-build      # Vercel: migrate if a database is configured, then build
 */
import { getMigrations } from 'better-auth/db/migration';
import pg from 'pg';

const { Pool } = pg;
type Pool = pg.Pool;
import { authOptions } from '../auth.js';
import { migrationUrl, poolConfig } from './pool.js';
import { SCHEMA_SQL } from './schema.js';

export async function applySchema(pool: Pool): Promise<void> {
  await pool.query(SCHEMA_SQL);
}

export async function migrateAll(pool: Pool): Promise<{ authTablesCreated: string[] }> {
  const { toBeCreated, runMigrations } = await getMigrations(authOptions(pool));
  await runMigrations();
  await applySchema(pool);
  return { authTablesCreated: toBeCreated.map((t) => t.table) };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
  try { process.loadEnvFile('.env.local'); } catch { /* optional */ }
  const url = migrationUrl();
  if (!url) {
    // On Vercel builds without a database (demo-only deployments) this is a no-op
    if (process.argv.includes('--if-configured')) {
      console.log('No database configured: skipping migrations (demo-only deployment).');
      process.exit(0);
    }
    console.error('No database configured: set DATABASE_URL (Neon) or POSTGRES_URL_NON_POOLING (Supabase).');
    process.exit(1);
  }
  const pool = new Pool(poolConfig(url));
  migrateAll(pool)
    .then((r) => console.log(`Migrated. Auth tables created this run: ${r.authTablesCreated.join(', ') || 'none'}`))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}
