import { useNavigate } from 'react-router'
import { BankMark, BankRow, banks } from '@entities/bank'
import { useT } from '@shared/i18n'
import { Sheet } from '@shared/ui'

interface Props {
  open: boolean
  onClose: () => void
}

export function BankSheet({ open, onClose }: Props) {
  const navigate = useNavigate()
  const t = useT()

  return (
    <Sheet open={open} onClose={onClose} title={t('sheet.title')} subtitle={t('sheet.subtitle')}>
      <div className="flex flex-col gap-2.5">
        {banks.map((bank) => (
          <BankRow
            key={bank.id}
            bank={bank.id}
            mark={<BankMark bank={bank} />}
            title={t(bank.nameKey)}
            hint={t(bank.hintKey)}
            onClick={() => {
              onClose()
              navigate(`/${bank.id}`)
            }}
          />
        ))}
      </div>
    </Sheet>
  )
}
