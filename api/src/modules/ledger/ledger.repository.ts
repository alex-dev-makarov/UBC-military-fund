import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../shared/db';
import type {
  ExpenseFile,
  ExpenseFileKind,
  ExpenseField,
  ExpenseInput,
  StoredExpense,
  LedgerExpense,
  LedgerImport,
  LedgerPerson,
  LedgerYear,
  PrivateReport,
} from './ledger.types';

interface ExpenseRow {
  id: number;
  date: string;
  item: string;
  item_en: string | null;
  description: string | null;
  category: string | null;
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
        itemEn: text(row.itemEn),
        description: text(row.description),
        category: text(row.category),
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
      const categories = Object.entries(row.categories ?? {}).map(([category, value]) => {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          throw new Error(`years[${i}].categories.${category} must be a non-negative number`);
        }
        return { category, amount: value };
      });
      return { year: row.year, summary, hasReceipt: row.hasReceipt === true, categories };
    });

    const db = this.database.connection;
    db.exec('BEGIN');
    try {
      db.exec(
        'DELETE FROM private_expenses; DELETE FROM private_years; DELETE FROM private_year_categories; DELETE FROM private_meta;',
      );
      const insertYear = db.prepare(
        'INSERT INTO private_years (year, summary_total, has_receipt) VALUES (?, ?, ?)',
      );
      const insertYearCategory = db.prepare(
        'INSERT INTO private_year_categories (year, category, amount) VALUES (?, ?, ?)',
      );
      for (const y of years) {
        insertYear.run(y.year, y.summary, y.hasReceipt ? 1 : 0);
        for (const c of y.categories) insertYearCategory.run(y.year, c.category, c.amount);
      }

      const insertExpense = db.prepare(
        `INSERT INTO private_expenses
           (date, item, item_en, description, category, person, note, price, delivery, commission, has_receipt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const e of expenses) {
        insertExpense.run(
          e.date, e.item, e.itemEn, e.description, e.category, e.person, e.note,
          e.price, e.delivery, e.commission, e.hasReceipt ? 1 : 0,
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
    const yearCategories = db
      .prepare('SELECT year, category, amount FROM private_year_categories ORDER BY year, category')
      .all() as Array<{ year: number; category: string; amount: number }>;
    const rows = db
      .prepare('SELECT * FROM private_expenses ORDER BY date, id')
      .all() as unknown as ExpenseRow[];
    return {
      ...(meta ? { generatedAt: meta.value } : {}),
      years: years.map((y) => {
        const split = yearCategories.filter((c) => c.year === y.year);
        return {
          year: y.year,
          summaryTotal: y.summary_total,
          hasReceipt: y.has_receipt === 1,
          ...(split.length > 0
            ? { categories: Object.fromEntries(split.map((c) => [c.category, c.amount])) }
            : {}),
        };
      }),
      expenses: rows.map((r) => ({
        date: r.date,
        item: r.item,
        itemEn: r.item_en,
        description: r.description,
        category: r.category,
        person: r.person,
        note: r.note,
        price: r.price,
        delivery: r.delivery,
        commission: r.commission,
        hasReceipt: r.has_receipt === 1,
      })),
    };
  }

  private static readonly COLUMN: Record<ExpenseField, string> = {
    date: 'date',
    item: 'item',
    itemEn: 'item_en',
    description: 'description',
    category: 'category',
    person: 'person',
    note: 'note',
    price: 'price',
    delivery: 'delivery',
    commission: 'commission',
    hasReceipt: 'has_receipt',
  };

  private toStored(row: ExpenseRow): StoredExpense {
    return {
      id: row.id,
      date: row.date,
      item: row.item,
      itemEn: row.item_en,
      description: row.description,
      category: row.category,
      person: row.person,
      note: row.note,
      price: row.price,
      delivery: row.delivery,
      commission: row.commission,
      hasReceipt: row.has_receipt === 1,
      total: cents(row.price + row.delivery + row.commission),
    };
  }

  recent(limit = 10): StoredExpense[] {
    const rows = this.database.connection
      .prepare('SELECT * FROM private_expenses ORDER BY date DESC, id DESC LIMIT ?')
      .all(limit) as unknown as ExpenseRow[];
    return rows.map((row) => this.toStored(row));
  }

  get(id: number): StoredExpense | undefined {
    const row = this.database.connection.prepare('SELECT * FROM private_expenses WHERE id = ?').get(id) as
      | ExpenseRow
      | undefined;
    return row ? this.toStored(row) : undefined;
  }

  add(e: ExpenseInput): number {
    const { lastInsertRowid } = this.database.connection
      .prepare(
        `INSERT INTO private_expenses
           (date, item, item_en, description, category, person, note, price, delivery, commission, has_receipt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        e.date, e.item, e.itemEn, e.description, e.category, e.person, e.note,
        e.price, e.delivery, e.commission, e.hasReceipt ? 1 : 0,
      );
    this.touch();
    return Number(lastInsertRowid);
  }

  update<F extends ExpenseField>(id: number, field: F, value: ExpenseInput[F]): boolean {
    const stored: string | number | null = typeof value === 'boolean' ? (value ? 1 : 0) : (value as string | number | null);
    const { changes } = this.database.connection
      .prepare(`UPDATE private_expenses SET ${LedgerRepository.COLUMN[field]} = ? WHERE id = ?`)
      .run(stored, id);
    if (changes > 0) this.touch();
    return changes > 0;
  }

  remove(id: number): boolean {
    const db = this.database.connection;
    const { changes } = db.prepare('DELETE FROM private_expenses WHERE id = ?').run(id);
    db.prepare('DELETE FROM private_expense_files WHERE expense_id = ?').run(id);
    if (changes > 0) this.touch();
    return changes > 0;
  }

  addFile(expenseId: number, kind: ExpenseFileKind, name: string, url: string): void {
    this.database.connection
      .prepare('INSERT INTO private_expense_files (expense_id, kind, name, url, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(expenseId, kind, name, url, Date.now());
    if (kind === 'receipt') this.update(expenseId, 'hasReceipt', true);
  }

  files(expenseId: number): ExpenseFile[] {
    return this.database.connection
      .prepare('SELECT kind, name, url FROM private_expense_files WHERE expense_id = ? ORDER BY id')
      .all(expenseId) as unknown as ExpenseFile[];
  }

  people(): string[] {
    return (
      this.database.connection
        .prepare(
          `SELECT person FROM private_expenses WHERE person IS NOT NULL
            GROUP BY person ORDER BY count(*) DESC, person`,
        )
        .all() as Array<{ person: string }>
    ).map((row) => row.person);
  }

  categories(): string[] {
    return (
      this.database.connection.prepare('SELECT name_uk FROM fund_categories ORDER BY sort').all() as Array<{
        name_uk: string;
      }>
    ).map((row) => row.name_uk);
  }

  private touch(): void {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' });
    this.database.connection
      .prepare("INSERT OR REPLACE INTO private_meta (key, value) VALUES ('generatedAt', ?)")
      .run(today);
  }

  countUncategorized(): number {
    const row = this.database.connection
      .prepare(
        `SELECT count(*) AS c FROM private_expenses
          WHERE category IS NULL OR category NOT IN (SELECT name_uk FROM fund_categories)`,
      )
      .get() as { c: number };
    return row.c;
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
