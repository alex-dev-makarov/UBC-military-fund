import { useState } from 'react'
import { useI18n } from '@shared/i18n'
import { locales } from '@shared/i18n'

export interface MonthTotal {
  month: number
  total: number
  count: number
}

const WIDTH = 320
const HEIGHT = 140
const TOP = 18
const LEFT = 30
const BAR = 18

const niceStep = (max: number) => {
  const raw = max / 2
  const power = 10 ** Math.floor(Math.log10(raw || 1))
  return Math.ceil(raw / power) * power
}

const barPath = (x: number, y: number, w: number, h: number) => {
  if (h <= 0) return ''
  const r = Math.min(4, h, w / 2)
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`
}

export function MonthlyBars({
  months,
  label,
  selected,
  onSelect,
}: {
  months: MonthTotal[]
  label: string
  selected: number | null
  onSelect: (month: number | null) => void
}) {
  const { t, fmt, lang } = useI18n()
  const [hovered, setHovered] = useState<number | null>(null)
  const selectedIndex = months.findIndex((m) => m.month === selected)
  const active = hovered ?? (selectedIndex >= 0 ? selectedIndex : null)

  const compact = new Intl.NumberFormat(locales[lang], { notation: 'compact', maximumFractionDigits: 0 })
  const peak = Math.max(0, ...months.map((m) => m.total))
  const step = niceStep(peak)
  const top = step * 2
  const plotH = HEIGHT - TOP
  const slot = (WIDTH - LEFT) / Math.max(months.length, 1)
  const width = Math.min(BAR, slot * 0.62)
  const toY = (value: number) => TOP + plotH - (value / (top || 1)) * plotH
  const peakIndex = months.findIndex((m) => m.total === peak && peak > 0)
  const current = hovered === null ? null : months[hovered]

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="block h-auto w-full overflow-visible">
          {[0, step, top].map((tick) => (
            <g key={tick}>
              <line x1={LEFT} x2={WIDTH} y1={toY(tick)} y2={toY(tick)} stroke="var(--color-line)" strokeWidth="1" />
              <text x={LEFT - 6} y={toY(tick) + 3} textAnchor="end" className="fill-ink-3 text-[8px]">
                {tick === 0 ? '0' : compact.format(tick)}
              </text>
            </g>
          ))}

          {months.map((m, i) => {
            const x = LEFT + i * slot + (slot - width) / 2
            const y = toY(m.total)
            const dimmed = active !== null && active !== i
            return (
              <path
                key={m.month}
                d={barPath(x, y, width, TOP + plotH - y)}
                fill={active === i ? 'var(--bank-accent)' : 'var(--bank-bar)'}
                opacity={dimmed ? 0.45 : 1}
                className="transition-opacity duration-150"
              />
            )
          })}

          {peakIndex >= 0 && active === null && (
            <text
              x={LEFT + peakIndex * slot + slot / 2}
              y={toY(peak) - 5}
              textAnchor="middle"
              className="num fill-ink-2 text-[8.5px] font-semibold"
            >
              {fmt.uah(peak)}
            </text>
          )}
        </svg>

        <div className="absolute inset-y-0 right-0" style={{ left: `${(LEFT / WIDTH) * 100}%` }}>
          <div className="flex h-full">
            {months.map((m, i) => (
              <button
                key={m.month}
                type="button"
                aria-label={`${fmt.monthLong(m.month)}: ${fmt.uah(m.total)}`}
                aria-pressed={selected === m.month}
                onClick={() => onSelect(selected === m.month ? null : m.month)}
                onPointerEnter={(event) => event.pointerType === 'mouse' && setHovered(i)}
                onPointerLeave={(event) => event.pointerType === 'mouse' && setHovered(null)}
                className="h-full flex-1 cursor-pointer rounded-md outline-none focus-visible:bg-[var(--bank-tint)]"
              />
            ))}
          </div>
        </div>

        {current && hovered !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-center shadow-[0_6px_16px_-8px_rgb(26_29_26/.6)]"
            style={{
              left: `${((LEFT + hovered * slot + slot / 2) / WIDTH) * 100}%`,
              top: `${(Math.min(toY(current.total), TOP + plotH - 4) / HEIGHT) * 100}%`,
              marginTop: -8,
              transform: `translateX(${hovered === 0 ? '-20%' : hovered === months.length - 1 ? '-80%' : '-50%'}) translateY(-100%)`,
            }}
          >
            <span className="block text-[9px] font-medium uppercase tracking-[.12em] text-white/70">
              {fmt.monthLong(current.month)}
            </span>
            <span className="num block text-[13px] font-bold text-white">{fmt.uah(current.total)}</span>
            <span className="block text-[10px] text-white/70">
              {current.count} {t(`private.unit.${fmt.pluralKey(current.count)}`)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex" style={{ paddingLeft: `${(LEFT / WIDTH) * 100}%` }}>
        {months.map((m, i) => (
          <span
            key={m.month}
            className={`flex-1 text-center text-[10px] tracking-[-.02em] ${active === i ? 'font-bold text-ink' : 'text-ink-3'}`}
          >
            {fmt.monthAxis(m.month)}
          </span>
        ))}
      </div>
    </div>
  )
}
