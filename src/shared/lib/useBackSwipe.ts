import {useRef, useState} from 'react'

export function useBackSwipe(onBack: () => void, enabled: boolean) {
  const [offset, setOffset] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const horizontal = useRef(false)

  const reset = (animate: boolean) => {
    setSnapping(animate)
    setOffset(0)
    origin.current = null
    horizontal.current = false
    if (animate) setTimeout(() => setSnapping(false), 240)
  }

  const onTouchStart = (event: React.TouchEvent) => {
    if (!enabled || event.touches.length > 1) return
    const target = event.target as HTMLElement
    if (target.closest('[data-no-swipe]')) return

    const touch = event.touches[0]
    if (!touch) return
    origin.current = { x: touch.clientX, y: touch.clientY }
    horizontal.current = false
    setSnapping(false)
  }

  const onTouchMove = (event: React.TouchEvent) => {
    if (!origin.current) return
    const touch = event.touches[0]
    if (!touch) return

    const dx = touch.clientX - origin.current.x
    const dy = touch.clientY - origin.current.y

    if (!horizontal.current) {
      if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx)) {
        origin.current = null
        return
      }
      if (dx > 14) horizontal.current = true
      else return
    }

    setOffset(Math.min(dx * 0.45, 84))
  }

  const onTouchEnd = (event: React.TouchEvent) => {
    if (!origin.current) return reset(false)
    const touch = event.changedTouches[0]
    const dx = touch ? touch.clientX - origin.current.x : 0
    const fired = horizontal.current && dx > 72
    reset(true)
    if (fired) onBack()
  }

  return {
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: () => reset(true) },
    style: {
      transform: offset ? `translateX(${offset}px)` : undefined,
      opacity: offset ? 1 - Math.min(offset / 380, 0.22) : undefined,
      transition: snapping ? 'transform .22s ease-out, opacity .22s ease-out' : undefined,
    },
  }
}
