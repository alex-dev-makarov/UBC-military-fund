import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../db';
import { SecurityLogService } from './security-log.service';

const setup = () => {
  const db = new DatabaseService({ get: () => ':memory:' } as never);
  db.onModuleInit();
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  return { db, log: new SecurityLogService(db) };
};

describe('SecurityLogService', () => {
  it('stores every event', () => {
    const { db, log } = setup();
    log.record('auth.login', { telegram_id: 5 });
    const row = db.connection.prepare('SELECT event, data FROM security_events').get() as { event: string; data: string };
    expect(row).toEqual({ event: 'auth.login', data: '{"telegram_id":5}' });
  });

  it('refuses updates and deletion of recent events at the database level', () => {
    const { db, log } = setup();
    log.record('auth.start');
    expect(() => db.connection.exec("UPDATE security_events SET event = 'x'")).toThrow(/append-only/);
    expect(() => db.connection.exec('DELETE FROM security_events')).toThrow(/30 days/);
  });

  it('purges only what is older than the cut-off', () => {
    const { db, log } = setup();
    db.connection.exec('DROP TRIGGER security_events_keep_recent');
    log.record('auth.start');
    expect(log.purgeBefore(0)).toBe(0);
    expect(log.purgeBefore(Date.now() + 1)).toBe(1);
  });
});
