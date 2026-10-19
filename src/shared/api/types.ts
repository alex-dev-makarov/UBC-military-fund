export interface FundLoc {
  uk: string
  en: string
}

export interface SpendCategory {
  name: FundLoc
  amount: number
  color: string
}

export interface YearTotal {
  year: string
  amount: number
}

export interface SpendItem {
  date: string
  title: FundLoc
  amount: number
}

export interface JarBalance {
  amount: number | null
  name: string | null
}

export interface UsdRate {
  usdRate: number | null
}

export interface PublicFund {
  jarUrl: string
  card: string
  regions: FundLoc[]
  categories: SpendCategory[]
  years: YearTotal[]
  months: Array<[number, number]>
  recent: SpendItem[]
  need: { title: FundLoc; goal: number; deadline: FundLoc | null } | null
}

export interface AuthUser {
  sub: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

export interface LedgerExpense {
  id: number
  date: string
  item: string
  person: string | null
  note: string | null
  price: number
  delivery: number
  commission: number
  total: number
  hasReceipt: boolean
}

export interface LedgerYear {
  year: number
  total: number
  count: number
  summarized: boolean
  hasReceipt: boolean
}

export interface LedgerPerson {
  name: string
  total: number
  count: number
}

export interface PrivateReport {
  viewer: {
    telegramId: number
    viewedAt: string
  }
  generatedAt: string | null
  total: number
  years: LedgerYear[]
  people: LedgerPerson[]
  expenses: LedgerExpense[]
}
