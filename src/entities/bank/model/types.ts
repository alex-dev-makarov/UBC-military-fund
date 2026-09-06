import type { TKey } from '@shared/i18n'

export type BankId = 'mono' | 'privat' | 'other'

export interface Bank {
  id: BankId
  nameKey: TKey
  hintKey: TKey
  logo?: string
  wordmark: string
}
