import type { ReactNode } from 'react'

const Arrow = () => (
  <svg viewBox="0 0 24 24" className="size-[17px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
)

export function CtaLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="cta" href={href} target="_blank" rel="noopener">
      {children}
      <Arrow />
    </a>
  )
}

export function CtaButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="cta" onClick={onClick}>
      {children}
      <Arrow />
    </button>
  )
}

export function CtaNote({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-center text-[12.5px] text-ink-3">{children}</p>
}
