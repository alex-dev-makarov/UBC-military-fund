import type { SpendItem } from '@shared/api'
import { useI18n } from '@shared/i18n'
import { UsdHint } from '@shared/ui'

export function RecentList({ items, rate }: { items: SpendItem[]; rate: number | null }) {
  const { fmt, pick } = useI18n()

  return (
    <ul className="m-0 list-none p-0">
      {items.map((item) => (
        <li
          key={`${item.date}-${item.amount}`}
          className="flex items-baseline gap-2.5 border-b border-line py-2.5 text-sm last:border-0 last:pb-0 first:pt-0"
        >
          <span className="num w-[42px] shrink-0 text-[11px] font-semibold text-ink-3">
            {fmt.day(item.date)}
          </span>
          <span className="min-w-0 flex-1 tracking-[-.01em]">{pick(item.title)}</span>
          <span className="num shrink-0 text-right font-bold">
            {fmt.uah(item.amount)}
            <UsdHint uah={item.amount} block rate={rate} />
          </span>
        </li>
      ))}
    </ul>
  )
}
