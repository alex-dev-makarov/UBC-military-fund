import type { Bank } from '../model/types'

const CardIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
    <path d="M2.5 10h19" />
  </svg>
)

interface Props {
  bank: Bank
  size?: 'md' | 'sm'
}

export function BankMark({ bank, size = 'md' }: Props) {
  const box = size === 'md' ? 'size-11' : 'size-9'
  const rounding = bank.id === 'mono' ? 'rounded-full' : bank.id === 'privat' ? 'rounded-[9px]' : 'rounded-xl'

  if (bank.logo) {
    return <img src={bank.logo} alt="" aria-hidden className={`${box} ${rounding} shrink-0 object-contain`} />
  }

  return (
    <i className={`${box} ${rounding} flex shrink-0 items-center justify-center bg-[var(--bank-accent)]`}>
      <CardIcon />
    </i>
  )
}

export function ReportMark({ size = 'md' }: { size?: 'md' | 'sm' }) {
  const box = size === 'md' ? 'size-11' : 'size-9'
  return (
    <i className={`${box} flex shrink-0 items-center justify-center rounded-xl bg-[var(--bank-accent)]`}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    </i>
  )
}
