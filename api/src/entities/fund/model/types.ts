export interface Loc {
  uk: string;
  en: string;
}

export interface SpendCategory {
  name: Loc;
  amount: number;
  color: string;
}

export interface YearTotal {
  year: string;
  amount: number;
}

export interface SpendItem {
  date: string;
  title: Loc;
  amount: number;
}

export interface PublicFund {
  jarUrl: string;
  card: string;
  regions: Loc[];
  categories: SpendCategory[];
  years: YearTotal[];

  months: Array<[number, number]>;
  recent: SpendItem[];
}
