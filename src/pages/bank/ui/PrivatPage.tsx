import { useState } from 'react'
import { BankMark, banks, privatTransferUrl } from '@entities/bank'
import { CopyCard } from '@features/copy-card'
import { fund } from '@shared/config'
import { Rich, useT } from '@shared/i18n'
import {
  BackButton,
  Card,
  Crumb,
  CtaLink,
  CtaNote,
  Divider,
  Foot,
  Note,
  Screen,
  Step,
  Steps,
  Tabs,
} from '@shared/ui'

type Mode = 'monthly' | 'once'

const privat = banks[1]!

export function PrivatPage() {
  const [mode, setMode] = useState<Mode>('monthly')
  const t = useT()
  const transferUrl = privatTransferUrl(fund.card)

  return (
    <Screen bank="privat">
      <BackButton />
      <Crumb mark={<BankMark bank={privat} size="sm" />} title={t(privat.nameKey)} />

      <Tabs
        value={mode}
        onChange={setMode}
        options={[
          { id: 'monthly', label: t('common.tab.monthly') },
          { id: 'once', label: t('common.tab.once') },
        ]}
      />

      <Card>
        {mode === 'monthly' ? (
          <>
            <Note>
              <Rich text={t('privat.note')} />
            </Note>

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

            <Divider>{t('common.divider.steps')}</Divider>

            <Steps>
              <Step index={1} title={t('privat.step1.title')}>
                <p>{t('privat.step1.p1')}</p>
                <div className="mt-2.5">
                  <CopyCard
                    label={t('common.card')}
                    value={fund.card}
                    trust={t('privat.trust')}
                  />
                </div>
              </Step>

              <Step index={2} title={t('privat.step2.title')}>
                <p>
                  <Rich text={t('privat.step2.p1')} />
                </p>
              </Step>

              <Step index={3} title={t('privat.step3.title')} last>
                <p>
                  <Rich text={t('privat.step3.p1')} />
                </p>
              </Step>
            </Steps>

            <div className="mt-5">
              <CtaLink href={transferUrl}>{t('privat.cta.monthly')}</CtaLink>
            </div>

            <Foot>
              <Rich text={t('privat.foot')} />
            </Foot>
          </>
        ) : (
          <>
            <CtaLink href={transferUrl}>{t('privat.cta.once')}</CtaLink>
            <CtaNote>{t('privat.once.note')}</CtaNote>

            <Divider>{t('privat.divider.manual')}</Divider>
            <CopyCard label={t('common.card')} value={fund.card} trust={t('privat.trust')} />
          </>
        )}
      </Card>
    </Screen>
  )
}
