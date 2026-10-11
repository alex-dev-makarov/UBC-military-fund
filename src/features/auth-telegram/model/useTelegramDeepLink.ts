import { useEffect, useRef, useState } from 'react'
import {
  useStartTelegramMutation,
  usePollTelegramQuery,
  type AuthUser,
  getFetchErrorStatus,
} from '@shared/api'

type Phase = 'idle' | 'waiting' | 'authorized' | 'denied' | 'expired' | 'error'

const PENDING_KEY = 'ubc:pending-nonce'

interface Pending {
  nonce: string
  code: number
}

const readPending = (): Pending | null => {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null
    return value && typeof value.nonce === 'string' && typeof value.code === 'number' ? value : null
  } catch {
    return null
  }
}

const writePending = (pending: Pending | null) => {
  try {
    if (pending === null) window.sessionStorage.removeItem(PENDING_KEY)
    else window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {}
}

interface DeepLinkLogin {
  phase: Phase

  url: string | null
  code: number | null
  start: () => void
  cancel: () => void
}

export function useTelegramDeepLink(onAuthorized: (user: AuthUser) => void): DeepLinkLogin {
  const [phase, setPhase] = useState<Phase>('idle')
  const [nonce, setNonce] = useState<string | null>(null)
  const [code, setCode] = useState<number | null>(null)
  const alive = useRef(true)
  const onDone = useRef(onAuthorized)

  useEffect(() => {
    onDone.current = onAuthorized
  }, [onAuthorized])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const [startTelegram] = useStartTelegramMutation()

  const shouldPoll = nonce && phase === 'waiting'

  const { data: pollResult, error: pollError, refetch: refetchPoll } = usePollTelegramQuery(nonce || '', {
    skip: !shouldPoll,
    pollingInterval: 1500,
  })

  useEffect(() => {
    if (!pollResult || !alive.current) return

    if (pollResult.status === 'authorized' && pollResult.user) {
      writePending(null)
      setPhase('authorized')
      onDone.current(pollResult.user)
      return
    }

    if (pollResult.status === 'expired') {
      writePending(null)
      setPhase('expired')
      return
    }
  }, [pollResult])

  useEffect(() => {
    if (!pollError || !alive.current) return
    writePending(null)
    const status = getFetchErrorStatus(pollError)
    if (status === 403) {
      setPhase('denied')
    } else {
      setPhase('error')
    }
  }, [pollError])

  useEffect(() => {
    const pending = readPending()
    if (!pending) return
    setNonce(pending.nonce)
    setCode(pending.code)
    setPhase('waiting')
  }, [])

  useEffect(() => {
    if (!shouldPoll) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetchPoll()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [shouldPoll, refetchPoll])

  const start = () => {
    setPhase('waiting')
    void startTelegram().then((result) => {
      if (!alive.current) return
      if ('data' in result && result.data) {
        writePending({ nonce: result.data.nonce, code: result.data.code })
        setNonce(result.data.nonce)
        setCode(result.data.code)
      } else {
        setPhase('error')
      }
    })
  }

  const cancel = () => {
    writePending(null)
    setPhase('idle')
    setNonce(null)
    setCode(null)
  }

  const url = nonce ? `https://t.me/${import.meta.env.VITE_TELEGRAM_BOT}?start=${nonce}` : null

  return { phase, url, code, start, cancel }
}
