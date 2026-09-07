import { useEffect, useRef, useState } from 'react'
import {
  useStartTelegramMutation,
  usePollTelegramQuery,
  type AuthUser,
  getFetchErrorStatus,
} from '@shared/api'

type Phase = 'idle' | 'waiting' | 'authorized' | 'denied' | 'expired' | 'error'

const PENDING_KEY = 'ubc:pending-nonce'

const readPending = (): string | null => {
  try {
    return window.sessionStorage.getItem(PENDING_KEY)
  } catch {
    return null
  }
}

const writePending = (nonce: string | null) => {
  try {
    if (nonce === null) window.sessionStorage.removeItem(PENDING_KEY)
    else window.sessionStorage.setItem(PENDING_KEY, nonce)
  } catch {}
}

interface DeepLinkLogin {
  phase: Phase

  url: string | null
  start: () => void
  cancel: () => void
}

export function useTelegramDeepLink(onAuthorized: (user: AuthUser) => void): DeepLinkLogin {
  const [phase, setPhase] = useState<Phase>('idle')
  const [url, setUrl] = useState<string | null>(null)
  const [nonce, setNonce] = useState<string | null>(null)
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

  const { data: pollResult, error: pollError } = usePollTelegramQuery(nonce || '', {
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
    setNonce(pending)
    setPhase('waiting')
  }, [])

  const start = () => {
    setPhase('waiting')

    void startTelegram().then((result) => {
      if (!alive.current) return
      if ('data' in result && result.data) {
        const bot = import.meta.env.VITE_TELEGRAM_BOT
        const link = `https://t.me/${bot}?start=${result.data.nonce}`
        setUrl(link)
        writePending(result.data.nonce)
        setNonce(result.data.nonce)
        window.location.assign(link)
      } else {
        if (alive.current) setPhase('error')
      }
    })
  }

  const cancel = () => {
    writePending(null)
    setPhase('idle')
    setUrl(null)
    setNonce(null)
  }

  return { phase, url, start, cancel }
}
