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
  it('serves the seed with zero amounts before any expense exists', () => {
    const { fund } = repo();
    fund.seedIfEmpty();

    const empty = fund.getPublicFund();
    expect(empty.jarUrl).toBe(FUND_SEED.jarUrl);
    expect(empty.categories).toEqual(
      FUND_SEED.categories.map((c) => ({ name: c.name, color: c.color, amount: 0 })),
    );
    expect(empty.years).toEqual([]);
    expect(empty.months).toEqual([]);
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

describe('FundRepository.getPublicFund — computed from private_expenses', () => {
  function withLedger() {
    const { fund, db } = repo();
    fund.seedIfEmpty();
    const c = db.connection;
    c.prepare('INSERT INTO private_years (year, summary_total, has_receipt) VALUES (?, ?, 1)').run(2025, 1000.5);
    const split = c.prepare('INSERT INTO private_year_categories (year, category, amount) VALUES (?, ?, ?)');
    split.run(2025, 'Авто', 800.5);
    split.run(2025, 'Інше', 200);
    const add = c.prepare(
      `INSERT INTO private_expenses (date, item, item_en, category, person, note, price, delivery, commission, has_receipt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    );
    add.run('2025-06-01', 'Ignored', null, 'Авто', 'Secret Person', null, 999, 0, 0);
    add.run('2026-01-10', 'Ремонт авто', 'Car repair', 'Авто', 'Secret Person', 'позика', 100, 10, 0.25);
    add.run('2026-01-20', 'Ноутбук', null, 'Техніка та аксесуари', null, null, 300, 0, 0);
    add.run('2026-03-05', 'Без категорії', null, null, 'Secret Person', null, 50, 0, 0);
    add.run('2026-03-06', 'Опечатка', null, 'авто', null, null, 5, 0, 0);
    return fund;
  }

  it('takes summary years as is and sums itemised years incl. delivery and commission', () => {
    expect(withLedger().getPublicFund().years).toEqual([
      { year: '2025', amount: 1000.5 },
      { year: '2026', amount: 465.25 },
    ]);
  });

  it('builds monthly bars for the latest itemised year', () => {
    expect(withLedger().getPublicFund().months).toEqual([
      [1, 410.25],
      [3, 55],
    ]);
  });

  it('adds the summary-year split to categories and sends unknown ones to «Інше»', () => {
    const totals = Object.fromEntries(
      withLedger().getPublicFund().categories.map((c) => [c.name.uk, c.amount]),
    );
    expect(totals).toEqual({
      'Авто': 910.75,
      'Техніка та аксесуари': 300,
      'Військові речі': 0,
      'Інше': 255,
    });
  });

  it('lists recent expenses newest first, falling back to the Ukrainian title', () => {
    const recent = withLedger().getPublicFund().recent;
    expect(recent.map((r) => r.date)).toEqual(['2026-03-06', '2026-03-05', '2026-01-20', '2026-01-10']);
    expect(recent[2]!.title).toEqual({ uk: 'Ноутбук', en: 'Ноутбук' });
    expect(recent[3]).toEqual({ date: '2026-01-10', title: { uk: 'Ремонт авто', en: 'Car repair' }, amount: 110.25 });
  });

  it('caps recent at 10 rows', () => {
    const { fund, db } = repo();
    fund.seedIfEmpty();
    const add = db.connection.prepare(
      "INSERT INTO private_expenses (date, item, price) VALUES (?, 'x', 1)",
    );
    for (let d = 1; d <= 12; d += 1) add.run(`2026-02-${String(d).padStart(2, '0')}`);
    expect(fund.getPublicFund().recent).toHaveLength(10);
  });

  it('never exposes person or note', () => {
    const body = JSON.stringify(withLedger().getPublicFund());
    expect(body).not.toContain('Secret Person');
    expect(body).not.toContain('позика');
  });
});

describe('FundRepository.getPublicFund — current need', () => {
  const setMeta = (db: DatabaseService, values: Record<string, string>) => {
    const insert = db.connection.prepare('INSERT OR REPLACE INTO fund_meta (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(values)) insert.run(key, value);
  };

  it('is null when no need keys exist', () => {
    const { fund } = repo();
    fund.seedIfEmpty();
    expect(fund.getPublicFund().need).toBeNull();
  });

  it('returns the need when title and goal are valid', () => {
    const { fund, db } = repo();
    fund.seedIfEmpty();
    setMeta(db, { 'need.uk': 'тепловізор', 'need.en': 'thermal imager', 'need.goal': '85000' });
    expect(fund.getPublicFund().need).toEqual({
      title: { uk: 'тепловізор', en: 'thermal imager' },
      goal: 85000,
      deadline: null,
    });
  });

  it('falls back to the uk title when the en title is missing', () => {
    const { fund, db } = repo();
    fund.seedIfEmpty();
    setMeta(db, { 'need.uk': 'тепловізор', 'need.goal': '85000' });
    expect(fund.getPublicFund().need?.title).toEqual({ uk: 'тепловізор', en: 'тепловізор' });
  });

  it.each(['0', '-5', 'abc', '', '1e5', '0x10', '1.234'])('is null for goal %j', (goal) => {
    const { fund, db } = repo();
    fund.seedIfEmpty();
    setMeta(db, { 'need.uk': 'тепловізор', 'need.goal': goal });
    expect(fund.getPublicFund().need).toBeNull();
  });

  it.each([
    ['85 000', 85000],
    ['85\u00A0000', 85000],
    ['85\u202F000.50', 85000.5],
  ])('accepts goal %j with spaces', (goal, expected) => {
    const { fund, db } = repo();
    fund.seedIfEmpty();
    setMeta(db, { 'need.uk': 'тепловізор', 'need.goal': goal });
    expect(fund.getPublicFund().need?.goal).toBe(expected);
  });

  it('returns the deadline with an en fallback to uk', () => {
    const { fund, db } = repo();
    fund.seedIfEmpty();
    setMeta(db, { 'need.uk': 'тепловізор', 'need.goal': '85000', 'need.deadline.uk': 'до кінця жовтня' });
    expect(fund.getPublicFund().need?.deadline).toEqual({ uk: 'до кінця жовтня', en: 'до кінця жовтня' });

    setMeta(db, { 'need.deadline.en': 'by the end of October' });
    expect(fund.getPublicFund().need?.deadline?.en).toBe('by the end of October');
  });

  it('has no deadline when the text is blank', () => {
    const { fund, db } = repo();
    fund.seedIfEmpty();
    setMeta(db, { 'need.uk': 'тепловізор', 'need.goal': '85000', 'need.deadline.uk': '  ' });
    expect(fund.getPublicFund().need?.deadline).toBeNull();
  });

  it('is null when the title is blank', () => {
    const { fund, db } = repo();
    fund.seedIfEmpty();
    setMeta(db, { 'need.uk': '  ', 'need.goal': '85000' });
    expect(fund.getPublicFund().need).toBeNull();
  });
});
