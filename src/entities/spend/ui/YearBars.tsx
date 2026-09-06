import { useEffect, useState } from 'react'
import type { YearTotal } from '@shared/config'
import { useI18n } from '@shared/i18n'

export function YearBars({ years }: { years: YearTotal[] }) {
  const [filled, setFilled] = useState(false)
  const { fmt } = useI18n()

  useEffect(() => {
    const id = setTimeout(() => setFilled(true), 60)
    return () => clearTimeout(id)
  }, [])

  const max = Math.max(...years.map((year) => year.amount))

  return (
    <div className="mt-4 flex gap-2.5">
      {years.map((year, position) => (
        <div key={year.year} className="flex-1 rounded-xl bg-[var(--bank-tint)] px-3 py-2.5">
          <span className="num block text-[10.5px] font-bold tracking-[.1em] text-ink-3">
            {year.year}
          </span>

          <span className="num mt-0.5 block text-[15px] font-bold tracking-[-.02em]">
            {fmt.uah(year.amount)}
          </span>

          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line">
            <i
              className="block h-full rounded-full bg-[var(--bank-bar)] transition-[width] duration-700 ease-[cubic-bezier(.2,.8,.3,1)]"
              style={{
                width: filled ? `${((year.amount / max) * 100).toFixed(2)}%` : '0%',
                transitionDelay: `${position * 70}ms`,
              }}
            />
          </span>
        </div>
      ))}
    </div>
  )
}
