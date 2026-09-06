import { useState } from 'react'
import { ReportMark } from '@entities/bank'
import {
  categoriesTotal,
  CategoryBars,
  MonthlyChart,
  peakMonth,
  RecentList,
  SpendDonut,
  totalSpent,
  YearBars,
} from '@entities/spend'
import { BankSheet } from '@features/choose-bank'
import { fund } from '@shared/config'
import { useI18n } from '@shared/i18n'
import { BackButton, Card, Crumb, CtaButton, Screen } from '@shared/ui'

const Heading = ({ children }: { children: string }) => (
  <h3 className="mb-2.5 mt-6 pl-0.5 text-[13px] font-bold tracking-[.02em] text-ink-2">{children}</h3>
)

const NoteText = ({ children }: { children: string }) => (
  <p className="mt-3.5 text-[12.5px] leading-relaxed text-ink-3">{children}</p>
)

export function ReportPage() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const { t, fmt } = useI18n()
  const total = totalSpent(fund)
  const catTotal = categoriesTotal(fund)
  const [peakIndex, peakValue] = peakMonth(fund)
  const currentYear = fund.years.at(-1)?.year ?? ''

  return (
    <Screen bank="report">
      <BackButton label={t('common.back')} />
      <Crumb mark={<ReportMark size="sm" />} title={t('report.title')} />

      <Card>
        <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[.14em] text-ink-3">
          {t('report.total.label')}
        </span>
        <span className="num block text-[clamp(26px,7.4vw,33px)] font-extrabold leading-none tracking-[-.03em]">
          {fmt.uahExact(total)}
        </span>
        <YearBars years={fund.years} />
      </Card>

      <Heading>{t('report.h.categories')}</Heading>
      <Card>
        <SpendDonut categories={fund.categories} total={catTotal} />
        <div className="mt-4 border-t border-line pt-1">
          <CategoryBars categories={fund.categories} total={catTotal} />
        </div>
        <NoteText>{t('report.note.categories')}</NoteText>
      </Card>

      <Heading>{t('report.h.monthly', { year: currentYear })}</Heading>
      <Card>
        <MonthlyChart months={fund.months} />
        <NoteText>
          {t('report.note.monthly', {
            month: fmt.monthLong(peakIndex),
            amount: fmt.uah(peakValue),
          })}
        </NoteText>
      </Card>

      <Heading>{t('report.h.recent')}</Heading>
      <Card>
        <RecentList items={fund.recent} />
        <NoteText>{t('report.note.recent')}</NoteText>
      </Card>

      <div className="mt-6">
        <CtaButton onClick={() => setSheetOpen(true)}>{t('report.cta')}</CtaButton>
      </div>

      <BankSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </Screen>
  )
}
