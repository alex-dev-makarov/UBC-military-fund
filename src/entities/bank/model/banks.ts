import monoLogo from '@assets/bank-mono.webp'
import privatLogo from '@assets/bank-privat.webp'
import type { Bank } from './types'

export const banks: Bank[] = [
  {
    id: 'mono',
    nameKey: 'bank.mono.name',
    hintKey: 'bank.mono.hint',
    logo: monoLogo,
    wordmark: 'mono',
  },
  {
    id: 'privat',
    nameKey: 'bank.privat.name',
    hintKey: 'bank.privat.hint',
    logo: privatLogo,
    wordmark: 'П24',
  },
  {
    id: 'other',
    nameKey: 'bank.other.name',
    hintKey: 'bank.other.hint',
    wordmark: '',
  },
]

export const privatTransferUrl = (card: string) => {
  const payload = {
    form: { receiver: { source: 'manual', number: card.replace(/\s+/g, '') } },
  }
  return `https://next.privat24.ua/money-transfer/form/${encodeURIComponent(JSON.stringify(payload))}`
}
