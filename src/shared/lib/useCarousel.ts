import {useEffect, useRef, useState} from 'react'

interface Options {
  count: number
  interval?: number
  threshold?: number
}

export function useCarousel({ count, interval = 4200, threshold = 42 }: Options) {
  const [index, setIndex] = useState(0)
  const [drag, setDrag] = useState(0)
  const [held, setHeld] = useState(false)
  const pointer = useRef<number | null>(null)
  const origin = useRef({ x: 0, y: 0 })
  const horizontal = useRef(false)

  const go = (next: number) => setIndex((next + count) % count)

  useEffect(() => {
    if (held || count < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = setInterval(() => setIndex((current) => (current + 1) % count), interval)
    const onVisibility = () => document.hidden && clearInterval(id)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [held, count, interval])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || pointer.current !== null) return
    pointer.current = event.pointerId
    origin.current = { x: event.clientX, y: event.clientY }
    horizontal.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointer.current) return

    const dx = event.clientX - origin.current.x
    const dy = event.clientY - origin.current.y

    if (!horizontal.current) {
      if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) {
        pointer.current = null
        return
      }
      if (Math.abs(dx) > 8) {
        horizontal.current = true
        setHeld(true)
      } else return
    }

    const atEdge =
      (index === 0 && dx > 0) || (index === count - 1 && dx < 0)
    setDrag(atEdge ? dx / 3 : dx)
  }

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointer.current && pointer.current !== null) return

    const moved = horizontal.current && Math.abs(drag) > threshold
    if (moved) go(index + (drag < 0 ? 1 : -1))

    pointer.current = null
    horizontal.current = false
    setDrag(0)
  }

  const select = (next: number) => {
      setHeld(true)
      go(next)
    }

  return {
    index,
    drag,
    dragging: horizontal.current,
    select,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  }
}
