import { locales, type Lang } from './types'

type Cache<T> = Partial<Record<Lang, T>>

const memo = <T>(cache: Cache<T>, lang: Lang, make: () => T): T =>
  (cache[lang] ??= make())

const wholeCache: Cache<Intl.NumberFormat> = {}
const preciseCache: Cache<Intl.NumberFormat> = {}
const monthShortCache: Cache<Intl.DateTimeFormat> = {}
const monthLongCache: Cache<Intl.DateTimeFormat> = {}
const dayCache: Cache<Intl.DateTimeFormat> = {}
const pluralCache: Cache<Intl.PluralRules> = {}

const monthDate = (month: number) => new Date(Date.UTC(2024, month - 1, 1))

export type PluralKey = 'one' | 'few' | 'many' | 'other'

const narrow = (rule: Intl.LDMLPluralRule): PluralKey =>
  rule === 'one' || rule === 'few' || rule === 'many' ? rule : 'other'

export interface Fmt {
  uah: (value: number) => string
  uahExact: (value: number) => string
  share: (part: number, total: number) => string
  monthAxis: (month: number) => string
  monthLong: (month: number) => string
  day: (iso: string) => string
  pluralKey: (count: number) => PluralKey
}

export function makeFmt(lang: Lang): Fmt {
  const locale = locales[lang]

  const whole = memo(wholeCache, lang, () =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
  )
  const precise = memo(preciseCache, lang, () =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  )
  const monthShort = memo(monthShortCache, lang, () =>
    new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }),
  )
  const monthLong = memo(monthLongCache, lang, () =>
    new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }),
  )
  const day = memo(dayCache, lang, () =>
    new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
  )
  const plural = memo(pluralCache, lang, () => new Intl.PluralRules(locale))

  return {
    uah: (value) => `${whole.format(value)} ₴`,
    uahExact: (value) => `${precise.format(value)} ₴`,
    share: (part, total) => {
      const pct = (part / total) * 100
      return pct < 1 ? '<1%' : `${Math.round(pct)}%`
    },
    monthAxis: (month) => {
      const short = monthShort.format(monthDate(month)).replace(/\.$/, '')
      return (short.charAt(0).toUpperCase() + short.slice(1)).slice(0, 3)
    },
    monthLong: (month) => monthLong.format(monthDate(month)),
    day: (iso) => day.format(new Date(`${iso}T00:00:00Z`)),
    pluralKey: (count) => narrow(plural.select(count)),
  }
}
