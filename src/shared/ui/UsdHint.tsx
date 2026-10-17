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

interface IUsdHintProps {
  uah: number
  block?: boolean
  className?: string
  rate?: number | null
}

type IViewProps = Omit<IUsdHintProps, 'rate'> & { rate: number | null }

function UsdHintView({ uah, block = false, className = 'text-ink-3', rate }: IViewProps) {
  const { fmt } = useI18n()
  if (!rate) return null

  return (
    <span
      className={`whitespace-nowrap text-[13px] font-medium tracking-normal ${block ? 'block' : 'ml-1.5'} ${className}`}
    >
      (≈ {fmt.usd(uah / rate)})
    </span>
  )
}

function UsdHintConnected(props: Omit<IUsdHintProps, 'rate'>) {
  return <UsdHintView {...props} rate={useUsdRate()} />
}

export function UsdHint({ rate, ...props }: IUsdHintProps) {
  return rate === undefined ? <UsdHintConnected {...props} /> : <UsdHintView {...props} rate={rate} />
}
