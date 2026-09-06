import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { ReportDeck } from '@widgets/report-deck'
import { useBackSwipe, useGoBack } from '@shared/lib'
import { AppRoutes } from './router'

export function Layout() {
  const { pathname } = useLocation()
  const back = useGoBack()
  const swipe = useBackSwipe(back, pathname !== '/')

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="mx-auto w-full max-w-[468px] px-4 pt-[5px]" {...swipe.handlers}>
      <ReportDeck />
      <div style={swipe.style}>
        <AppRoutes />
      </div>
    </div>
  )
}
