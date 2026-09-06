interface TabsProps<T extends string> {
  value: T
  options: ReadonlyArray<{ id: T; label: string }>
  onChange: (id: T) => void
}

export function Tabs<T extends string>({ value, options, onChange }: TabsProps<T>) {
  return (
    <div role="tablist" className="mb-3.5 grid grid-cols-2 gap-1 rounded-[13px] bg-[var(--bank-tint)] p-1">
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={`min-h-11 rounded-[10px] py-3 text-sm font-bold transition ${
              active ? 'bg-card text-ink shadow-[0_1px_2px_rgb(26_29_26/.1)]' : 'text-ink-2'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
