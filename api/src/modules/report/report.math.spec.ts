import { describe, expect, it } from 'vitest';
import type { LedgerExpense, LedgerYear, PrivateReport } from '../ledger';
import type { PublicFund } from '../fund';
import {
  allReceipts,
  categoriesTotal,
  derivePrivateReport,
  itemizedExpenses,
  itemizedYearsOf,
  monthTotals,
  peakMonth,
  summarizePublicFund,
  totalSpent,
} from './report.math';

const expense = (
  id: number,
  date: string,
  total: number,
  person: string | null = null,
  hasReceipt = true,
): LedgerExpense => ({
  id,
  date,
  item: `item-${id}`,
  person,
  note: null,
  price: total,
  delivery: 0,
  commission: 0,
  total,
  hasReceipt,
});

const year = (
  yearNumber: number,
  overrides: Partial<Omit<LedgerYear, 'year'>> = {},
): LedgerYear => ({ year: yearNumber, total: 0, count: 0, summarized: false, hasReceipt: true, ...overrides });

describe('totalSpent', () => {
  it('is zero for no years', () => {
    expect(totalSpent([])).toBe(0);
  });

  it('sums amounts left to right', () => {
    const years = [
      { year: '2023', amount: 0.1 },
      { year: '2024', amount: 0.2 },
      { year: '2025', amount: 0.3 },
    ];
    expect(totalSpent(years)).toBe(0.1 + 0.2 + 0.3);
  });
});

describe('categoriesTotal', () => {
  it('is zero for no categories', () => {
    expect(categoriesTotal([])).toBe(0);
  });

  it('sums category amounts', () => {
    const category = (amount: number) => ({ name: { uk: 'a', en: 'a' }, amount, color: '#000' });
    expect(categoriesTotal([category(10), category(2.5), category(0)])).toBe(12.5);
  });
});

describe('peakMonth', () => {
  it('returns [0, 0] for no months', () => {
    expect(peakMonth([])).toEqual([0, 0]);
  });

  it('returns [0, 0] when every month is zero', () => {
    expect(peakMonth([[1, 0], [2, 0], [3, 0]])).toEqual([0, 0]);
  });

  it('returns the month with the highest amount', () => {
    expect(peakMonth([[1, 5], [2, 50], [3, 20]])).toEqual([2, 50]);
  });

  it('keeps the first month on a tie', () => {
    expect(peakMonth([[1, 0], [4, 30], [7, 30], [9, 10]])).toEqual([4, 30]);
  });
});

describe('summarizePublicFund', () => {
  it('combines totals and peak month from the public fund', () => {
    const fund: PublicFund = {
      jarUrl: '',
      card: '',
      regions: [],
      need: null,
      recent: [],
      years: [{ year: '2025', amount: 40 }, { year: '2026', amount: 2 }],
      categories: [
        { name: { uk: 'a', en: 'a' }, amount: 40, color: '#000' },
        { name: { uk: 'b', en: 'b' }, amount: 2, color: '#111' },
      ],
      months: [[1, 2], [2, 40]],
    };

    expect(summarizePublicFund(fund)).toEqual({ totalSpent: 42, categoriesTotal: 42, peakMonth: [2, 40] });
  });
});

describe('allReceipts', () => {
  it('is true for no years, matching Array.every', () => {
    expect(allReceipts([])).toBe(true);
  });

  it('is false when any year lacks receipts', () => {
    expect(allReceipts([year(2024), year(2025, { hasReceipt: false })])).toBe(false);
  });
});

describe('itemizedYearsOf', () => {
  it('excludes summarized years and years with no items, keeping report order', () => {
    const years = [
      year(2022, { count: 0 }),
      year(2023, { summarized: true, total: 500 }),
      year(2024, { count: 2 }),
      year(2025, { count: 1 }),
    ];
    expect(itemizedYearsOf(years)).toEqual([2024, 2025]);
  });

  it('is empty when there are no years', () => {
    expect(itemizedYearsOf([])).toEqual([]);
  });
});

describe('itemizedExpenses', () => {
  it('keeps only expenses whose year is in the set, in input order', () => {
    const expenses = [expense(3, '2025-01-01', 1), expense(2, '2024-05-01', 2), expense(1, '2023-01-01', 3)];
    expect(itemizedExpenses(expenses, [2024, 2025]).map((e) => e.id)).toEqual([3, 2]);
  });

  it('returns nothing when there are no itemized years', () => {
    expect(itemizedExpenses([expense(1, '2025-01-01', 1)], [])).toEqual([]);
  });
});

describe('monthTotals', () => {
  it('sizes the series by the highest month of all expenses in the year', () => {
    const all = [expense(1, '2025-02-01', 10), expense(2, '2025-05-01', 5)];
    const result = monthTotals([all[0]], all, 2025);

    expect(result).toEqual([
      { month: 1, total: 0, count: 0 },
      { month: 2, total: 10, count: 1 },
      { month: 3, total: 0, count: 0 },
      { month: 4, total: 0, count: 0 },
      { month: 5, total: 0, count: 0 },
    ]);
  });

  it('accumulates total and count per month', () => {
    const all = [expense(1, '2025-03-01', 1.5), expense(2, '2025-03-09', 2.25), expense(3, '2025-01-02', 4)];
    expect(monthTotals(all, all, 2025)).toEqual([
      { month: 1, total: 4, count: 1 },
      { month: 2, total: 0, count: 0 },
      { month: 3, total: 3.75, count: 2 },
    ]);
  });

  it('ignores expenses in months beyond the range', () => {
    const all = [expense(1, '2025-02-01', 10)];
    const stray = [expense(2, '2025-05-01', 99)];
    expect(monthTotals(stray, all, 2025)).toEqual([
      { month: 1, total: 0, count: 0 },
      { month: 2, total: 0, count: 0 },
    ]);
  });

  it('ignores expenses from other years when sizing the range', () => {
    const all = [expense(1, '2024-11-01', 10), expense(2, '2025-02-01', 5)];
    expect(monthTotals([all[1]], all, 2025)).toHaveLength(2);
  });

  it('returns a single empty month when there are no expenses', () => {
    expect(monthTotals([], [], 2025)).toEqual([{ month: 1, total: 0, count: 0 }]);
  });

  it('returns a single empty month when the year is null', () => {
    const all = [expense(1, '2025-03-01', 10)];
    expect(monthTotals([], all, null)).toEqual([{ month: 1, total: 0, count: 0 }]);
  });
});

describe('derivePrivateReport', () => {
  // Expenses arrive in the repository order (date desc, id desc).
  const report: PrivateReport = {
    generatedAt: '2026-10-11',
    total: 0,
    years: [
      year(2022, { count: 0 }),
      year(2023, { summarized: true, total: 999, hasReceipt: true }),
      year(2024, { count: 3, total: 105, hasReceipt: true }),
      year(2025, { count: 2, total: 30, hasReceipt: false }),
    ],
    people: [
      { name: 'Ann', total: 10, count: 1 },
      { name: 'Bob', total: 20, count: 1 },
      { name: 'Cy', total: 45, count: 2 },
    ],
    expenses: [
      expense(4, '2025-03-02', 10, 'Ann', false),
      expense(3, '2025-01-15', 20, 'Bob', false),
      expense(2, '2024-12-01', 30, 'Ann'),
      expense(5, '2024-07-01', 5, 'Cy'),
      expense(1, '2024-02-10', 40, 'Cy'),
      expense(0, '2023-05-05', 999, 'Ann'),
    ],
  };

  it('derives receipts, itemized summary and monthly series', () => {
    const derived = derivePrivateReport(report);

    expect(derived.allReceipts).toBe(false);
    expect(derived.itemized).toEqual({
      years: [2024, 2025],
      total: 10 + 20 + 30 + 5 + 40,
      count: 5,
      average: 21,
      lastYear: 2025,
    });
    expect(derived.monthly).toEqual([
      { month: 1, total: 20, count: 1 },
      { month: 2, total: 0, count: 0 },
      { month: 3, total: 10, count: 1 },
    ]);
  });

  it('derives per-person series over the all-people month range', () => {
    const { monthlyByPerson } = derivePrivateReport(report);

    expect(monthlyByPerson).toEqual({
      Ann: [
        { month: 1, total: 0, count: 0 },
        { month: 2, total: 0, count: 0 },
        { month: 3, total: 10, count: 1 },
      ],
      Bob: [
        { month: 1, total: 20, count: 1 },
        { month: 2, total: 0, count: 0 },
        { month: 3, total: 0, count: 0 },
      ],
      Cy: [
        { month: 1, total: 0, count: 0 },
        { month: 2, total: 0, count: 0 },
        { month: 3, total: 0, count: 0 },
      ],
    });
  });

  it('falls back to a single empty month when no year is itemized', () => {
    const summarizedOnly: PrivateReport = {
      ...report,
      years: [year(2023, { summarized: true, total: 999 })],
      people: [{ name: 'Ann', total: 999, count: 1 }],
      expenses: [expense(0, '2023-05-05', 999, 'Ann')],
    };

    expect(derivePrivateReport(summarizedOnly)).toEqual({
      allReceipts: true,
      itemized: { years: [], total: 0, count: 0, average: 0, lastYear: null },
      monthly: [{ month: 1, total: 0, count: 0 }],
      monthlyByPerson: { Ann: [{ month: 1, total: 0, count: 0 }] },
    });
  });

  it('returns no per-person series when there are no people', () => {
    const empty: PrivateReport = { generatedAt: null, total: 0, years: [], people: [], expenses: [] };
    expect(derivePrivateReport(empty).monthlyByPerson).toEqual({});
  });
});
