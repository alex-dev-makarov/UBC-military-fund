import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@shared/i18n'

const stamp = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const tile = (text: string) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="120">` +
    `<text x="115" y="64" text-anchor="middle" transform="rotate(-22 115 60)" ` +
    `font-family="Lexend, system-ui, sans-serif" font-size="10.5" font-weight="600" ` +
    `fill="rgb(26,29,26)" fill-opacity=".02">${text}</text></svg>`
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`
}

function usePageActive(): boolean {
  const [active, setActive] = useState(true)

  useEffect(() => {
    const update = () => setActive(document.visibilityState === 'visible' && document.hasFocus())
    const hide = () => setActive(false)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    window.addEventListener('blur', hide)
    window.addEventListener('pagehide', hide)
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
      window.removeEventListener('blur', hide)
      window.removeEventListener('pagehide', hide)
    }
  }, [])

  return active
}

export function Protected({
  telegramId,
  viewedAt,
  children,
}: {
  telegramId: number
  viewedAt: string
  children: ReactNode
}) {
  const t = useT()
  const active = usePageActive()
  const block = (event: { preventDefault: () => void }) => event.preventDefault()
  const label = `ID ${telegramId} · ${stamp(viewedAt)}`

  return (
    <div
      data-sensitive
      className="relative select-none pb-12 [-webkit-touch-callout:none]"
      onCopy={block}
      onCut={block}
      onContextMenu={block}
      onDragStart={block}
    >
      <div
        aria-hidden={!active}
        className={`transition-[filter] duration-150 ${active ? '' : 'pointer-events-none blur-xl'}`}
      >
        {children}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{ backgroundImage: tile(label) }}
      />

      {createPortal(
        <div
          data-sensitive
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/90 px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] backdrop-blur"
        >
          <p className="num mx-auto max-w-[480px] truncate text-center text-[11.5px] font-semibold tracking-[.01em] text-ink-2">
            🔒 {t('private.viewer', { who: label })}
          </p>
        </div>,
        document.body,
      )}

      {!active && (
        <div className="absolute inset-x-0 top-24 z-20 flex justify-center px-4">
          <p className="surface max-w-[30ch] px-5 py-4 text-center text-[13px] font-semibold leading-relaxed">
            🔒 {t('private.hidden')}
          </p>
        </div>
      )}
    </div>
  )
}
