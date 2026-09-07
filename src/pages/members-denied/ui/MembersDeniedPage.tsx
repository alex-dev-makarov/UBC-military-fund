import { useNavigate } from 'react-router'
import { MEMBERS_PATH } from '@features/auth-telegram'
import { useT } from '@shared/i18n'
import { Card, Screen } from '@shared/ui'

export function MembersDeniedPage() {
  const t = useT()
  const navigate = useNavigate()

  return (
    <Screen bank="report">
      <Card className="mt-8 text-center">
        <span className="mb-3 block text-[34px]" aria-hidden>
          🔒
        </span>
        <p className="text-[17px] font-bold tracking-[-.015em]">{t('denied.title')}</p>
        <p className="mx-auto mt-2 max-w-[34ch] text-[13.5px] leading-relaxed text-ink-3">
          {t('denied.text')}
        </p>

        <button
          type="button"
          onClick={() => navigate(MEMBERS_PATH, { replace: true })}
          className="tap mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--bank-soft)] px-5 text-[14.5px] font-bold text-white active:opacity-90"
        >
          {t('denied.retry')}
        </button>

        <button
          type="button"
          onClick={() => navigate('/report', { replace: true })}
          className="mt-3 text-[12.5px] text-ink-3 underline underline-offset-4"
        >
          {t('denied.public')}
        </button>
      </Card>
    </Screen>
  )
}
