import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../shared/db';
import type {
  LedgerExpense,
  LedgerImport,
  LedgerPerson,
  LedgerYear,
  PrivateReport,
} from '../model/types';

interface ExpenseRow {
  id: number;
  date: string;
  item: string;
  person: string | null;
  note: string | null;
  price: number;
  delivery: number;
  commission: number;
  has_receipt: number;
}

interface YearRow {
  year: number;
  summary_total: number | null;
  has_receipt: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const cents = (value: number) => Math.round(value * 100) / 100;
const amount = (value: unknown, field: string, index: number): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`expenses[${index}].${field} must be a non-negative number`);
  }
  return value;
};
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

@Injectable()
export class LedgerRepository {
  constructor(private readonly database: DatabaseService) {}

  replaceAll(source: LedgerImport): { years: number; expenses: number } {
    if (!source || !Array.isArray(source.expenses)) {
      throw new Error('ledger must have an "expenses" array');
    }
    const expenses = source.expenses.map((row, i) => {
      if (typeof row.date !== 'string' || !ISO_DATE.test(row.date)) {
        throw new Error(`expenses[${i}].date must be YYYY-MM-DD`);
      }
      const item = text(row.item);
      if (!item) throw new Error(`expenses[${i}].item is required`);
      const price = amount(row.price, 'price', i);
      return {
        date: row.date,
        item,
        person: text(row.person),
        note: text(row.note),
        price,
        delivery: amount(row.delivery, 'delivery', i),
        commission: amount(row.commission, 'commission', i),
        hasReceipt: row.hasReceipt === true,
      };
    });
    const years = (source.years ?? []).map((row, i) => {
      if (!Number.isInteger(row.year)) throw new Error(`years[${i}].year must be an integer`);
      const summary =
        row.summaryTotal === undefined || row.summaryTotal === null
          ? null
          : amount(row.summaryTotal, 'summaryTotal', i);
      return { year: row.year, summary, hasReceipt: row.hasReceipt === true };
    });

    const db = this.database.connection;
    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM private_expenses; DELETE FROM private_years; DELETE FROM private_meta;');
      const insertYear = db.prepare(
        'INSERT INTO private_years (year, summary_total, has_receipt) VALUES (?, ?, ?)',
      );
      for (const y of years) insertYear.run(y.year, y.summary, y.hasReceipt ? 1 : 0);

      const insertExpense = db.prepare(
        `INSERT INTO private_expenses
           (date, item, person, note, price, delivery, commission, has_receipt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const e of expenses) {
        insertExpense.run(
          e.date, e.item, e.person, e.note, e.price, e.delivery, e.commission, e.hasReceipt ? 1 : 0,
        );
      }
      if (source.generatedAt) {
        db.prepare('INSERT INTO private_meta (key, value) VALUES (?, ?)').run(
          'generatedAt',
          String(source.generatedAt),
        );
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return { years: years.length, expenses: expenses.length };
  }

  exportAll(): LedgerImport {
    const db = this.database.connection;
    const meta = db
      .prepare("SELECT value FROM private_meta WHERE key = 'generatedAt'")
      .get() as { value: string } | undefined;
    const years = db.prepare('SELECT * FROM private_years ORDER BY year').all() as unknown as YearRow[];
    const rows = db
      .prepare('SELECT * FROM private_expenses ORDER BY date, id')
      .all() as unknown as ExpenseRow[];
    return {
      ...(meta ? { generatedAt: meta.value } : {}),
      years: years.map((y) => ({ year: y.year, summaryTotal: y.summary_total, hasReceipt: y.has_receipt === 1 })),
      expenses: rows.map((r) => ({
        date: r.date,
        item: r.item,
        person: r.person,
        note: r.note,
        price: r.price,
        delivery: r.delivery,
        commission: r.commission,
        hasReceipt: r.has_receipt === 1,
      })),
    };
  }

  getReport(): PrivateReport {
    const db = this.database.connection;
    const rows = db
      .prepare('SELECT * FROM private_expenses ORDER BY date DESC, id DESC')
      .all() as unknown as ExpenseRow[];
    const yearRows = db
      .prepare('SELECT * FROM private_years ORDER BY year')
      .all() as unknown as YearRow[];
    const meta = db
      .prepare("SELECT value FROM private_meta WHERE key = 'generatedAt'")
      .get() as { value: string } | undefined;

    const expenses: LedgerExpense[] = rows.map((row) => ({
      id: row.id,
      date: row.date,
      item: row.item,
      person: row.person,
      note: row.note,
      price: row.price,
      delivery: row.delivery,
      commission: row.commission,
      total: cents(row.price + row.delivery + row.commission),
      hasReceipt: row.has_receipt === 1,
    }));

    const byYear = new Map<number, LedgerYear>();
    for (const y of yearRows) {
      byYear.set(y.year, {
        year: y.year,
        total: y.summary_total ?? 0,
        count: 0,
        summarized: y.summary_total !== null,
        hasReceipt: y.has_receipt === 1,
      });
    }
    for (const e of expenses) {
      const year = Number(e.date.slice(0, 4));
      const entry =
        byYear.get(year) ??
        byYear.set(year, { year, total: 0, count: 0, summarized: false, hasReceipt: true }).get(year)!;
      if (entry.summarized) continue;
      entry.total = cents(entry.total + e.total);
      entry.count += 1;
    }
    for (const entry of byYear.values()) {
      if (!entry.summarized && entry.count > 0) {
        entry.hasReceipt = expenses
          .filter((e) => e.date.startsWith(`${entry.year}-`))
          .every((e) => e.hasReceipt);
      }
    }
    const years = [...byYear.values()]
      .filter((y) => y.summarized || y.count > 0)
      .sort((a, b) => a.year - b.year);

    const people = new Map<string, LedgerPerson>();
    for (const e of expenses) {
      if (!e.person) continue;
      const p = people.get(e.person) ?? { name: e.person, total: 0, count: 0 };
      p.total = cents(p.total + e.total);
      p.count += 1;
      people.set(e.person, p);
    }

    return {
      generatedAt: meta?.value ?? null,
      total: cents(years.reduce((sum, y) => sum + y.total, 0)),
      years,
      people: [...people.values()].sort((a, b) => b.total - a.total),
      expenses,
    };
  }
}
