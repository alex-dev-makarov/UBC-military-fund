import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../shared/db';
import { FUND_SEED } from '../model/fund.seed';
import type { Loc, PublicFund, SpendCategory, SpendItem, YearTotal } from '../model/types';

interface MetaRow {
  key: string;
  value: string;
}

const asRows = <T>(rows: unknown): T[] => rows as T[];

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
        'INSERT INTO fund_categories (name_uk, name_en, amount, color, sort) VALUES (?, ?, ?, ?, ?)',
      );
      FUND_SEED.categories.forEach((item, i) =>
        category.run(item.name.uk, item.name.en, item.amount, item.color, i),
      );

      const year = db.prepare('INSERT INTO fund_years (year, amount) VALUES (?, ?)');
      FUND_SEED.years.forEach((item) => year.run(item.year, item.amount));

      const month = db.prepare('INSERT INTO fund_months (month, amount) VALUES (?, ?)');
      FUND_SEED.months.forEach(([m, amount]) => month.run(m, amount));

      const recent = db.prepare(
        'INSERT INTO fund_recent (date, title_uk, title_en, amount, sort) VALUES (?, ?, ?, ?, ?)',
      );
      FUND_SEED.recent.forEach((item, i) =>
        recent.run(item.date, item.title.uk, item.title.en, item.amount, i),
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

    const categories = (
      db
        .prepare('SELECT name_uk, name_en, amount, color FROM fund_categories ORDER BY sort')
        .all() as Array<{ name_uk: string; name_en: string; amount: number; color: string }>
    ).map(
      (row): SpendCategory => ({
        name: { uk: row.name_uk, en: row.name_en },
        amount: row.amount,
        color: row.color,
      }),
    );

    const years = asRows<YearTotal>(
      db.prepare('SELECT year, amount FROM fund_years ORDER BY year').all(),
    );

    const months = (
      db.prepare('SELECT month, amount FROM fund_months ORDER BY month').all() as Array<{
        month: number;
        amount: number;
      }>
    ).map((row): [number, number] => [row.month, row.amount]);

    const recent = (
      db
        .prepare('SELECT date, title_uk, title_en, amount FROM fund_recent ORDER BY sort')
        .all() as Array<{ date: string; title_uk: string; title_en: string; amount: number }>
    ).map(
      (row): SpendItem => ({
        date: row.date,
        title: { uk: row.title_uk, en: row.title_en },
        amount: row.amount,
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
