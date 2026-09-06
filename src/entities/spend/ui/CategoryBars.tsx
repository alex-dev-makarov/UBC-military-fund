import { useEffect, useState } from 'react'
import type { SpendCategory } from '@shared/config'
import { useI18n } from '@shared/i18n'

export function CategoryBars({ categories, total }: { categories: SpendCategory[]; total: number }) {
  const [filled, setFilled] = useState(false)
  const { fmt, pick } = useI18n()

  useEffect(() => {
    const id = setTimeout(() => setFilled(true), 60)
    return () => clearTimeout(id)
  }, [])

  return (
    <div>
      {categories.map((category, position) => (
        <div
          key={category.color}
          className="border-b border-line py-2.5 last:border-0 last:pb-0 first:pt-0"
        >
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className="min-w-0 flex-1 text-sm font-semibold tracking-[-.01em]">
              {pick(category.name)}
            </span>
            <span className="num shrink-0 text-[13px] text-ink-2">{fmt.uah(category.amount)}</span>
            <span className="num w-[38px] shrink-0 text-right text-xs font-bold text-ink-3">
              {fmt.share(category.amount, total)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-[5px] bg-line">
            <i
              className="block h-full rounded-[5px] transition-[width] duration-700 ease-[cubic-bezier(.2,.8,.3,1)]"
              style={{
                width: filled ? `${((category.amount / total) * 100).toFixed(2)}%` : '0%',
                background: category.color,
                transitionDelay: `${position * 70}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
