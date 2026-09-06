import { useState } from 'react'
import { useI18n } from '@shared/i18n'

const WIDTH = 320
const HEIGHT = 112
const PAD = 6

export function MonthlyChart({ months }: { months: Array<[number, number]> }) {
  const { t, fmt } = useI18n()
  const [active, setActive] = useState<number | null>(null)

  const values = months.map(([, value]) => value)
  const max = Math.max(...values) * 1.12
  const peak = Math.max(...values)
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const stepX = (WIDTH - PAD * 2) / (months.length - 1)
  const toY = (value: number) => HEIGHT - PAD - (value / max) * (HEIGHT - PAD * 2)

  const points = months.map(([, value], position) => ({
    x: PAD + position * stepX,
    y: toY(value),
  }))

  const line = points
    .map((point, position) => `${position ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join('')
  const area = `${line}L${WIDTH - PAD} ${HEIGHT - PAD}L${PAD} ${HEIGHT - PAD}Z`
  const averageY = toY(average)

  const edges = points.map((point, position) =>
    position === 0 ? 0 : (points[position - 1]!.x + point.x) / 2,
  )
  edges.push(WIDTH)

  const current = active === null ? null : months[active]
  const currentPoint = active === null ? null : points[active]

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={t('report.chart.alt')}
          className="block h-auto w-full overflow-visible"
        >
          <defs>
            <linearGradient id="spendArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4C5A3E" stopOpacity=".28" />
              <stop offset="100%" stopColor="#4C5A3E" stopOpacity="0" />
            </linearGradient>
          </defs>

          <line
            x1={PAD}
            x2={WIDTH - PAD}
            y1={averageY}
            y2={averageY}
            stroke="var(--color-ink-3)"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity=".55"
          />
          <text
            x={WIDTH - PAD}
            y={averageY - 4}
            textAnchor="end"
            className="fill-ink-3 text-[8px] font-medium"
          >
            {`${t('report.chart.average')} ${fmt.uah(average)}`}
          </text>

          <path d={area} fill="url(#spendArea)" />
          <path
            d={line}
            fill="none"
            stroke="#4C5A3E"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {currentPoint && (
            <line
              x1={currentPoint.x}
              x2={currentPoint.x}
              y1={currentPoint.y}
              y2={HEIGHT - PAD}
              stroke="#4C5A3E"
              strokeWidth="1"
              strokeDasharray="2 2"
              opacity=".5"
            />
          )}

          {points.map((point, position) => {
            const isPeak = months[position]?.[1] === peak
            const isActive = position === active
            return (
              <circle
                key={months[position]?.[0]}
                cx={point.x.toFixed(1)}
                cy={point.y.toFixed(1)}
                r={isActive ? 5 : isPeak ? 4 : 2.2}
                fill={isActive || isPeak ? '#4C5A3E' : '#fff'}
                stroke="#4C5A3E"
                strokeWidth="1.6"
                className="transition-[r] duration-150"
              />
            )
          })}
        </svg>

        <div className="absolute inset-0">
          {months.map(([month, amount], position) => (
            <button
              key={month}
              type="button"
              aria-label={`${fmt.monthLong(month)}, ${fmt.uah(amount)}`}
              aria-pressed={position === active}
              onClick={() => setActive((shown) => (shown === position ? null : position))}
              onPointerEnter={(event) => event.pointerType === 'mouse' && setActive(position)}
              onPointerLeave={(event) => event.pointerType === 'mouse' && setActive(null)}
              style={{
                left: `${(edges[position]! / WIDTH) * 100}%`,
                width: `${((edges[position + 1]! - edges[position]!) / WIDTH) * 100}%`,
              }}
              className="absolute inset-y-0 cursor-pointer rounded-md outline-none focus-visible:bg-[var(--bank-tint)]"
            />
          ))}
        </div>

        {current && currentPoint && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-center shadow-[0_6px_16px_-8px_rgb(26_29_26/.6)]"
            style={{
              left: `${(currentPoint.x / WIDTH) * 100}%`,
              top: `${(currentPoint.y / HEIGHT) * 100}%`,
              marginTop: -10,
              transform: `translateX(${active === 0 ? '-8px' : active === months.length - 1 ? 'calc(-100% + 8px)' : '-50%'}) translateY(-100%)`,
            }}
          >
            <span className="block text-[9px] font-medium uppercase tracking-[.12em] text-white/70">
              {fmt.monthLong(current[0])}
            </span>
            <span className="num block text-[13px] font-bold text-white">
              {fmt.uah(current[1])}
            </span>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex">
        {months.map(([month], position) => (
          <span
            key={month}
            className={`flex-1 text-center text-[10px] tracking-[-.02em] transition-colors ${
              position === active ? 'font-bold text-ink' : 'text-ink-3'
            }`}
          >
            {fmt.monthAxis(month)}
          </span>
        ))}
      </div>
    </div>
  )
}
