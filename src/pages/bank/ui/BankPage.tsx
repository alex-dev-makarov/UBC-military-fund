import { Fragment, useState, type ReactNode } from 'react'
import { BankMark } from '@entities/bank'
import { useFund } from '@entities/fund'
import { CopyCard } from '@features/copy-card'
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
import type { BankBlock, BankPageConfig, BankSlotContext } from '../model/types'

type Mode = 'monthly' | 'once'

interface BankPageProps {
  config: BankPageConfig
}

function renderBlock(block: BankBlock, ctx: BankSlotContext): ReactNode {
  const { t, fund } = ctx

  switch (block.kind) {
    case 'note':
      return <Note>{block.rich ? <Rich text={t(block.key)} /> : t(block.key)}</Note>
    case 'para':
      return <p>{block.rich ? <Rich text={t(block.key)} /> : t(block.key)}</p>
    case 'foot':
      return <Foot>{block.rich ? <Rich text={t(block.key)} /> : t(block.key)}</Foot>
    case 'divider':
      return <Divider>{t(block.key)}</Divider>
    case 'shot':
      return <Shot src={block.src} alt={t(block.altKey)} />
    case 'copyCard': {
      const card = <CopyCard label={t('common.card')} value={fund.card} trust={t(block.trustKey)} />
      return block.wrapClass ? <div className={block.wrapClass}>{card}</div> : card
    }
    case 'cta': {
      const link = (
        <CtaLink href={block.href(fund)} onClick={block.onClick}>
          {t(block.labelKey)}
        </CtaLink>
      )
      return block.wrapClass ? <div className={block.wrapClass}>{link}</div> : link
    }
    case 'ctaNote':
      return <CtaNote>{t(block.key)}</CtaNote>
    case 'steps':
      return (
        <Steps>
          {block.steps.map((step, i) => (
            <Step key={i} index={i + 1} title={t(step.titleKey)} last={i === block.steps.length - 1}>
              {step.blocks.map((child, j) => (
                <Fragment key={j}>{renderBlock(child, ctx)}</Fragment>
              ))}
            </Step>
          ))}
        </Steps>
      )
    case 'slot':
      return block.render(ctx)
  }
}

export function BankPage({ config }: BankPageProps) {
  const [mode, setMode] = useState<Mode>('monthly')
  const t = useT()
  const fund = useFund()
  const ctx: BankSlotContext = { t, fund }
  const blocks = config.once !== null && mode === 'once' ? config.once : config.monthly

  return (
    <Screen bank={config.bank.id}>
      <BackButton />
      <Crumb mark={<BankMark bank={config.bank} size="sm" />} title={t(config.titleKey)} />

      {config.once !== null && (
        <Tabs
          value={mode}
          onChange={setMode}
          options={[
            { id: 'monthly', label: t('common.tab.monthly') },
            { id: 'once', label: t('common.tab.once') },
          ]}
        />
      )}

      <Card>
        {blocks.map((block, i) => (
          <Fragment key={i}>{renderBlock(block, ctx)}</Fragment>
        ))}
      </Card>
    </Screen>
  )
}
