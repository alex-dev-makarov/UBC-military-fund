import type { ReactNode } from 'react'

interface Props {
  bank: 'mono' | 'privat' | 'other' | 'report'
  mark: ReactNode
  title: ReactNode
  hint: ReactNode
  onClick: () => void
}

export function BankRow({ bank, mark, title, hint, onClick }: Props) {
  return (
    <button
      type="button"
      data-bank={bank}
      onClick={onClick}
      className="tap relative flex w-full items-center gap-3.5 overflow-hidden rounded-[var(--bank-radius)] border border-line bg-gradient-to-r from-[var(--bank-tint)] to-card to-[62%] py-3.5 pl-[18px] pr-3.5 text-left shadow-[0_1px_2px_rgb(26_29_26/.05)] active:border-[var(--bank-soft)]"
    >
      <span className="absolute inset-y-0 left-0 w-[5px] bg-[var(--bank-bar)]" />
      {mark}
      <span className="min-w-0 flex-1">
        <strong className="block text-[16.5px] font-bold tracking-[-.015em] text-[var(--bank-accent)]">
          {title}
        </strong>
        <span className="mt-px block text-[12.5px] text-ink-3">{hint}</span>
      </span>
      <svg viewBox="0 0 24 24" className="size-[19px] shrink-0 text-[var(--bank-soft)]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  )
}
