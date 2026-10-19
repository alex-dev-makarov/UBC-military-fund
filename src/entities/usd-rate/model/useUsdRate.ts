import { useEffect, useState } from 'react'
import { useGetUsdRateQuery } from '@shared/api'
import { useI18n } from '@shared/i18n'

const RETRY_MS = 5 * 60_000

export function useUsdRate(): number | null {
  const { lang } = useI18n()
  const [missing, setMissing] = useState(false)
  const { data } = useGetUsdRateQuery(undefined, {
    skip: lang !== 'en',
    pollingInterval: missing ? RETRY_MS : 0,
  })

  useEffect(() => {
    setMissing(data !== undefined && data.usdRate === null)
  }, [data])

  return lang === 'en' ? (data?.usdRate ?? null) : null
}
