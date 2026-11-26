/**
 * Applies the Better Auth schema (users, sessions, organizations, members,
 * invitations) and the workspace schema. Idempotent.
 *
 *   npm run db:migrate        # uses DATABASE_URL (loads .env.local if present)
 */
import { getMigrations } from 'better-auth/db/migration';
import { Pool } from 'pg';
import { authOptions } from '../auth';
import { SCHEMA_SQL } from './schema';

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
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  migrateAll(pool)
    .then((r) => console.log(`Migrated. Auth tables created this run: ${r.authTablesCreated.join(', ') || 'none'}`))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}
