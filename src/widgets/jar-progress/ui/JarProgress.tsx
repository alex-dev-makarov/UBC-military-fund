import { useEffect, useRef, useState } from 'react'
import { totalSpent } from '@entities/spend'
import { useDonationBoost, useFund } from '@entities/fund'
import { useGetJarBalanceQuery } from '@shared/api'
import { UsdHint, useUsdRate } from '@shared/ui'
import { Rich, useI18n } from '@shared/i18n'

const POLL_MS = 60_000
const BOOSTED_POLL_MS = 15_000
const STALE_MS = 15_000
const AMOUNT = 'mt-1 whitespace-nowrap text-[19px] font-extrabold tracking-tight min-[380px]:text-[22px]'
const EYEBROW = 'text-[10.5px] font-medium uppercase tracking-[.18em]'

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => !document.hidden)

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return visible
}

export function JarProgress() {
  const { t, fmt, lang } = useI18n()
  const fund = useFund()
  const visible = usePageVisible()
  const boosted = useDonationBoost()
  const rate = useUsdRate()
  const { data, isLoading, refetch, fulfilledTimeStamp } = useGetJarBalanceQuery(undefined, {
    pollingInterval: !visible ? 0 : boosted ? BOOSTED_POLL_MS : POLL_MS,
    refetchOnMountOrArgChange: STALE_MS,
  })

  const fulfilledAt = useRef(fulfilledTimeStamp)
  fulfilledAt.current = fulfilledTimeStamp
  const lastAttempt = useRef(0)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (!visible || Date.now() - Math.max(lastAttempt.current, fulfilledAt.current ?? 0) <= STALE_MS) return
    lastAttempt.current = Date.now()
    refetch()
  }, [visible, refetch])

  const spent = totalSpent(fund)
  const jar = data?.amount ?? null
  const { need } = fund

  if (isLoading) {
    return (
      <div aria-hidden className="surface mb-5 animate-pulse p-5">
        <div className="h-3 w-2/5 rounded bg-black/5" />
        <div className="mt-3 h-10 w-3/5 rounded bg-black/5" />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="h-12 rounded bg-black/5" />
          <div className="h-12 rounded bg-black/5" />
        </div>
        {need && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="h-3 w-1/4 rounded bg-black/5" />
            <div className="mt-2 h-5 w-1/2 rounded bg-black/5" />
            <div className="mt-2.5 h-2 rounded-full bg-black/5" />
            <div className="mt-2 h-4 w-2/5 rounded bg-black/5" />
          </div>
        )}
      </div>
    )
  }

  if (jar === null) {
    return (
      <div className="surface mb-5 p-5">
        <p className={EYEBROW}>{t('pick.jar.spent')}</p>
        <p className={AMOUNT}>{fmt.uah(spent)}</p>
      </div>
    )
  }

  const total = spent + jar
  const jarShown = Math.round(jar)
  const left = need ? Math.max(need.goal - jarShown, 1) : 0

  return (
    <div className="surface mb-5 p-5 shadow-[0_1px_2px_rgb(26_29_26/.05)]">
      <p className={`flex items-center gap-2.5 ${EYEBROW} text-ink-2`}>
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-field-soft" />
        <span className="truncate">{lang === 'uk' && data?.name ? data.name : t('pick.jar.name')}</span>
      </p>

      <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
        <span className="text-[32px] font-extrabold min-[380px]:text-[40px] leading-none tracking-tight">{fmt.uah(total)}</span>
        <UsdHint uah={total} rate={rate} />
        <span className="text-[15px] text-ink-3">{t('pick.jar.total')}</span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className={EYEBROW}>{t('pick.jar.spent')}</p>
          <p className={AMOUNT}>
            {fmt.uah(spent)}
            <UsdHint uah={spent} block rate={rate} />
          </p>
        </div>
        <div>
          <p className={EYEBROW}>{t('pick.jar.balance')}</p>
          <p className={AMOUNT}>
            {fmt.uah(jar)}
            <UsdHint uah={jar} block rate={rate} />
          </p>
        </div>
      </div>

      {need && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className={`whitespace-nowrap ${EYEBROW} text-ink-3`}>{t('pick.jar.need')}</p>
            {need.deadline && <p className="whitespace-nowrap text-[13px] text-ink-3">{need.deadline[lang]}</p>}
          </div>
          <p className="mt-1 text-[17px] font-bold">{need.title[lang]}</p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={need.goal}
            aria-valuenow={Math.min(jar, need.goal)}
            aria-label={need.title[lang]}
            aria-valuetext={`${fmt.uahExact(jar)} / ${fmt.uah(need.goal)}`}
            className="mt-2.5 h-2 overflow-hidden rounded-full bg-black/10"
          >
            <div
              className={`h-full rounded-full bg-field transition-[width] duration-500 ${jar > 0 ? 'min-w-2' : ''}`}
              style={{ width: `${Math.min(jar / need.goal, 1) * 100}%` }}
            />
          </div>
          <p className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[14px] text-ink-3">
            {jar >= need.goal ? (
              t('pick.jar.needDone')
            ) : (
              <>
                <span className={rate ? '' : 'whitespace-nowrap'}>
                  <Rich
                    text={t('pick.jar.needProgress')}
                    slots={{
                      jar: fmt.uah(jarShown),
                      goal: (
                        <>
                          {fmt.uah(need.goal)}
                          <UsdHint uah={need.goal} rate={rate} />
                        </>
                      ),
                    }}
                  />
                </span>
                <span className="whitespace-nowrap text-[#8A5A22]">{t('pick.jar.needLeft', { left: fmt.uah(left) })}</span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
