export interface LedgerExpense {
  id: number;
  date: string;
  item: string;
  person: string | null;
  note: string | null;
  price: number;
  delivery: number;
  commission: number;
  total: number;
  hasReceipt: boolean;
}

export interface LedgerYear {
  year: number;
  total: number;
  count: number;
  summarized: boolean;
  hasReceipt: boolean;
}

export interface LedgerPerson {
  name: string;
  total: number;
  count: number;
}

export interface ReportViewer {
  telegramId: number;
  viewedAt: string;
}

export interface PrivateReport {
  generatedAt: string | null;
  total: number;
  years: LedgerYear[];
  people: LedgerPerson[];
  expenses: LedgerExpense[];
}

export interface PrivateReportView extends PrivateReport {
  viewer: ReportViewer;
}

export interface LedgerImport {
  generatedAt?: string;
  years?: Array<{ year: number; summaryTotal?: number | null; hasReceipt?: boolean }>;
  expenses: Array<{
    date: string;
    item: string;
    person?: string | null;
    note?: string | null;
    price: number;
    delivery?: number;
    commission?: number;
    hasReceipt?: boolean;
  }>;
}
