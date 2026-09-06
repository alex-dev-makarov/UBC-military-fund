import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '@shared/i18n'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
}

const DESKTOP = '(min-width: 640px)'

export function Sheet({ open, onClose, title, subtitle, children }: SheetProps) {
  const t = useT()
  const [mounted, setMounted] = useState(false)
  const [shown, setShown] = useState(false)
  const [offset, setOffset] = useState(0)
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP).matches,
  )
  const panel = useRef<HTMLDivElement>(null)
  const start = useRef<number | null>(null)

  useEffect(() => {
    const query = window.matchMedia(DESKTOP)
    const sync = () => setDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => setShown(true))
      document.body.style.overflow = 'hidden'
      return () => cancelAnimationFrame(id)
    }

    setShown(false)
    document.body.style.overflow = ''
    const id = setTimeout(() => setMounted(false), 300)
    return () => clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    panel.current?.focus()
  }, [open])

  if (!mounted) return null

  const hidden = desktop ? 'translateY(12px) scale(.97)' : 'translateY(102%)'
  const visible = desktop ? 'translateY(0) scale(1)' : `translateY(${offset}px)`

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={onClose}
        className={`absolute inset-0 bg-[rgb(20_24_19/.5)] transition-opacity duration-300 ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          transform: shown ? visible : hidden,
          opacity: desktop && !shown ? 0 : 1,
          transition: offset && !desktop ? 'none' : undefined,
        }}
        onTouchStart={(event) => {
          if (desktop || (panel.current?.scrollTop ?? 0) > 0) return
          start.current = event.touches[0]?.clientY ?? null
        }}
        onTouchMove={(event) => {
          if (start.current === null) return
          const delta = (event.touches[0]?.clientY ?? 0) - start.current
          if (delta > 0) setOffset(delta)
        }}
        onTouchEnd={() => {
          if (offset > 90) onClose()
          setOffset(0)
          start.current = null
        }}
        className="relative max-h-[88vh] w-full max-w-[468px] overflow-y-auto rounded-t-[22px] bg-bg px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-2.5 outline-none duration-300 ease-[cubic-bezier(.25,.9,.3,1)] sm:max-h-[86vh] sm:rounded-[22px] sm:px-5 sm:pb-5 sm:pt-5 sm:shadow-[0_24px_60px_-20px_rgb(20_24_19/.45)]"
      >
        <span className="mx-auto mb-3.5 block h-1 w-9 rounded-sm bg-line sm:hidden" />
        <h2 className="text-[19px] font-extrabold tracking-[-.02em]">{title}</h2>
        {subtitle && <p className="mb-4 mt-0.5 text-[13.5px] text-ink-3">{subtitle}</p>}
        {children}
        <button
          type="button"
          onClick={onClose}
          className="tap mt-2 w-full rounded-xl py-3.5 text-[14.5px] font-bold text-ink-3 active:bg-line sm:hover:bg-line"
        >
          {t('common.notNow')}
        </button>
      </div>
    </div>
  )
}
