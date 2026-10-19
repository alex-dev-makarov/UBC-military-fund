import type { LedgerExpense, LedgerYear, PrivateReport } from '../ledger';
import type { PublicFund, SpendCategory, YearTotal } from '../fund';
import type { ItemizedSummary, MonthTotal, PublicSummary, ReportDerived } from './report.types';

// Mirrors the frontend math in src/entities/spend/model/selectors.ts and
// src/widgets/report-view/ui/PrivateReport.tsx. Sums run left-to-right over the
// arrays as received so the JS double results are bit-identical to the frontend.

export const totalSpent = (years: readonly YearTotal[]): number =>
  years.reduce((sum, year) => sum + year.amount, 0);

export const categoriesTotal = (categories: readonly SpendCategory[]): number =>
  categories.reduce((sum, category) => sum + category.amount, 0);

export const peakMonth = (months: ReadonlyArray<[number, number]>): [number, number] =>
  months.reduce<[number, number]>((best, month) => (month[1] > best[1] ? month : best), [0, 0]);

export const summarizePublicFund = (fund: PublicFund): PublicSummary => ({
  totalSpent: totalSpent(fund.years),
  categoriesTotal: categoriesTotal(fund.categories),
  peakMonth: peakMonth(fund.months),
});

export const allReceipts = (years: readonly LedgerYear[]): boolean =>
  years.every((year) => year.hasReceipt);

// Report order is preserved (the repository sorts years ascending).
export const itemizedYearsOf = (years: readonly LedgerYear[]): number[] =>
  years.filter((year) => !year.summarized && year.count > 0).map((year) => year.year);

export const itemizedExpenses = (expenses: readonly LedgerExpense[], years: readonly number[]): LedgerExpense[] => {
  const set = new Set(years.map(String));
  return expenses.filter((e) => set.has(e.date.slice(0, 4)));
};

const isInYear = (expense: LedgerExpense, year: number | null): boolean =>
  year !== null && expense.date.startsWith(`${year}-`);

// `expenses` is expected to be pre-filtered to `year` by the caller (as the frontend does).
// `all` determines the number of months: max(1, month numbers of all expenses in `year`).
export const monthTotals = (
  expenses: readonly LedgerExpense[],
  all: readonly LedgerExpense[],
  year: number | null,
): MonthTotal[] => {
  const last = all.reduce(
    (max, e) => (isInYear(e, year) ? Math.max(max, Number(e.date.slice(5, 7))) : max),
    1,
  );
  const months: MonthTotal[] = Array.from({ length: last }, (_, i) => ({ month: i + 1, total: 0, count: 0 }));
  for (const e of expenses) {
    const m = months[Number(e.date.slice(5, 7)) - 1];
    if (!m) continue;
    m.total += e.total;
    m.count += 1;
  }
  return months;
};

export const derivePrivateReport = (report: PrivateReport): ReportDerived => {
  const years = itemizedYearsOf(report.years);
  const itemized = itemizedExpenses(report.expenses, years);
  const lastYear = years.at(-1) ?? null;
  const inLastYear = (expenses: readonly LedgerExpense[]): LedgerExpense[] =>
    expenses.filter((e) => isInYear(e, lastYear));

  const itemizedTotal = itemized.reduce((sum, e) => sum + e.total, 0);
  const itemizedSummary: ItemizedSummary = {
    years,
    total: itemizedTotal,
    count: itemized.length,
    average: itemized.length ? itemizedTotal / itemized.length : 0,
    lastYear,
  };

  const monthlyByPerson = Object.fromEntries(
    report.people.map((person): [string, MonthTotal[]] => [
      person.name,
      monthTotals(
        inLastYear(report.expenses.filter((e) => e.person === person.name)),
        report.expenses,
        lastYear,
      ),
    ]),
  );

  return {
    allReceipts: allReceipts(report.years),
    itemized: itemizedSummary,
    monthly: monthTotals(inLastYear(report.expenses), report.expenses, lastYear),
    monthlyByPerson,
  };
};
