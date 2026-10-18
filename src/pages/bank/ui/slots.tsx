import { Rich } from '@shared/i18n'
import { CtaNote } from '@shared/ui'
import type { BankSlotContext } from '../model/types'

export function renderPrivatPath({ t }: BankSlotContext) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3">
        {t('privat.path.label')}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[var(--bank-tint)] px-3 py-3 text-[11px]">
        <span className="rounded-md border border-line bg-card px-2 py-1.5">
          {t('privat.path.1')}
        </span>
        <span className="text-ink-3">→</span>
        <span className="rounded-md bg-[var(--bank-accent)] px-2 py-1.5 font-semibold text-white">
          {t('privat.path.2')}
        </span>
        <span className="text-ink-3">→</span>
        <span className="rounded-md border border-line bg-card px-2 py-1.5">
          {t('privat.path.3')}
        </span>
      </div>
    </div>
  )
}

export function renderMonoOnceNote({ t }: BankSlotContext) {
  return (
    <CtaNote>
      <Rich
        text={t('mono.once.note')}
        slots={{
          link: (
            <a
              href="https://www.monobank.ua/"
              target="_blank"
              rel="noopener"
              className="font-bold text-[var(--bank-soft)]"
            >
              {t('mono.once.download')}
            </a>
          ),
        }}
      />
    </CtaNote>
  )
}
