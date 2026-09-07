import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

export interface MigrationResult {
  applied: string[];
  alreadyApplied: number;
}

function findMigrationsDir(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, 'migrations');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not locate a "migrations" directory above ${start}`);
}

export function runMigrations(db: DatabaseSync, migrationsDir?: string): MigrationResult {
  const dir = migrationsDir ?? findMigrationsDir(__dirname);

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT    PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: string }>).map(
      (row) => row.version,
    ),
  );

  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const justApplied: string[] = [];

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    if (applied.has(version)) continue;

    const sql = readFileSync(join(dir, file), 'utf8');

    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        version,
        Date.now(),
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');

      throw new Error(
        `Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    justApplied.push(version);
  }

  return { applied: justApplied, alreadyApplied: applied.size };
}
