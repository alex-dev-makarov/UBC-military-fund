
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';

const DB_PATH = process.env.UBC_DB ?? new URL('../api/data/ubc.sqlite', import.meta.url).pathname;

if (!existsSync(DB_PATH)) {
  console.error(`бази немає: ${DB_PATH}\nспершу підніми бекенд: API_HOST_PORT=3001 pnpm docker:up`);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
const columns = new Set(db.prepare('PRAGMA table_info(private_expenses)').all().map((c) => c.name));
if (!columns.has('category')) {
  console.error('у базі ще стара схема (немає колонки category). Онови образ: API_HOST_PORT=3001 pnpm docker:up');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const lines = rl[Symbol.asyncIterator]();
const ask = async (prompt) => {
  process.stdout.write(prompt);
  const { value, done } = await lines.next();
  if (done) {
    console.log('\nскасовано');
    process.exit(1);
  }
  return value.trim();
};

const today = new Date().toLocaleDateString('sv-SE');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (s) => ISO_DATE.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

async function askDate() {
  for (;;) {
    const v = (await ask(`Дата (РРРР-ММ-ДД) [${today}]: `)) || today;
    if (isRealDate(v)) return v;
    console.log('  формат: 2026-10-15');
  }
}

async function askText(prompt, { required = false } = {}) {
  for (;;) {
    const v = await ask(prompt);
    if (v || !required) return v || null;
    console.log('  обов\'язкове поле');
  }
}

async function askAmount(prompt, fallback) {
  for (;;) {
    const raw = await ask(fallback === undefined ? `${prompt}: ` : `${prompt} [${fallback}]: `);
    const v = raw === '' && fallback !== undefined ? fallback : Number(raw.replace(',', '.').replace(/\s/g, ''));
    if (raw !== '' || fallback !== undefined) {
      if (Number.isFinite(v) && v >= 0) return Math.round(v * 100) / 100;
    }
    console.log('  число ≥ 0, напр. 5000 або 1234.50');
  }
}

async function choose(prompt, options) {
  options.forEach((o, i) => console.log(`  ${i + 1}) ${o.label}`));
  for (;;) {
    const n = Number(await ask(`${prompt} [1-${options.length}]: `));
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1].value;
    console.log(`  введи номер від 1 до ${options.length}`);
  }
}

const categories = db.prepare('SELECT name_uk FROM fund_categories ORDER BY sort').all().map((r) => r.name_uk);
const people = db
  .prepare(
    `SELECT person, count(*) AS n FROM private_expenses
      WHERE person IS NOT NULL GROUP BY person ORDER BY n DESC, person`,
  )
  .all()
  .map((r) => r.person);

console.log('\nНова витрата. Enter — значення в [дужках].\n');

const date = await askDate();
const item = await askText('Назва українською (видно всім на сайті): ', { required: true });
const itemEn = await askText('Назва англійською [Enter — як українська]: ');

console.log('Категорія:');
const category = await choose('Номер', categories.map((c) => ({ label: c, value: c })));

console.log('Хто отримав:');
const NEW = Symbol('new');
let person = await choose('Номер', [
  ...people.map((p) => ({ label: p, value: p })),
  { label: 'нова людина…', value: NEW },
  { label: 'загальна витрата (без людини)', value: null },
]);
if (person === NEW) {
  person = await askText('Ім\'я (як писати й надалі): ', { required: true });
  if (people.some((p) => p.toLowerCase() === person.toLowerCase())) {
    person = people.find((p) => p.toLowerCase() === person.toLowerCase());
    console.log(`  вже є така людина — записую як «${person}»`);
  }
}

const price = await askAmount('Ціна, ₴');
const delivery = await askAmount('Доставка, ₴', 0);
const commission = await askAmount('Комісія банку, ₴', 0);
const hasReceipt = !/^(н|n)/i.test(await ask('Чек є? [Т/н]: '));
const note = await askText('Примітка лише для закритого звіту [Enter — без]: ');

const total = Math.round((price + delivery + commission) * 100) / 100;
console.log(`
  дата        ${date}
  назва       ${item}${itemEn ? ` / ${itemEn}` : ''}
  категорія   ${category}
  людина      ${person ?? '— (загальна)'}
  сума        ${total} ₴  (ціна ${price} + доставка ${delivery} + комісія ${commission})
  чек         ${hasReceipt ? 'є' : 'немає'}
  примітка    ${note ?? '—'}
`);

if (!/^(т|y|так|yes)$/i.test(await ask('Записати? [т/Н]: '))) {
  console.log('нічого не записано');
  process.exit(0);
}

db.exec('BEGIN');
try {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO private_expenses
         (date, item, item_en, category, person, note, price, delivery, commission, has_receipt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(date, item, itemEn, category, person, note, price, delivery, commission, hasReceipt ? 1 : 0);
  db.prepare("INSERT OR REPLACE INTO private_meta (key, value) VALUES ('generatedAt', ?)").run(today);
  db.exec('COMMIT');

  const year = date.slice(0, 4);
  const sums = db
    .prepare(
      `SELECT
         (SELECT round(sum(price + delivery + commission), 2) FROM private_expenses WHERE date LIKE ? || '-%') AS year_total,
         (SELECT round(sum(price + delivery + commission), 2) FROM private_expenses WHERE date LIKE ? || '-%' AND category = ?) AS category_total`,
    )
    .get(year, year, category);
  console.log(`\n✅ записано (id ${lastInsertRowid}). ${year}: ${sums.year_total} ₴ · «${category}» за ${year}: ${sums.category_total} ₴`);
  console.log('Перевір на http://localhost:5173, потім перенеси на prod (docs/telegram-auth.md → «Перенести на prod»).');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  rl.close();
  db.close();
}
