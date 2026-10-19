import type { LedgerImport } from '../modules/ledger';

export const DEMO_LEDGER: LedgerImport = {
  generatedAt: '2026-10-01',
  years: [
    {
      year: 2025,
      summaryTotal: 50000,
      hasReceipt: true,
      categories: { 'Авто': 30000, 'Техніка та аксесуари': 12000, 'Військові речі': 8000 },
    },
    { year: 2026 },
  ],
  expenses: [
    { date: '2026-01-14', item: 'Спальник', itemEn: 'Sleeping bag', category: 'Військові речі', person: 'Іваненко', price: 3200, hasReceipt: true },
    { date: '2026-02-03', item: 'Ремонт авто', itemEn: 'Car repair', category: 'Авто', person: 'Петренко', price: 12500, hasReceipt: true },
    { date: '2026-03-18', item: 'Павербанк', itemEn: 'Power bank', category: 'Техніка та аксесуари', person: 'Коваль', price: 2400, delivery: 120, hasReceipt: true },
    { date: '2026-04-09', item: 'Збір на авто', itemEn: 'Fundraiser for a car', category: 'Авто', person: 'Петренко', price: 20000, hasReceipt: true },
    { date: '2026-05-22', item: 'Рація', itemEn: 'Radio', category: 'Техніка та аксесуари', person: 'Шевчук', price: 8700, commission: 50, hasReceipt: true },
    { date: '2026-06-30', item: 'Ремонт авто', itemEn: 'Car repair', category: 'Авто', person: 'Іваненко', price: 6400, note: 'позика', hasReceipt: true },
    { date: '2026-07-12', item: 'Домен (рік)', itemEn: 'Domain (1 year)', category: 'Інше', person: null, price: 500, hasReceipt: true },
    { date: '2026-08-25', item: 'Ноутбук', itemEn: 'Laptop', category: 'Техніка та аксесуари', person: 'Бондар', price: 25000, hasReceipt: false },
    { date: '2026-09-15', item: 'Ремонт авто', itemEn: 'Car repair', category: 'Авто', person: 'Петренко', price: 9100, hasReceipt: true },
  ],
};
