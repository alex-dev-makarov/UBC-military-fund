import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useT } from '@shared/i18n'

interface ScreenProps {
  bank?: 'mono' | 'privat' | 'other' | 'report'
  children: ReactNode
}

export function Screen({ bank, children }: ScreenProps) {
  return (
    <section data-bank={bank} className="animate-[rise_.3s_cubic-bezier(.2,.8,.3,1)]">
      {children}
    </section>
  )
}

export function BackButton({ label }: { label?: string }) {
  const navigate = useNavigate()
  const t = useT()

  return (
    <button
      type="button"
      onClick={() => navigate('/')}
      className="tap mb-3.5 inline-flex min-h-12 items-center gap-2.5 rounded-xl border border-line bg-card px-4 pl-3 text-[14.5px] font-bold text-ink active:bg-[var(--bank-tint)]"
    >
      <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="var(--bank-soft)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M11 6l-6 6 6 6" />
      </svg>
      {label ?? t('common.back.bank')}
    </button>
  )
}

interface CrumbProps {
  mark: ReactNode
  title: string
}

export function Crumb({ mark, title }: CrumbProps) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      {mark}
      <h2 className="text-[21px] font-extrabold tracking-[-.02em]">{title}</h2>
    </div>
  )
}
