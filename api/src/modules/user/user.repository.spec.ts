import { describe, expect, it } from 'vitest';
import { DatabaseService } from '../../infra/db';
import { UserRepository } from './user.repository';

function repo(): { users: UserRepository; db: DatabaseService } {
  const db = new DatabaseService({ get: () => ':memory:' } as never);
  db.onModuleInit();
  return { users: new UserRepository(db), db };
}

const rows = (db: DatabaseService, sql: string) => db.connection.prepare(sql).all();

describe('UserRepository.recordLogin', () => {
  it('stores the telegram id and nothing identifying', () => {
    const { users, db } = repo();
    users.recordLogin(5);

    const columns = (
      db.connection.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>
    ).map((c) => c.name);



    expect(columns).toEqual([
      'telegram_id',
      'first_seen_at',
      'last_login_at',
      'is_member',
      'membership_checked_at',
      'sessions_valid_after',
    ]);
  });

  it('inserts a new user and sets first_seen_at', () => {
    const { users, db } = repo();
    users.recordLogin(5);
    const [row] = rows(db, 'SELECT telegram_id, first_seen_at FROM users') as Array<{
      telegram_id: number;
      first_seen_at: number;
    }>;
    expect(row.telegram_id).toBe(5);
    expect(row.first_seen_at).toBeGreaterThan(0);
  });

  it('upserts on repeat login without creating a second row', () => {
    const { users, db } = repo();
    users.recordLogin(5);
    users.recordLogin(5);
    const allRows = rows(db, 'SELECT telegram_id FROM users');
    expect(allRows).toHaveLength(1);
    expect((allRows[0] as { telegram_id: number }).telegram_id).toBe(5);
  });

  it('preserves first_seen_at across logins', () => {
    const { users, db } = repo();
    users.recordLogin(5);
    const [before] = rows(db, 'SELECT first_seen_at FROM users') as Array<{ first_seen_at: number }>;

    const now = Date.now;
    Date.now = () => now() + 5_000;
    try {
      users.recordLogin(5);
    } finally {
      Date.now = now;
    }

    const [after] = rows(db, 'SELECT first_seen_at, last_login_at FROM users') as Array<{
      first_seen_at: number;
      last_login_at: number;
    }>;
    expect(after!.first_seen_at).toBe(before!.first_seen_at);
    expect(after!.last_login_at).toBeGreaterThan(after!.first_seen_at);
  });

  it('keeps separate rows per telegram id and finds them back', () => {
    const { users } = repo();
    users.recordLogin(5);
    users.recordLogin(6);

    expect(users.findById(5)?.telegram_id).toBe(5);
    expect(users.findById(6)?.telegram_id).toBe(6);
    expect(users.findById(7)).toBeUndefined();
  });
});

describe('UserRepository.setMembership', () => {
  it('caches a verdict for a user that has never logged in', () => {
    const { users } = repo();
    users.setMembership(9, true);
    expect(users.findById(9)?.is_member).toBe(1);
  });

  it('overwrites a previous verdict', () => {
    const { users } = repo();
    users.setMembership(9, true);
    users.setMembership(9, false);
    expect(users.findById(9)?.is_member).toBe(0);
  });
});

describe('UserRepository.revokeSessions', () => {
  it('invalidates tokens issued before the revocation, keeps later ones', () => {
    const { users } = repo();
    users.recordLogin(5);
    expect(users.isSessionRevoked(5, 1000)).toBe(false);

    users.revokeSessions(5, 2_000_500);
    expect(users.isSessionRevoked(5, 2_000_499)).toBe(true);
    expect(users.isSessionRevoked(5, 2_000_500)).toBe(true);
    expect(users.isSessionRevoked(5, 2_000_501)).toBe(false);
    expect(users.isSessionRevoked(6, 1)).toBe(false);
  });
});
