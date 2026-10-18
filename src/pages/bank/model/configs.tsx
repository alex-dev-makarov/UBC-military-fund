import stepDots from '@assets/step-dots.webp'
import stepNav from '@assets/step-nav.webp'
import stepStar from '@assets/step-star.webp'
import { MonoReplica } from '@widgets/mono-replica'
import { banks, privatTransferUrl } from '@entities/bank'
import type { Bank, BankId } from '@entities/bank'
import { markDonationIntent } from '@entities/fund'
import { Rich } from '@shared/i18n'
import { CtaNote } from '@shared/ui'
import type { BankPageConfig, BankSlotContext } from './types'

function bankById(id: BankId): Bank {
  const bank = banks.find((b) => b.id === id)
  if (!bank) throw new Error(`Unknown bank id: ${id}`)
  return bank
}

function renderPrivatPath({ t }: BankSlotContext) {
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

function renderMonoOnceNote({ t }: BankSlotContext) {
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

const monoPageConfig: BankPageConfig = {
  bank: bankById('mono'),
  titleKey: 'bank.mono.name',
  monthly: [
    { kind: 'note', key: 'mono.note', rich: true },
    { kind: 'divider', key: 'common.divider.steps' },
    {
      kind: 'steps',
      steps: [
        {
          titleKey: 'mono.step1.title',
          blocks: [
            { kind: 'para', key: 'mono.step1.p1', rich: true },
            { kind: 'shot', src: stepDots, altKey: 'mono.step1.shot1.alt' },
            { kind: 'para', key: 'mono.step1.p2', rich: true },
            { kind: 'shot', src: stepStar, altKey: 'mono.step1.shot2.alt' },
          ],
        },
        {
          titleKey: 'mono.step2.title',
          blocks: [
            { kind: 'para', key: 'mono.step2.p1', rich: true },
            { kind: 'shot', src: stepNav, altKey: 'mono.step2.shot.alt' },
          ],
        },
        {
          titleKey: 'mono.step3.title',
          blocks: [
            { kind: 'para', key: 'mono.step3.p1', rich: true },
            { kind: 'slot', render: () => <MonoReplica /> },
          ],
        },
      ],
    },
    {
      kind: 'cta',
      labelKey: 'mono.cta.monthly',
      href: (fund) => fund.jarUrl,
      onClick: markDonationIntent,
      wrapClass: 'mt-5',
    },
    { kind: 'foot', key: 'mono.foot', rich: true },
  ],
  once: [
    { kind: 'cta', labelKey: 'mono.cta.once', href: (fund) => fund.jarUrl, onClick: markDonationIntent },
    { kind: 'slot', render: renderMonoOnceNote },
  ],
}

const privatPageConfig: BankPageConfig = {
  bank: bankById('privat'),
  titleKey: 'bank.privat.name',
  monthly: [
    { kind: 'note', key: 'privat.note', rich: true },
    { kind: 'slot', render: renderPrivatPath },
    { kind: 'divider', key: 'common.divider.steps' },
    {
      kind: 'steps',
      steps: [
        {
          titleKey: 'privat.step1.title',
          blocks: [
            { kind: 'para', key: 'privat.step1.p1', rich: false },
            { kind: 'copyCard', trustKey: 'privat.trust', wrapClass: 'mt-2.5' },
          ],
        },
        {
          titleKey: 'privat.step2.title',
          blocks: [{ kind: 'para', key: 'privat.step2.p1', rich: true }],
        },
        {
          titleKey: 'privat.step3.title',
          blocks: [{ kind: 'para', key: 'privat.step3.p1', rich: true }],
        },
      ],
    },
    {
      kind: 'cta',
      labelKey: 'privat.cta.monthly',
      href: (fund) => privatTransferUrl(fund.card),
      onClick: markDonationIntent,
      wrapClass: 'mt-5',
    },
    { kind: 'foot', key: 'privat.foot', rich: true },
  ],
  once: [
    { kind: 'cta', labelKey: 'privat.cta.once', href: (fund) => privatTransferUrl(fund.card), onClick: markDonationIntent },
    { kind: 'ctaNote', key: 'privat.once.note' },
    { kind: 'divider', key: 'privat.divider.manual' },
    { kind: 'copyCard', trustKey: 'privat.trust' },
  ],
}

const otherPageConfig: BankPageConfig = {
  bank: bankById('other'),
  titleKey: 'other.title',
  monthly: [
    { kind: 'note', key: 'other.note', rich: false },
    { kind: 'copyCard', trustKey: 'other.trust' },
    { kind: 'divider', key: 'other.divider.monthly' },
    {
      kind: 'steps',
      steps: [
        {
          titleKey: 'other.step1.title',
          blocks: [{ kind: 'para', key: 'other.step1.p1', rich: true }],
        },
        {
          titleKey: 'other.step2.title',
          blocks: [{ kind: 'para', key: 'other.step2.p1', rich: false }],
        },
      ],
    },
    { kind: 'foot', key: 'other.foot', rich: true },
  ],
  once: null,
}

export { monoPageConfig, otherPageConfig, privatPageConfig }
