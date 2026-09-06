import type { ReactNode } from 'react'
import { useT, type TKey } from '@shared/i18n'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[19px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

interface ChipData {
  id: string
  labelKey: TKey
  icon: ReactNode
  target?: boolean
}

const chips: ChipData[] = [
  {
    id: 'share',
    labelKey: 'mono.step3.chip.share',
    icon: (
      <Icon>
        <path d="M12 16V4M8 8l4-4 4 4M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
      </Icon>
    ),
  },
  {
    id: 'topup',
    labelKey: 'mono.step3.chip.topup',
    icon: (
      <Icon>
        <path d="M12 4v12M8 12l4 4 4-4M4 18v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
      </Icon>
    ),
  },
  {
    id: 'setup',
    labelKey: 'mono.step3.chip.setup',
    target: true,
    icon: (
      <Icon>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <path d="M12 9v6M9 12h6" />
      </Icon>
    ),
  },
  {
    id: 'favourite',
    labelKey: 'mono.step3.chip.favourite',
    icon: (
      <Icon>
        <path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z" />
      </Icon>
    ),
  },
  {
    id: 'statement',
    labelKey: 'mono.step3.chip.statement',
    icon: (
      <Icon>
        <path d="M6 3h9l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
        <path d="M9 12h6M9 16h4" />
      </Icon>
    ),
  },
]

/** Static replica of the mono jar action row — the button to reach is off-screen. */
export function MonoReplica() {
  const t = useT()

  return (
    <div
      aria-hidden="true"
      data-no-swipe
      className="mt-3 flex gap-2.5 overflow-x-auto rounded-[14px] border border-line bg-card px-3 py-3.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => (
        <div
          key={chip.id}
          className={`flex w-[78px] shrink-0 flex-col items-center gap-1.5 text-center ${
            chip.target ? 'text-[var(--bank-accent)]' : 'text-ink-3'
          }`}
        >
          <div
            className={`flex size-11 items-center justify-center rounded-full border ${
              chip.target
                ? 'border-[var(--bank-accent)] bg-[var(--bank-tint)]'
                : 'border-line bg-bg'
            }`}
          >
            {chip.icon}
          </div>
          <span
            className={`text-[10.5px] leading-tight ${chip.target ? 'font-bold' : 'font-medium'}`}
          >
            {t(chip.labelKey)}
          </span>
        </div>
      ))}
    </div>
  )
}
