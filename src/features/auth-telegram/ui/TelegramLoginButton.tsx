import { useEffect } from 'react'
import type { AuthUser } from '@shared/api'
import { useT } from '@shared/i18n'
import { useTelegramDeepLink } from '../model/useTelegramDeepLink'

const TelegramGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor" aria-hidden="true">
    <path d="M21.9 4.3 18.7 19.4c-.24 1.06-.87 1.32-1.76.82l-4.87-3.59-2.35 2.26c-.26.26-.48.48-.98.48l.35-4.96 9.03-8.16c.39-.35-.09-.55-.6-.2L6.36 13.2 1.56 11.7c-1.04-.33-1.06-1.04.22-1.54l18.78-7.24c.87-.32 1.63.2 1.34 1.38Z" />
  </svg>
)

interface Props {
  onAuth: (user: AuthUser) => void
  
  onDenied?: () => void
  disabled?: boolean
}

export function TelegramLoginButton({ onAuth, onDenied, disabled = false }: Props) {
  const t = useT()
  const { phase, url, start, cancel } = useTelegramDeepLink(onAuth)

  useEffect(() => {
    if (phase === 'denied') onDenied?.()
  }, [phase, onDenied])

  if (phase === 'waiting') {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-center text-[12.5px] leading-relaxed text-ink-3">
          {t('private.deeplink.waiting')}
        </p>
        {url && (
          <a
            href={url}
            className="text-[12.5px] font-semibold underline underline-offset-4"
          >
            {t('private.deeplink.reopen')}
          </a>
        )}
        <button
          type="button"
          onClick={cancel}
          className="text-[12px] text-ink-3 underline underline-offset-4"
        >
          {t('private.deeplink.cancel')}
        </button>
      </div>
    )
  }

  
  
  
  if (phase === 'expired' || phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-center text-[12.5px] leading-relaxed text-ink-3">
          {t(phase === 'expired' ? 'private.deeplink.expired' : 'private.deeplink.error')}
        </p>
        <button
          type="button"
          onClick={start}
          className="text-[12.5px] font-semibold underline underline-offset-4"
        >
          {t('private.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        className="tap inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#2AABEE] px-5 text-[14.5px] font-bold text-white active:opacity-90 disabled:opacity-50"
      >
        <TelegramGlyph />
        {t('private.deeplink.cta')}
      </button>
    </div>
  )
}
