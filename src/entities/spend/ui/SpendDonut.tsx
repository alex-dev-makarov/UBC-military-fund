import { useEffect, useState } from 'react'
import type { SpendCategory } from '@shared/api'
import { useI18n } from '@shared/i18n'

const SIZE = 132
const STROKE = 17
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP = 3

interface Props {
  categories: SpendCategory[]
  total: number
}

export function SpendDonut({ categories, total }: Props) {
  const [filled, setFilled] = useState(false)
  const { t, fmt, pick } = useI18n()

  useEffect(() => {
    const id = setTimeout(() => setFilled(true), 60)
    return () => clearTimeout(id)
  }, [])

  let offset = 0
  const segments = categories.map((category) => {
    const length = (category.amount / total) * CIRCUMFERENCE
    const segment = { category, length: Math.max(length - GAP, 1), offset }
    offset += length
    return segment
  })

  const summary = categories
    .map((category) => `${pick(category.name)} ${fmt.share(category.amount, total)}`)
    .join(', ')

  return (
    <div className="flex justify-center pb-1">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={summary} className="block">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={STROKE}
          />
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {segments.map(({ category, length, offset: start }, position) => (
              <circle
                key={category.color}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={category.color}
                strokeWidth={STROKE}
                strokeDasharray={`${filled ? length : 0} ${CIRCUMFERENCE}`}
                strokeDashoffset={-start}
                className="transition-[stroke-dasharray] duration-700 ease-[cubic-bezier(.2,.8,.3,1)]"
                style={{ transitionDelay: `${position * 70}ms` }}
              />
            ))}
          </g>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] font-medium uppercase tracking-[.14em] text-ink-3">
            {t('report.donut.center')}
          </span>
          <span className="num mt-0.5 text-[15px] font-extrabold tracking-[-.02em]">
            {fmt.uah(total)}
          </span>
        </div>
      </div>
    </div>
  )
}
