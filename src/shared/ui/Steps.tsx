import type { ReactNode } from 'react'

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="m-0 list-none p-0">{children}</ol>
}

interface StepProps {
  index: number
  title: string
  last?: boolean
  children: ReactNode
}

export function Step({ index, title, last = false, children }: StepProps) {
  return (
    <li className={`relative pl-[42px] ${last ? '' : 'pb-5'}`}>
      <span className="absolute left-0 top-0 flex h-6 w-[29px] items-center justify-center rounded-md bg-[var(--bank-accent)] text-xs font-semibold text-white num">
        {String(index).padStart(2, '0')}
      </span>
      {!last && <span className="absolute bottom-[5px] left-[14px] top-[29px] w-px bg-line" />}
      <h3 className="mb-1.5 mt-px text-[15.5px] font-bold tracking-[-.015em]">{title}</h3>
      <div className="space-y-1.5 text-sm text-ink-2">{children}</div>
    </li>
  )
}

export function Shot({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="mt-3 block w-full rounded-[14px] border border-line bg-white"
    />
  )
}
