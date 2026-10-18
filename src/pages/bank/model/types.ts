import type { ReactNode } from 'react'
import type { Bank } from '@entities/bank'
import type { PublicFund } from '@shared/api'
import type { TKey, Translate } from '@shared/i18n'

export interface BankSlotContext {
  t: Translate
  fund: PublicFund
}

// One block of a bank page section. Each kind maps to exactly one piece of markup in BankPage.
// `rich` means the text is rendered through <Rich> (supports *bold* and {slot} tokens).
// `wrapClass` wraps the element in a <div className={wrapClass}> when set.
export type BankBlock =
  | { kind: 'note'; key: TKey; rich: boolean }
  | { kind: 'para'; key: TKey; rich: boolean }
  | { kind: 'foot'; key: TKey; rich: boolean }
  | { kind: 'divider'; key: TKey }
  | { kind: 'shot'; src: string; altKey: TKey }
  | { kind: 'copyCard'; trustKey: TKey; wrapClass?: string }
  | { kind: 'cta'; labelKey: TKey; href: (fund: PublicFund) => string; onClick: () => void; wrapClass?: string }
  | { kind: 'ctaNote'; key: TKey }
  | { kind: 'steps'; steps: BankStep[] }
  | { kind: 'slot'; render: (ctx: BankSlotContext) => ReactNode }

export interface BankStep {
  titleKey: TKey
  blocks: BankBlock[]
}

export interface BankPageConfig {
  bank: Bank
  titleKey: TKey
  monthly: BankBlock[]
  // null: no mode tabs, only `monthly` is shown.
  once: BankBlock[] | null
}
