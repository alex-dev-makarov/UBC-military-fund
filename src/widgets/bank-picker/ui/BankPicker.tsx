import { useLocation, useNavigate } from 'react-router'
import { BankMark, BankRow, banks, ReportMark } from '@entities/bank'
import { totalSpent } from '@entities/spend'
import { useFund } from '@entities/fund'
import { useEffect } from 'react'
import { useTelegramDeepLink, DENIED_PATH, MEMBERS_PATH, SECRET_PATH } from '@features/auth-telegram'
import { useI18n } from '@shared/i18n'

export function BankPicker() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t, fmt } = useI18n()
  const fund = useFund()

  const membersEntry = pathname === MEMBERS_PATH

  const { phase, start } = useTelegramDeepLink(() => navigate(SECRET_PATH))

  useEffect(() => {
    if (phase === 'denied') navigate(DENIED_PATH, { replace: true })
  }, [phase, navigate])

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
        {membersEntry ? (
          <>
            <BankRow
              bank="report"
              mark={<ReportMark />}
              title={t('members.title')}
              hint={t(phase === 'waiting' ? 'members.hint.waiting' : 'members.hint')}
              onClick={start}
            />
            <p className="mt-2.5 px-1 text-[12px] leading-relaxed text-ink-3">
              {t('members.reassure')}
            </p>
          </>
        ) : (
          <BankRow
            bank="report"
            mark={<ReportMark />}
            title={t('report.title')}
            hint={t('pick.report.hint', { total: fmt.uah(totalSpent(fund)) })}
            onClick={() => navigate('/report')}
          />
        )}
      </div>
    </>
  )
}
