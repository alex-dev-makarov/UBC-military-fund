import { useNavigate } from 'react-router'
import { BankMark, BankRow, banks, ReportMark } from '@entities/bank'
import { totalSpent } from '@entities/spend'
import { fund } from '@shared/config'
import { useI18n } from '@shared/i18n'

export function BankPicker() {
  const navigate = useNavigate()
  const { t, fmt } = useI18n()

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {banks.map((bank) => (
          <BankRow
            key={bank.id}
            bank={bank.id}
            mark={<BankMark bank={bank} />}
            title={t(bank.nameKey)}
            hint={t(bank.hintKey)}
            onClick={() => navigate(`/${bank.id}`)}
          />
        ))}
      </div>

      <p className="mt-4 text-center text-[13px] text-ink-3">{t('pick.note')}</p>

      <div className="mt-3.5">
        <BankRow
          bank="report"
          mark={<ReportMark />}
          title={t('report.title')}
          hint={t('pick.report.hint', { total: fmt.uah(totalSpent(fund)) })}
          onClick={() => navigate('/report')}
        />
      </div>
    </>
  )
}
