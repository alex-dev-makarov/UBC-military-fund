import { useEffect, useState } from 'react'

const STORAGE_KEY = 'donationBoostUntil'
const EVENT = 'donation-intent'
const BOOST_MS = 3 * 60_000

let memoryUntil = 0

function readUntil(): number {
  try {
    return Math.max(memoryUntil, Number(sessionStorage.getItem(STORAGE_KEY)) || 0)
  } catch {
    return memoryUntil
  }
}

export function markDonationIntent(): void {
  memoryUntil = Date.now() + BOOST_MS
  try {
    sessionStorage.setItem(STORAGE_KEY, String(memoryUntil))
  } catch {}
  window.dispatchEvent(new Event(EVENT))
}

export function useDonationBoost(): boolean {
  const [boosted, setBoosted] = useState(() => readUntil() > Date.now())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const sync = () => {
      clearTimeout(timer)
      const left = readUntil() - Date.now()
      setBoosted(left > 0)
      if (left > 0) timer = setTimeout(sync, left)
    }

    sync()
    window.addEventListener(EVENT, sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(EVENT, sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  return boosted
}
