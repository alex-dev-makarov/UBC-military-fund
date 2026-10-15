import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../shared/db';
import { FUND_SEED } from '../model/fund.seed';
import type { Loc, PublicFund, SpendCategory, SpendItem, YearTotal } from '../model/types';

interface MetaRow {
  key: string;
  value: string;
}

interface PublicExpenseRow {
  date: string;
  item: string;
  item_en: string | null;
  category: string | null;
  total: number;
}

const RECENT_LIMIT = 10;

const FALLBACK_CATEGORY = 'Інше';

const asRows = <T>(rows: unknown): T[] => rows as T[];
const cents = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class FundRepository {
  constructor(private readonly database: DatabaseService) {}

  seedIfEmpty(): boolean {
    const db = this.database.connection;
    const existing = db.prepare('SELECT count(*) AS c FROM fund_meta').get() as { c: number };
    if (existing.c > 0) return false;

    db.exec('BEGIN');
    try {
      const meta = db.prepare('INSERT INTO fund_meta (key, value) VALUES (?, ?)');
      meta.run('jarUrl', FUND_SEED.jarUrl);
      meta.run('card', FUND_SEED.card);

      const region = db.prepare(
        'INSERT INTO fund_regions (name_uk, name_en, sort) VALUES (?, ?, ?)',
      );
      FUND_SEED.regions.forEach((item, i) => region.run(item.uk, item.en, i));

      const category = db.prepare(
        'INSERT INTO fund_categories (name_uk, name_en, color, sort) VALUES (?, ?, ?, ?)',
      );
      FUND_SEED.categories.forEach((item, i) =>
        category.run(item.name.uk, item.name.en, item.color, i),
      );

      db.exec('COMMIT');
      return true;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  getPublicFund(): PublicFund {
    const db = this.database.connection;

    const meta = new Map(
      asRows<MetaRow>(db.prepare('SELECT key, value FROM fund_meta').all()).map((row) => [
        row.key,
        row.value,
      ]),
    );

    const regions = (
      db
        .prepare('SELECT name_uk, name_en FROM fund_regions ORDER BY sort')
        .all() as Array<{ name_uk: string; name_en: string }>
    ).map((row): Loc => ({ uk: row.name_uk, en: row.name_en }));

    const categoryRows = db
      .prepare('SELECT name_uk, name_en, color FROM fund_categories ORDER BY sort')
      .all() as Array<{ name_uk: string; name_en: string; color: string }>;


    const summarized = new Map(
      (
        db
          .prepare('SELECT year, summary_total FROM private_years WHERE summary_total IS NOT NULL')
          .all() as Array<{ year: number; summary_total: number }>
      ).map((row) => [String(row.year), row.summary_total]),
    );

    const expenses = (
      db
        .prepare(
          `SELECT date, item, item_en, category, price + delivery + commission AS total
             FROM private_expenses
            ORDER BY date DESC, id DESC`,
        )
        .all() as unknown as PublicExpenseRow[]
    ).filter((row) => !summarized.has(row.date.slice(0, 4)));

    const yearTotals = new Map<string, number>(summarized);
    for (const e of expenses) {
      const year = e.date.slice(0, 4);
      yearTotals.set(year, (yearTotals.get(year) ?? 0) + e.total);
    }
    const years = [...yearTotals]
      .map(([year, amount]): YearTotal => ({ year, amount: cents(amount) }))
      .sort((a, b) => a.year.localeCompare(b.year));


    const latestYear = expenses[0]?.date.slice(0, 4);
    const monthTotals = new Map<number, number>();
    for (const e of expenses) {
      if (e.date.slice(0, 4) !== latestYear) continue;
      const month = Number(e.date.slice(5, 7));
      monthTotals.set(month, (monthTotals.get(month) ?? 0) + e.total);
    }
    const months = [...monthTotals]
      .sort((a, b) => a[0] - b[0])
      .map(([month, amount]): [number, number] => [month, cents(amount)]);

    const known = new Set(categoryRows.map((row) => row.name_uk));
    const fallback = known.has(FALLBACK_CATEGORY)
      ? FALLBACK_CATEGORY
      : categoryRows[categoryRows.length - 1]?.name_uk;
    const categoryTotals = new Map<string, number>();
    const addToCategory = (name: string | null, amount: number) => {
      const key = name && known.has(name) ? name : fallback;
      if (key) categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + amount);
    };
    for (const e of expenses) addToCategory(e.category, e.total);
    for (const row of db
      .prepare('SELECT year, category, amount FROM private_year_categories')
      .all() as Array<{ year: number; category: string; amount: number }>) {
      if (summarized.has(String(row.year))) addToCategory(row.category, row.amount);
    }
    const categories = categoryRows.map(
      (row): SpendCategory => ({
        name: { uk: row.name_uk, en: row.name_en },
        amount: cents(categoryTotals.get(row.name_uk) ?? 0),
        color: row.color,
      }),
    );

    const recent = expenses.slice(0, RECENT_LIMIT).map(
      (row): SpendItem => ({
        date: row.date,
        title: { uk: row.item, en: row.item_en ?? row.item },
        amount: cents(row.total),
      }),
    );

    return {
      jarUrl: meta.get('jarUrl') ?? '',
      card: meta.get('card') ?? '',
      regions,
      categories,
      years,
      months,
      recent,
    };
  }
}
