import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { runMigrations } from './migrator';

function dirWith(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ubc-migrations-'));
  for (const [name, sql] of Object.entries(files)) {
    writeFileSync(join(dir, name), sql);
  }
  return dir;
}

describe('runMigrations', () => {
  it('applies files in filename order, not directory order', () => {
    const db = new DatabaseSync(':memory:');
    const dir = dirWith({
      '0002_second.sql': 'CREATE TABLE b (id INTEGER PRIMARY KEY, a_id INTEGER REFERENCES a(id))',
      '0001_first.sql': 'CREATE TABLE a (id INTEGER PRIMARY KEY)',
    });

    
    
    expect(runMigrations(db, dir).applied).toEqual(['0001_first', '0002_second']);
  });

  it('applies nothing on a second run', () => {
    const db = new DatabaseSync(':memory:');
    const dir = dirWith({ '0001_a.sql': 'CREATE TABLE a (id INTEGER PRIMARY KEY)' });

    expect(runMigrations(db, dir).applied).toEqual(['0001_a']);
    
    
    expect(runMigrations(db, dir).applied).toEqual([]);
  });

  it('applies only the new file when one is added later', () => {
    const db = new DatabaseSync(':memory:');
    const dir = dirWith({ '0001_a.sql': 'CREATE TABLE a (id INTEGER PRIMARY KEY)' });
    runMigrations(db, dir);

    writeFileSync(join(dir, '0002_b.sql'), 'CREATE TABLE b (id INTEGER PRIMARY KEY)');
    expect(runMigrations(db, dir).applied).toEqual(['0002_b']);
  });

  it('rolls a failed migration back entirely and names the file', () => {
    const db = new DatabaseSync(':memory:');
    const dir = dirWith({
      '0001_broken.sql': 'CREATE TABLE ok (id INTEGER PRIMARY KEY); THIS IS NOT SQL;',
    });

    expect(() => runMigrations(db, dir)).toThrow(/0001_broken\.sql/);

    
    
    
    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ok'")
        .all() as Array<{ name: string }>
    ).length;
    expect(tables).toBe(0);
    expect(db.prepare('SELECT count(*) AS c FROM schema_migrations').get()).toEqual({ c: 0 });
  });

  it('retries a fixed migration successfully', () => {
    const db = new DatabaseSync(':memory:');
    const dir = dirWith({ '0001_x.sql': 'NOT SQL' });
    expect(() => runMigrations(db, dir)).toThrow();

    writeFileSync(join(dir, '0001_x.sql'), 'CREATE TABLE x (id INTEGER PRIMARY KEY)');
    expect(runMigrations(db, dir).applied).toEqual(['0001_x']);
  });

  it('ignores non-.sql files', () => {
    const db = new DatabaseSync(':memory:');
    const dir = dirWith({
      '0001_a.sql': 'CREATE TABLE a (id INTEGER PRIMARY KEY)',
      'README.md': 'not a migration',
    });

    expect(runMigrations(db, dir).applied).toEqual(['0001_a']);
  });
});
