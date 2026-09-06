import { langs, useI18n } from '@shared/i18n'

export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n()

  return (
    <div
      role="group"
      aria-label={t('lang.label')}
      className={`flex items-center rounded-lg border border-white/15 bg-white/5 p-[3px] ${className}`}
    >
      {langs.map((code) => {
        const active = code === lang
        return (
          <button
            key={code}
            type="button"
            lang={code}
            title={t(`lang.${code}.full`)}
            aria-pressed={active}
            onClick={() => setLang(code)}
            className={`relative min-h-8 rounded-[6px] px-2.5 text-[10px] font-bold uppercase leading-none tracking-[.1em] transition-colors duration-200 before:absolute before:-inset-y-1.5 before:-inset-x-0.5 before:content-[''] ${
              active ? 'bg-white text-ink' : 'text-white/60'
            }`}
          >
            {t(`lang.${code}`)}
          </button>
        )
      })}
    </div>
  )
}
