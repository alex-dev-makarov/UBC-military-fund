import type { PublicFund } from '../fund';
import type { PrivateReportView } from '../ledger';

export interface MonthTotal {
  month: number;
  total: number;
  count: number;
}

export interface PublicSummary {
  totalSpent: number;
  categoriesTotal: number;
  peakMonth: [number, number];
}

export interface PublicFundReport extends PublicFund {
  summary: PublicSummary;
}

export interface ItemizedSummary {
  years: number[];
  total: number;
  count: number;
  average: number;
  lastYear: number | null;
}

export interface ReportDerived {
  allReceipts: boolean;
  itemized: ItemizedSummary;
  monthly: MonthTotal[];
  monthlyByPerson: Record<string, MonthTotal[]>;
}

export interface SecretReportView extends PrivateReportView {
  derived: ReportDerived;
}
