import { useGetSecretReportQuery, getFetchErrorStatus } from '@shared/api'
import type { PrivateReport as PrivateReportDto } from '@shared/api'
import { useI18n } from '@shared/i18n'
import { Card } from '@shared/ui'

const SubHeading = ({ children }: { children: string }) => (
  <h4 className="mb-2 mt-4 text-[10.5px] font-semibold uppercase tracking-[.14em] text-ink-3 first:mt-0">
    {children}
  </h4>
)

export function PrivateReport({ onSessionExpired }: { onSessionExpired?: () => void } = {}) {
  const { t, fmt } = useI18n()
  const { data: report, error, refetch } = useGetSecretReportQuery()

  const errorStatus = getFetchErrorStatus(error)

  if (errorStatus === 401) {
    onSessionExpired?.()
    return null
  }

  const showDenied = errorStatus === 403
  const showOther = error && !showDenied

  const retry = () => {
    void refetch()
  }

  if (showDenied) {
    return (
      <Card>
        <p className="text-sm font-bold tracking-[-.01em]">{t('private.denied.title')}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{t('private.denied.text')}</p>
      </Card>
    )
  }

  if (showOther) {
    return (
      <Card>
        <p className="text-sm font-bold tracking-[-.01em]">{t('private.error.title')}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{t('private.error.text')}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 text-[12.5px] font-semibold underline underline-offset-4"
        >
          {t('private.retry')}
        </button>
      </Card>
    )
  }

  if (!report) {
    return (
      <Card>
        <p className="text-[12.5px] text-ink-3">{t('private.loading')}</p>
      </Card>
    )
  }

  return (
    <Card className="mt-4">
      <ReportBody report={report} t={t} fmt={fmt} />
    </Card>
  )
}

type I18n = ReturnType<typeof useI18n>

function ReportBody({
  report,
  t,
  fmt,
}: {
  report: PrivateReportDto
  t: I18n['t']
  fmt: I18n['fmt']
}) {
  const deliveries = report.deliveries ?? []
  const pendingItems = report.pending ?? []
  const suppliers = report.suppliers ?? []

  return (
    <>
      <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[.14em] text-ink-3">
        {t('private.reserve')}
      </span>
      <span className="num block text-[clamp(20px,5.6vw,25px)] font-extrabold leading-none tracking-[-.03em]">
        {fmt.uahExact(report.reserveUah ?? 0)}
      </span>

      <SubHeading>{t('private.h.deliveries')}</SubHeading>
      {deliveries.length === 0 ? (
        <p className="text-[12.5px] text-ink-3">{t('private.empty')}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {deliveries.map((item) => (
            <li
              key={`${item.date}-${item.item}`}
              className="border-b border-line py-2.5 text-sm last:border-0 last:pb-0"
            >
              <div className="flex items-baseline gap-2.5">
                <span className="num w-[42px] shrink-0 text-[11px] font-semibold text-ink-3">
                  {fmt.day(item.date)}
                </span>
                <span className="min-w-0 flex-1 tracking-[-.01em]">{item.item}</span>
                <span className="num shrink-0 font-bold">{fmt.uah(item.amount)}</span>
              </div>
              <p className="mt-1 pl-[52px] text-[11.5px] text-ink-3">
                {item.unit} · {item.region}
              </p>
            </li>
          ))}
        </ul>
      )}

      <SubHeading>{t('private.h.pending')}</SubHeading>
      {pendingItems.length === 0 ? (
        <p className="text-[12.5px] text-ink-3">{t('private.empty')}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {pendingItems.map((item) => (
            <li key={item.item} className="border-b border-line py-2.5 last:border-0 last:pb-0">
              <div className="flex items-baseline gap-2.5 text-sm">
                <span className="min-w-0 flex-1 tracking-[-.01em]">{item.item}</span>
                <span className="num shrink-0 font-bold">{fmt.uah(item.amount)}</span>
              </div>
              <p className="mt-1 text-[11.5px] text-ink-3">{item.note}</p>
            </li>
          ))}
        </ul>
      )}

      <SubHeading>{t('private.h.suppliers')}</SubHeading>
      {suppliers.length === 0 ? (
        <p className="text-[12.5px] text-ink-3">{t('private.empty')}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {suppliers.map((item) => (
            <li
              key={item.name}
              className="flex items-baseline gap-2.5 border-b border-line py-2.5 text-sm last:border-0 last:pb-0"
            >
              <span className="min-w-0 flex-1 tracking-[-.01em]">{item.name}</span>
              <span className="num shrink-0 font-bold">{fmt.uah(item.spentUah)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3.5 text-[12.5px] leading-relaxed text-ink-3">
        {t('private.generated', { date: report.generatedAt ?? '' })}
      </p>
    </>
  )
}
