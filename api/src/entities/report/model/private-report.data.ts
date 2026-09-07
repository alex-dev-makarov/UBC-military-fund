export const PRIVATE_REPORT_CANARY = 'UBC-PRIVATE-CANARY-7f3a1c9e42b8';

export interface PrivateDelivery {
  date: string;
  unit: string;
  region: string;
  item: string;
  amount: number;
}

export interface PrivatePending {
  item: string;
  amount: number;
  note: string;
}

export interface PrivateReport {
  canary: string;
  generatedAt: string;
  reserveUah: number;
  deliveries: PrivateDelivery[];
  pending: PrivatePending[];
  suppliers: Array<{ name: string; category: string; spentUah: number }>;
}

export const privateReport: PrivateReport = {
  canary: PRIVATE_REPORT_CANARY,
  generatedAt: '2026-09-06',
  reserveUah: 41320.5,

  deliveries: [
    {
      date: '2026-09-04',
      unit: '«Сокіл»',
      region: 'Донецька',
      item: 'Пікап Mitsubishi L200 — передано екіпажу',
      amount: 128000,
    },
    {
      date: '2026-08-22',
      unit: '«Граніт»',
      region: 'Запорізька',
      item: 'Тепловізійний приціл + 4 акумулятори',
      amount: 61400,
    },
    {
      date: '2026-08-09',
      unit: '«Сокіл»',
      region: 'Донецька',
      item: 'Комплект ремонту ходової, гума 4 шт.',
      amount: 23850,
    },
    {
      date: '2026-07-30',
      unit: '«Вишня»',
      region: 'Сумська',
      item: 'Генератор 5.5 кВт, кабель, стабілізатор',
      amount: 18600,
    },
  ],

  pending: [
    {
      item: 'Другий пікап для «Граніту»',
      amount: 195000,
      note: 'Зібрано 38% — авто підібрано, чекаємо на решту суми',
    },
    {
      item: 'Ремкомплект та зварювальні роботи',
      amount: 27000,
      note: 'Після повернення техніки з ротації',
    },
  ],

  suppliers: [
    { name: 'Автопідбір «Захід»', category: 'Авто', spentUah: 276880 },
    { name: 'ТехноСклад', category: 'Техніка та аксесуари', spentUah: 48438 },
    { name: 'Тактик-Про', category: 'Військові речі', spentUah: 36473 },
  ],
};
