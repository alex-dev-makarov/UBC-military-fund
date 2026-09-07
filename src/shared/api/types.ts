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

export interface PublicFund {
  jarUrl: string
  card: string
  regions: FundLoc[]
  categories: SpendCategory[]
  years: YearTotal[]
  months: Array<[number, number]>
  recent: SpendItem[]
}

export interface AuthUser {
  sub: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

export interface PrivateDelivery {
  date: string
  unit: string
  region: string
  item: string
  amount: number
}

export interface PrivatePending {
  item: string
  amount: number
  note: string
}

export interface PrivateSupplier {
  name: string
  category: string
  spentUah: number
}

export interface PrivateReport {
  canary: string
  generatedAt: string
  reserveUah: number
  deliveries: PrivateDelivery[]
  pending: PrivatePending[]
  suppliers: PrivateSupplier[]
}
