import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`surface p-5 ${className}`}>{children}</div>
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 rounded-xl bg-[var(--bank-tint)] px-3.5 py-3 text-sm">{children}</p>
  )
}

export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-4 flex items-center gap-3 text-[10px] font-medium tracking-[.18em] text-ink-3 uppercase">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

export function Foot({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 border-t border-line pt-4 text-[12.5px] text-ink-3">{children}</p>
  )
}
