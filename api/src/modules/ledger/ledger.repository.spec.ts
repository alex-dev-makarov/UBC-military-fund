import { describe, expect, it, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { runMigrations } from '../../infra/db/migrator';
import { LedgerRepository } from './ledger.repository';
import type { DatabaseService } from '../../infra/db';

const makeRepo = () => {
  const db = new DatabaseSync(':memory:');
  runMigrations(db, join(__dirname, '../../../migrations'));
  return new LedgerRepository({ connection: db } as unknown as DatabaseService);
};

describe('LedgerRepository', () => {
  let repo: LedgerRepository;
  beforeEach(() => {
    repo = makeRepo();
  });

  it('is empty before import', () => {
    expect(repo.getReport()).toEqual({ generatedAt: null, total: 0, years: [], people: [], expenses: [] });
  });

  it('aggregates years, people and commission', () => {
    repo.replaceAll({
      generatedAt: '2026-10-11',
      years: [{ year: 2025, summaryTotal: 100.5, hasReceipt: true }, { year: 2026 }],
      expenses: [
        { date: '2026-05-06', item: 'Item A', person: 'Person A', price: 1000, commission: 10, hasReceipt: true },
        { date: '2026-06-03', item: 'Item B', person: 'Person A', price: 500.4, hasReceipt: true },
        { date: '2026-09-02', item: 'Item C', person: null, price: 20, hasReceipt: false },
      ],
    });
    const report = repo.getReport();
    expect(report.generatedAt).toBe('2026-10-11');
    expect(report.years).toEqual([
      { year: 2025, total: 100.5, count: 0, summarized: true, hasReceipt: true },
      { year: 2026, total: 1530.4, count: 3, summarized: false, hasReceipt: false },
    ]);
    expect(report.total).toBe(1630.9);
    expect(report.people).toEqual([{ name: 'Person A', total: 1510.4, count: 2 }]);
    expect(report.expenses[0]!.item).toBe('Item C');
    expect(report.expenses.find((e) => e.item === 'Item A')!.total).toBe(1010);
  });

  it('replaces previous data and rejects invalid rows atomically', () => {
    repo.replaceAll({ expenses: [{ date: '2026-01-01', item: 'A', price: 1 }] });
    expect(() =>
      repo.replaceAll({ expenses: [{ date: '01.02', item: 'B', price: 2 }] }),
    ).toThrow(/YYYY-MM-DD/);
    expect(repo.getReport().expenses.map((e) => e.item)).toEqual(['A']);
    repo.replaceAll({ expenses: [{ date: '2026-02-01', item: 'B', price: 2 }] });
    expect(repo.getReport().expenses.map((e) => e.item)).toEqual(['B']);
  });

  it('exports exactly what replaceAll accepts (round trip)', () => {
    repo.replaceAll({
      generatedAt: '2026-10-11',
      years: [{ year: 2025, summaryTotal: 7, hasReceipt: true, categories: { 'Авто': 5, 'Інше': 2 } }],
      expenses: [
        {
          date: '2026-05-06', item: 'Item A', itemEn: 'Item A (en)', category: 'Авто',
          person: 'Person A', price: 1000, commission: 10, hasReceipt: true,
        },
      ],
    });
    const before = repo.getReport();
    const exported = repo.exportAll();
    expect(exported.years![0]!.categories).toEqual({ 'Авто': 5, 'Інше': 2 });
    expect(exported.expenses[0]).toMatchObject({ itemEn: 'Item A (en)', category: 'Авто' });
    const other = makeRepo();
    other.replaceAll(exported);
    expect(other.getReport()).toEqual(before);
    expect(other.exportAll()).toEqual(exported);
  });
});
