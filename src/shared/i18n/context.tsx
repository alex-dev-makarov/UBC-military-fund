import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { makeFmt, type Fmt } from './format'
import { isLang, locales, type Lang, type Loc } from './types'
import { uk, type TKey } from './uk'
import { en } from './en'

const dicts: Record<Lang, Record<TKey, string>> = { uk, en }

const STORAGE_KEY = 'ubc:lang'

const remember = (lang: Lang) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang)
    return true
  } catch {
    return false
  }
}

const fill = (text: string, vars?: Record<string, string | number>) =>
  vars
    ? text.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match,
      )
    : text

export type Translate = (key: TKey, vars?: Record<string, string | number>) => string

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translate
  fmt: Fmt
  pick: (value: Loc) => string
}

const I18nContext = createContext<I18nValue | null>(null)

function detect(): Lang {
  if (typeof window === 'undefined') return 'uk'

  const forced = new URLSearchParams(window.location.search).get('lang')
  if (isLang(forced)) return forced

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (isLang(saved)) return saved
  } catch {
    return 'uk'
  }

  return 'uk'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect)

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    remember(next)
  }, [])

  const value = useMemo<I18nValue>(() => {
    const dict = dicts[lang]
    const t: Translate = (key, vars) => fill(dict[key], vars)
    return { lang, setLang, t, fmt: makeFmt(lang), pick: (loc) => loc[lang] }
  }, [lang, setLang])

  useEffect(() => {
    const root = document.documentElement
    root.lang = lang
    document.title = value.t('meta.title')

    const set = (selector: string, attr: string, content: string) => {
      document.querySelector(selector)?.setAttribute(attr, content)
    }
    set('meta[name="description"]', 'content', value.t('meta.description'))
    set('meta[property="og:title"]', 'content', value.t('meta.title'))
    set('meta[property="og:locale"]', 'content', locales[lang].replace('-', '_'))
  }, [lang, value])

  return <I18nContext value={value}>{children}</I18nContext>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}

export const useT = () => useI18n().t
export const useFmt = () => useI18n().fmt
export const usePick = () => useI18n().pick
