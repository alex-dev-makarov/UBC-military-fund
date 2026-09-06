import { useT } from '@shared/i18n'
import { useCopy } from '@shared/lib'

interface Props {
  label: string
  value: string
  trust?: string
}

export function CopyCard({ label, value, trust }: Props) {
  const t = useT()
  const { copied, copy } = useCopy(value)

  return (
    <>
      <div className="flex items-center gap-2.5 rounded-xl bg-[var(--bank-tint)] px-3.5 py-3">
        <span className="min-w-0 flex-1">
          <span className="block text-[9.5px] font-medium uppercase tracking-[.14em] text-ink-3">
            {label}
          </span>
          <span className="num block break-all text-[15px] font-semibold tracking-[.02em]">
            {value}
          </span>
        </span>
        <button
          type="button"
          onClick={copy}
          className={`min-h-11 shrink-0 rounded-[9px] px-4 text-[13px] font-bold text-white transition-colors ${
            copied ? 'bg-field' : 'bg-[var(--bank-accent)]'
          }`}
        >
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
      {trust && <p className="mt-1 pl-0.5 text-xs leading-snug text-ink-3">{trust}</p>}
    </>
  )
}
