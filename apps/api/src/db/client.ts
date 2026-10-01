import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from '../config';
import * as schema from './schema';

type Db = PostgresJsDatabase<typeof schema>;

// Dev builds run from src/db, bundled builds from dist/ — both resolve to apps/api/drizzle.
const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, here.endsWith('db') ? '../../drizzle' : '../drizzle');

async function connect(): Promise<Db> {
  if (config.databaseUrl) {
    const db = drizzlePostgres(postgres(config.databaseUrl, { max: 10 }), { schema });
    await migratePostgres(db, { migrationsFolder });
    return db;
  }
  // No DATABASE_URL: fall back to embedded PGlite so `pnpm dev` works without Docker or a
  // local Postgres. Its query builder is API-identical, so the cast keeps one Db type app-wide.
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  mkdirSync(config.pgliteDir, { recursive: true });
  const db = drizzle(new PGlite(config.pgliteDir), { schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as Db;
}

export const db = await connect();
