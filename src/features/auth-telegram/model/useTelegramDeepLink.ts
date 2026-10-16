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
  url: string
}

const readPending = (): Pending | null => {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(PENDING_KEY) ?? 'null') as Pending | null
    return value && typeof value.nonce === 'string' && typeof value.code === 'number' && typeof value.url === 'string'
      ? value
      : null
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

function usePageActive(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  const [focused, setFocused] = useState(true)

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === 'visible')
    const onFocus = () => setFocused(true)
    const onBlur = () => setFocused(false)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return visible && focused
}

export function useTelegramDeepLink(onAuthorized: (user: AuthUser) => void): DeepLinkLogin {
  const [phase, setPhase] = useState<Phase>('idle')
  const [nonce, setNonce] = useState<string | null>(null)
  const [code, setCode] = useState<number | null>(null)
  const [url, setUrl] = useState<string | null>(null)
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
  const active = usePageActive()

  const { data: pollResult, error: pollError, refetch: refetchPoll } = usePollTelegramQuery(nonce || '', {
    skip: !shouldPoll || !active,
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
    setUrl(pending.url)
    setPhase('waiting')
  }, [])

  useEffect(() => {
    if (!shouldPoll || !active) return
    try {
      void refetchPoll()
    } catch {}
  }, [shouldPoll, active, refetchPoll])

  const start = () => {
    setPhase('waiting')
    void startTelegram().then((result) => {
      if (!alive.current) return
      if ('data' in result && result.data) {
        const { nonce, code, url } = result.data
        writePending({ nonce, code, url })
        setNonce(nonce)
        setCode(code)
        setUrl(url)
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
    setUrl(null)
  }

  return { phase, url, code, start, cancel }
}
