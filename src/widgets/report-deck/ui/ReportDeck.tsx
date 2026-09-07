import camo from '@assets/camo.svg'
import { categoriesTotal, totalSpent } from '@entities/spend'
import { LangSwitch } from '@features/switch-lang'
import { useFund } from '@entities/fund'
import { useI18n, type Fmt, type Translate } from '@shared/i18n'
import type { PublicFund } from '@shared/api'
import { useCarousel } from '@shared/lib'

interface Slide {
  key: string
  label: string
  value: string
  caption?: string
  chips?: string[]
  bars?: Array<{ width: string; color: string }>
  swatch?: string
}

function buildSlides(
  fund: PublicFund,
  t: Translate,
  fmt: Fmt,
  pick: (loc: { uk: string; en: string }) => string,
) {
  const total = totalSpent(fund)
  const catTotal = categoriesTotal(fund)
  const count = fund.regions.length

  const slides: Slide[] = [
    {
      key: 'total',
      label: t('deck.total.label'),
      value: fmt.uahExact(total),
      caption: t('deck.total.caption'),
      bars: fund.categories.map((category) => ({
        width: `${((category.amount / catTotal) * 100).toFixed(2)}%`,
        color: category.color,
      })),
    },
    {
      key: 'regions',
      label: t('deck.regions.label'),
      value: `${count} ${t(`deck.regions.unit.${fmt.pluralKey(count)}`)}`,
      chips: fund.regions.map(pick),
    },
    ...fund.categories.map((category) => ({
      key: category.color,
      label: pick(category.name),
      value: fmt.uah(category.amount),
      caption: t('deck.category.caption', { share: fmt.share(category.amount, catTotal) }),
      swatch: category.color,
      bars: [{ width: `${((category.amount / catTotal) * 100).toFixed(2)}%`, color: category.color }],
    })),
  ]

  return slides
}

export function ReportDeck() {
  const { t, fmt, pick } = useI18n()
  const fund = useFund()
  const slides = buildSlides(fund, t, fmt, pick)
  const { index, drag, select, handlers } = useCarousel({ count: slides.length })

  return (
    <header className="relative mb-5.5 w-screen bg-ink pb-2.5" style={{ marginLeft: 'calc(50% - 50vw)' }}>
      <div className="h-[5px] w-full" style={{ backgroundImage: `url(${camo})`, backgroundSize: '52px 52px' }} />

      <div className="pointer-events-none absolute inset-x-0 top-[5px] z-10 mx-auto flex max-w-[468px] justify-end px-2.5 pt-2">
        <LangSwitch className="pointer-events-auto" />
      </div>

      <div
        className="relative mx-auto max-w-[468px] touch-pan-y overflow-hidden"
        style={{ contain: 'layout paint' }}
        {...handlers}
      >
        <div className="grid [grid-template-areas:'stack']">
          {slides.map((slide, position) => (
            <div
              key={slide.key}
              aria-hidden={position !== index}
              className="self-start px-4 pb-3 pt-3.5 [grid-area:stack] will-change-transform"
              style={{
                transform: `translate3d(calc(${(position - index) * 100}% + ${drag}px), 0, 0)`,
                transition: drag ? 'none' : 'transform .42s cubic-bezier(.25,.8,.3,1)',
              }}
            >
              <p className="mb-1.5 flex items-center gap-2 pr-[76px] text-[9.5px] font-medium uppercase tracking-[.15em] text-white/70">
                {slide.swatch && (
                  <i className="size-2 shrink-0 rounded-sm" style={{ background: slide.swatch }} />
                )}
                {slide.label}
              </p>

              <span className="num mb-1 block pr-[76px] text-[clamp(21px,5.8vw,25px)] font-semibold leading-tight tracking-[-.015em] text-white">
                {slide.value}
              </span>

              {slide.caption && <p className="text-[12.5px] text-white/75">{slide.caption}</p>}

              {slide.chips && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {slide.chips.map((chip) => (
                    <span
                      key={chip}
                      className="whitespace-nowrap rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10.5px] text-white/90"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}

              {slide.bars && (
                <div className="mt-2.5 flex h-[7px] overflow-hidden rounded bg-white/15">
                  {slide.bars.map((bar, barPosition) => (
                    <i key={barPosition} className="block h-full" style={{ width: bar.width, background: bar.color }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-[468px] items-center justify-center px-4">
        <div role="tablist" className="flex items-center justify-center">
          {slides.map((slide, position) => (
            <button
              key={slide.key}
              type="button"
              role="tab"
              aria-label={slide.label}
              aria-current={position === index}
              onClick={() => select(position)}
              className={`box-content size-1.5 rounded-full border-[12px] border-transparent bg-clip-padding transition-[background-color,transform] duration-200 ${
                position === index ? 'scale-140 bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>
    </header>
  )
}
