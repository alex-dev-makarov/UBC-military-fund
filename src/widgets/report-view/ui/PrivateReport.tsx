import { useState } from 'react'
import { useGetSecretReportQuery, getFetchErrorStatus } from '@shared/api'
import type { LedgerExpense, LedgerPerson, PrivateReport as PrivateReportDto } from '@shared/api'
import { useI18n } from '@shared/i18n'
import { Card } from '@shared/ui'
import { MonthlyBars, type MonthTotal } from './MonthlyBars'
import { Protected } from './Protected'

type I18n = ReturnType<typeof useI18n>

const Label = ({ children }: { children: string }) => (
  <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[.14em] text-ink-3">
    {children}
  </span>
)

const Heading = ({ children }: { children: string }) => (
  <h3 className="mb-2.5 mt-6 pl-0.5 text-[13px] font-bold tracking-[.02em] text-ink-2">{children}</h3>
)

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden="true">
    <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const initials = (name: string) =>
  name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

const Avatar = ({ name }: { name: string }) => (
  <span
    aria-hidden
    className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--bank-tint)] text-[12px] font-bold tracking-[.02em] text-ink-2"
  >
    {initials(name)}
  </span>
)

export function PrivateReport({ onSessionExpired }: { onSessionExpired?: () => void } = {}) {
  const i18n = useI18n()
  const { t } = i18n
  const { data: report, error, refetch } = useGetSecretReportQuery()

  const errorStatus = getFetchErrorStatus(error)

  if (errorStatus === 401) {
    onSessionExpired?.()
    return null
  }

  if (errorStatus === 403) {
    return (
      <Card>
        <p className="text-sm font-bold tracking-[-.01em]">{t('private.denied.title')}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{t('private.denied.text')}</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm font-bold tracking-[-.01em]">{t('private.error.title')}</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{t('private.error.text')}</p>
        <button
          type="button"
          onClick={() => void refetch()}
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
    <Protected telegramId={report.viewer.telegramId} viewedAt={report.viewer.viewedAt}>
      <ReportBody report={report} i18n={i18n} />
    </Protected>
  )
}

function ReportBody({ report, i18n }: { report: PrivateReportDto; i18n: I18n }) {
  const { t, fmt } = i18n
  const [person, setPerson] = useState<string | null>(null)
  const [month, setMonth] = useState<number | null>(null)

  const allReceipts = report.years.every((year) => year.hasReceipt)
  const expenses = person ? report.expenses.filter((e) => e.person === person) : report.expenses
  const summarized = person ? [] : report.years.filter((year) => year.summarized)

  const itemizedYears = report.years
    .filter((year) => !year.summarized && year.count > 0)
    .map((year) => year.year)
    .join(', ')

  const toggle = (name: string) => setPerson((current) => (current === name ? null : name))

  const itemized = report.expenses.filter((e) => itemizedYears.includes(e.date.slice(0, 4)))
  const itemizedTotal = itemized.reduce((sum, e) => sum + e.total, 0)
  const lastYear = itemizedYears.split(', ').at(-1) ?? ''
  const monthly = monthTotals(expenses.filter((e) => e.date.startsWith(`${lastYear}-`)), report.expenses, lastYear)

  return (
    <>
      <Card>
        <Label>{t('private.total')}</Label>
        <span className="num block text-[clamp(26px,7.4vw,33px)] font-extrabold leading-none tracking-[-.03em]">
          {fmt.uahExact(report.total)}
        </span>

        <div className="mt-4 flex flex-col gap-2.5">
          {report.years.map((year) => (
            <div key={year.year}>
              <div className="mb-1 flex items-baseline gap-2 text-[13px]">
                <span className="num font-bold">{year.year}</span>
                <span className="min-w-0 flex-1 text-[11.5px] text-ink-3">
                  {year.summarized
                    ? t('private.year.summary')
                    : t('private.year.items', {
                        n: String(year.count),
                        unit: t(`private.unit.${fmt.pluralKey(year.count)}`),
                      })}
                </span>
                <span className="num font-semibold text-ink-2">{fmt.uah(year.total)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-[4px] bg-line">
                <i
                  className="block h-full rounded-[4px] bg-[var(--bank-bar)]"
                  style={{ width: `${report.total ? (year.total / report.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat value={String(report.people.length)} label={t('private.stat.people')} />
          <Stat
            value={fmt.uah(itemized.length ? itemizedTotal / itemized.length : 0)}
            label={t('private.stat.average')}
          />
        </div>

        <p
          className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
            allReceipts ? 'bg-[var(--bank-tint)] text-[var(--bank-accent)]' : 'bg-line text-ink-2'
          }`}
        >
          {allReceipts && <CheckIcon />}
          {t(allReceipts ? 'private.receipts.all' : 'private.receipts.some')}
        </p>
      </Card>

      <Heading>{t('private.h.monthly', { year: lastYear })}</Heading>
      <Filter people={report.people} active={person} onPick={setPerson} i18n={i18n} />
      <Card>
        {person && <p className="mb-3 text-[12.5px] font-semibold text-ink-2">{person}</p>}
        <MonthlyBars
          months={monthly}
          label={t('private.h.monthly', { year: lastYear })}
          selected={month}
          onSelect={setMonth}
        />
        {month !== null && (
          <MonthDetails
            month={month}
            year={lastYear}
            expenses={expenses.filter((e) => e.date.startsWith(`${lastYear}-${String(month).padStart(2, '0')}`))}
            onClose={() => setMonth(null)}
            i18n={i18n}
          />
        )}
        {month === null && <p className="mt-3 text-[12px] text-ink-3">{t('private.month.hint')}</p>}
      </Card>

      {report.people.length > 0 && (
        <>
          <Heading>{t('private.h.people')}</Heading>
          <Card>
            <PeopleList people={report.people} total={report.total} active={person} onPick={toggle} i18n={i18n} />
            <p className="mt-3.5 text-[12.5px] leading-relaxed text-ink-3">{t('private.people.note')}</p>
          </Card>
        </>
      )}

      <Heading>
        {person ? `${t('private.h.ledger', { years: itemizedYears })} · ${person}` : t('private.h.ledger', { years: itemizedYears })}
      </Heading>
      <Card>
        {expenses.length === 0 && summarized.length === 0 ? (
          <p className="text-[12.5px] text-ink-3">{t('private.empty')}</p>
        ) : (
          <Ledger expenses={expenses} i18n={i18n} />
        )}

        {summarized.map((year) => (
          <div
            key={year.year}
            className="mt-3 flex items-baseline gap-2.5 border-t border-line pt-3 text-sm"
          >
            <span className="min-w-0 flex-1 tracking-[-.01em] text-ink-2">
              {t('private.summary.row', { year: String(year.year) })}
            </span>
            <span className="num shrink-0 font-bold">{fmt.uahExact(year.total)}</span>
          </div>
        ))}
      </Card>

      <p className="mt-3.5 flex gap-2 px-0.5 text-[12px] leading-relaxed text-ink-3">
        <span aria-hidden>🔒</span>
        <span>
          {t('private.confidential')}
          {report.generatedAt && <> {t('private.generated', { date: report.generatedAt })}.</>}
        </span>
      </p>
    </>
  )
}

function monthTotals(expenses: LedgerExpense[], all: LedgerExpense[], year: string): MonthTotal[] {
  const last = Math.max(1, ...all.filter((e) => e.date.startsWith(`${year}-`)).map((e) => Number(e.date.slice(5, 7))))
  const months = Array.from({ length: last }, (_, i) => ({ month: i + 1, total: 0, count: 0 }))
  for (const e of expenses) {
    const m = months[Number(e.date.slice(5, 7)) - 1]
    if (!m) continue
    m.total += e.total
    m.count += 1
  }
  return months
}

function MonthDetails({
  month,
  year,
  expenses,
  onClose,
  i18n,
}: {
  month: number
  year: string
  expenses: LedgerExpense[]
  onClose: () => void
  i18n: I18n
}) {
  const { t, fmt } = i18n
  const groups = new Map<string, { total: number; items: LedgerExpense[] }>()
  for (const e of expenses) {
    const name = e.person ?? t('private.no.person')
    const group = groups.get(name) ?? { total: 0, items: [] }
    group.total += e.total
    group.items.push(e)
    groups.set(name, group)
  }
  const rows = [...groups].sort((a, b) => b[1].total - a[1].total)
  const total = expenses.reduce((sum, e) => sum + e.total, 0)
  const title = fmt.monthLong(month)

  return (
    <div className="mt-4 border-t border-line pt-3.5">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="min-w-0 flex-1 text-[13px] font-bold first-letter:uppercase">
          {title} {year}
        </span>
        <span className="num text-[13px] font-bold">{fmt.uahExact(total)}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('private.month.close')}
          className="tap -mr-1.5 grid size-8 place-items-center rounded-lg text-ink-3"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-[12.5px] text-ink-3">{t('private.empty')}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {rows.map(([name, group]) => (
            <li key={name} className="flex items-start gap-3 border-b border-line py-2.5 last:border-0 last:pb-0">
              <Avatar name={name} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[-.01em]">{name}</span>
                  <span className="num shrink-0 text-sm font-bold">{fmt.uah(group.total)}</span>
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-3">
                  {group.items.map((e) => `${fmt.day(e.date)} ${e.item}`).join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="rounded-xl bg-[var(--bank-tint)] px-3 py-2.5">
    <span className="num block text-[15px] font-extrabold leading-tight tracking-[-.02em]">{value}</span>
    <span className="mt-0.5 block text-[11px] text-ink-3">{label}</span>
  </div>
)

function PeopleList({
  people,
  total,
  active,
  onPick,
  i18n,
}: {
  people: LedgerPerson[]
  total: number
  active: string | null
  onPick: (name: string) => void
  i18n: I18n
}) {
  const { t, fmt } = i18n
  const max = people[0]?.total ?? 0

  return (
    <ul className="m-0 list-none p-0">
      {people.map((p) => {
        const selected = active === p.name
        return (
          <li key={p.name} className="border-b border-line last:border-0">
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onPick(p.name)}
              className={`tap -mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-xl px-2 py-2.5 text-left ${
                selected ? 'bg-[var(--bank-tint)]' : ''
              }`}
            >
              <Avatar name={p.name} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[-.01em]">
                    {p.name}
                  </span>
                  <span className="num shrink-0 text-sm font-bold">{fmt.uah(p.total)}</span>
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-[4px] bg-line">
                    <i
                      className="block h-full rounded-[4px] bg-[var(--bank-bar)]"
                      style={{ width: `${max ? (p.total / max) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="num w-[86px] shrink-0 text-right text-[11px] text-ink-3">
                    {p.count} {t(`private.unit.${fmt.pluralKey(p.count)}`)} · {fmt.share(p.total, total)}
                  </span>
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Filter({
  people,
  active,
  onPick,
  i18n,
}: {
  people: LedgerPerson[]
  active: string | null
  onPick: (name: string | null) => void
  i18n: I18n
}) {
  const { t } = i18n
  if (people.length === 0) return null

  const chip = (label: string, value: string | null) => {
    const selected = active === value
    return (
      <button
        key={label}
        type="button"
        aria-pressed={selected}
        onClick={() => onPick(value)}
        className={`tap shrink-0 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold ${
          selected
            ? 'border-[var(--bank-accent)] bg-[var(--bank-accent)] text-white'
            : 'border-line bg-card text-ink-2'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {chip(t('private.filter.all'), null)}
      {people.map((p) => chip(p.name, p.name))}
    </div>
  )
}

function Ledger({ expenses, i18n }: { expenses: LedgerExpense[]; i18n: I18n }) {
  const { t, fmt } = i18n

  const months: Array<{ key: string; items: LedgerExpense[]; total: number }> = []
  for (const expense of expenses) {
    const key = expense.date.slice(0, 7)
    const last = months.at(-1)
    if (last?.key === key) {
      last.items.push(expense)
      last.total += expense.total
    } else {
      months.push({ key, items: [expense], total: expense.total })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {months.map((month) => {
        const [year, mm] = month.key.split('-')
        const name = fmt.monthLong(Number(mm))
        return (
          <section key={month.key}>
            <div className="mb-1 flex items-baseline gap-2 border-b border-line pb-1.5">
              <span className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[.12em] text-ink-3">
                {name} {year}
              </span>
              <span className="num text-[11.5px] font-semibold text-ink-3">{fmt.uah(month.total)}</span>
            </div>
            <ul className="m-0 list-none p-0">
              {month.items.map((e) => (
                <li key={e.id} className="border-b border-line py-2.5 last:border-0 last:pb-0">
                  <div className="flex items-baseline gap-2.5">
                    <span className="num w-[38px] shrink-0 text-[11px] font-semibold text-ink-3">
                      {fmt.day(e.date)}
                    </span>
                    <span className="min-w-0 flex-1 text-sm tracking-[-.01em]">{e.item}</span>
                    <span className="num shrink-0 text-sm font-bold">{fmt.uahExact(e.total)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-[48px] text-[11.5px] text-ink-3">
                    <span className="font-semibold text-ink-2">{e.person ?? t('private.no.person')}</span>
                    {e.note && <span>· {e.note}</span>}
                    {e.commission > 0 && <span>· {t('private.commission', { amount: fmt.uahExact(e.commission) })}</span>}
                    {e.delivery > 0 && <span>· {t('private.delivery', { amount: fmt.uahExact(e.delivery) })}</span>}
                    <span className={`ml-auto inline-flex items-center gap-1 ${e.hasReceipt ? 'text-[var(--bank-accent)]' : ''}`}>
                      {e.hasReceipt && <CheckIcon />}
                      {t(e.hasReceipt ? 'private.receipt' : 'private.no.receipt')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
