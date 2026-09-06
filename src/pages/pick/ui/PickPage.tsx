import logo from '@assets/logo.svg'
import { BankPicker } from '@widgets/bank-picker'
import { Rich, useT } from '@shared/i18n'

export function PickPage() {
  const t = useT()

  return (
    <section className="animate-[rise_.3s_cubic-bezier(.2,.8,.3,1)]">
      <div className="mb-2.5 flex items-center gap-3">
        <img src={logo} alt="" aria-hidden className="h-13 w-auto shrink-0" />
        <p className="text-[10.5px] font-medium uppercase tracking-[.18em] text-field-soft">
          {t('pick.eyebrow')}
        </p>
      </div>

      <h1 className="mb-2 text-[clamp(27px,7.2vw,36px)] font-extrabold leading-[1.06] tracking-[-.025em]">
        <Rich
          text={t('pick.title')}
          slots={{ bank: <em className="not-italic text-field">{t('pick.title.bank')}</em> }}
        />
      </h1>
      <p className="mb-5.5 max-w-[34ch] text-[15px] text-ink-2">{t('pick.subtitle')}</p>

      <BankPicker />
    </section>
  )
}
