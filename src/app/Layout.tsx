import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useGetPublicReportQuery } from '@shared/api'
import { useI18n } from '@shared/i18n'
import { ReportDeck } from '@widgets/report-deck'
import { useBackSwipe, useGoBack } from '@shared/lib'
import { AppRoutes } from './router'

export function Layout() {
  const { pathname } = useLocation()
  const back = useGoBack()
  const swipe = useBackSwipe(back, pathname !== '/')
  const { t } = useI18n()

  const { isLoading, error, refetch } = useGetPublicReportQuery()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[468px] px-4 pt-16 text-center">
        <p className="text-sm font-bold tracking-[-.01em]">{t('fund.error.title')}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{t('fund.error.text')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-4 text-[12.5px] font-semibold underline underline-offset-4"
        >
          {t('fund.retry')}
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[468px] px-4 pt-16 text-center">
        <p className="text-[12.5px] text-ink-3">{t('fund.loading')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[468px] px-4 pt-[5px]" {...swipe.handlers}>
      <ReportDeck />
      <div style={swipe.style}>
        <AppRoutes />
      </div>
    </div>
  )
}
