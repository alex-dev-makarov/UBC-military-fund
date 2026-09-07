import { describe, expect, it } from 'vitest';
import { DatabaseService } from '../../../shared/db';
import { FUND_SEED } from '../model/fund.seed';
import { FundRepository } from './fund.repository';

function repo(): { fund: FundRepository; db: DatabaseService } {
  const db = new DatabaseService({ get: () => ':memory:' } as never);
  db.onModuleInit();
  return { fund: new FundRepository(db), db };
}

describe('FundRepository.seedIfEmpty', () => {
  it('seeds an empty database and reports that it did', () => {
    const { fund } = repo();
    expect(fund.seedIfEmpty()).toBe(true);
    expect(fund.getPublicFund().card).toBe(FUND_SEED.card);
  });

  it('does not re-seed, and does not revert an edit made after seeding', () => {
    
    
    
    const { fund, db } = repo();
    fund.seedIfEmpty();
    db.connection.prepare("UPDATE fund_meta SET value = ? WHERE key = 'card'").run('0000 0000');

    expect(fund.seedIfEmpty()).toBe(false);
    expect(fund.getPublicFund().card).toBe('0000 0000');
  });

  it('does not duplicate rows when called twice', () => {
    const { fund } = repo();
    fund.seedIfEmpty();
    fund.seedIfEmpty();

    expect(fund.getPublicFund().regions).toHaveLength(FUND_SEED.regions.length);
  });
});

describe('FundRepository.getPublicFund', () => {
  it('round-trips the seed exactly', () => {
    
    
    const { fund } = repo();
    fund.seedIfEmpty();

    expect(fund.getPublicFund()).toEqual(FUND_SEED);
  });

  it('preserves curated order rather than falling back to insertion order', () => {
    const { fund, db } = repo();
    fund.seedIfEmpty();
    
    const total = FUND_SEED.regions.length;
    db.connection.prepare('UPDATE fund_regions SET sort = ? - sort').run(total - 1);

    const names = fund.getPublicFund().regions.map((r) => r.uk);
    expect(names).toEqual([...FUND_SEED.regions].reverse().map((r) => r.uk));
  });

  it('returns an empty fund rather than throwing when nothing is seeded', () => {
    const { fund } = repo();
    const empty = fund.getPublicFund();

    expect(empty.card).toBe('');
    expect(empty.regions).toEqual([]);
    expect(empty.recent).toEqual([]);
  });
});
