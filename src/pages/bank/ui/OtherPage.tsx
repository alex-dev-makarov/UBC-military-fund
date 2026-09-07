import { BankMark, banks } from '@entities/bank'
import { CopyCard } from '@features/copy-card'
import { useFund } from '@entities/fund'
import { Rich, useT } from '@shared/i18n'
import {
  BackButton,
  Card,
  Crumb,
  Divider,
  Foot,
  Note,
  Screen,
  Step,
  Steps,
} from '@shared/ui'

const other = banks[2]!

export function OtherPage() {
  const t = useT()
  const fund = useFund()

  return (
    <Screen bank="other">
      <BackButton />
      <Crumb mark={<BankMark bank={other} size="sm" />} title={t('other.title')} />

      <Card>
        <Note>{t('other.note')}</Note>

        <CopyCard label={t('common.card')} value={fund.card} trust={t('other.trust')} />

        <Divider>{t('other.divider.monthly')}</Divider>

        <Steps>
          <Step index={1} title={t('other.step1.title')}>
            <p>
              <Rich text={t('other.step1.p1')} />
            </p>
          </Step>
          <Step index={2} title={t('other.step2.title')} last>
            <p>{t('other.step2.p1')}</p>
          </Step>
        </Steps>

        <Foot>
          <Rich text={t('other.foot')} />
        </Foot>
      </Card>
    </Screen>
  )
}
