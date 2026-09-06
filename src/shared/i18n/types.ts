export const langs = ['uk', 'en'] as const

export type Lang = (typeof langs)[number]

export type Loc = Record<Lang, string>

export const locales: Record<Lang, string> = {
  uk: 'uk-UA',
  en: 'en-GB',
}

export const isLang = (value: unknown): value is Lang =>
  typeof value === 'string' && (langs as readonly string[]).includes(value)
