import { useState } from 'react'
import { ReportMark } from '@entities/bank'
import { BankSheet } from '@features/choose-bank'
import { useT } from '@shared/i18n'
import { BackButton, Crumb, CtaButton, Screen } from '@shared/ui'
import { PublicReport } from '@widgets/public-report'

export function ReportPage() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const t = useT()

  return (
    <Screen bank="report">
      <BackButton label={t('common.back')} />
      <Crumb mark={<ReportMark size="sm" />} title={t('report.title')} />

      <PublicReport />


      <div className="mt-6">
        <CtaButton onClick={() => setSheetOpen(true)}>{t('report.cta')}</CtaButton>
      </div>

      <BankSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </Screen>
  )
}
