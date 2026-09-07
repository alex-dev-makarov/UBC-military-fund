import { useState } from 'react'
import stepDots from '@assets/step-dots.webp'
import stepNav from '@assets/step-nav.webp'
import stepStar from '@assets/step-star.webp'
import { MonoReplica } from '@widgets/mono-replica'
import { BankMark, banks } from '@entities/bank'
import { useFund } from '@entities/fund'
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
  Shot,
  Step,
  Steps,
  Tabs,
} from '@shared/ui'

type Mode = 'monthly' | 'once'

const mono = banks[0]!

export function MonoPage() {
  const [mode, setMode] = useState<Mode>('monthly')
  const t = useT()
  const fund = useFund()

  return (
    <Screen bank="mono">
      <BackButton />
      <Crumb mark={<BankMark bank={mono} size="sm" />} title={t(mono.nameKey)} />

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
              <Rich text={t('mono.note')} />
            </Note>

            <Divider>{t('common.divider.steps')}</Divider>

            <Steps>
              <Step index={1} title={t('mono.step1.title')}>
                <p>
                  <Rich text={t('mono.step1.p1')} />
                </p>
                <Shot src={stepDots} alt={t('mono.step1.shot1.alt')} />
                <p>
                  <Rich text={t('mono.step1.p2')} />
                </p>
                <Shot src={stepStar} alt={t('mono.step1.shot2.alt')} />
              </Step>

              <Step index={2} title={t('mono.step2.title')}>
                <p>
                  <Rich text={t('mono.step2.p1')} />
                </p>
                <Shot src={stepNav} alt={t('mono.step2.shot.alt')} />
              </Step>

              <Step index={3} title={t('mono.step3.title')} last>
                <p>
                  <Rich text={t('mono.step3.p1')} />
                </p>
                <MonoReplica />
              </Step>
            </Steps>

            <div className="mt-5">
              <CtaLink href={fund.jarUrl}>{t('mono.cta.monthly')}</CtaLink>
            </div>

            <Foot>
              <Rich text={t('mono.foot')} />
            </Foot>
          </>
        ) : (
          <>
            <CtaLink href={fund.jarUrl}>{t('mono.cta.once')}</CtaLink>
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
          </>
        )}
      </Card>
    </Screen>
  )
}
