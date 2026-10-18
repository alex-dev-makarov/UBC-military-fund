import { useI18n } from '@shared/i18n'

interface UsdHintProps {
  uah: number
  block?: boolean
  className?: string
  rate: number | null
}

export function UsdHint({ uah, block = false, className = 'text-ink-3', rate }: UsdHintProps) {
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
