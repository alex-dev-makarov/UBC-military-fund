import { useEffect, useRef, useState } from 'react'
import { useGetAuthMeQuery } from '@shared/api'
import { getFetchErrorStatus } from '@shared/api'
import type { AuthUser } from '@shared/api'
import type { AuthStatus } from './types'

interface TelegramAuth {
  status: AuthStatus
  user: AuthUser | null

  adopt: (user: AuthUser) => void

  recheck: () => void
}

export function useTelegramAuth(): TelegramAuth {
  const [adoptedUser, setAdoptedUser] = useState<AuthUser | null>(null)
  const alive = useRef(true)

  const { data: user, isLoading, error, refetch } = useGetAuthMeQuery()

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const recheck = () => {
    void refetch()
  }

  const adopt = (user: AuthUser) => {
    if (!alive.current) return
    setAdoptedUser(user)
  }

  if (adoptedUser) {
    return { status: 'member', user: adoptedUser, adopt, recheck }
  }

  if (isLoading) {
    return { status: 'checking', user: null, adopt, recheck }
  }

  if (error) {
    const status = getFetchErrorStatus(error)
    const telegramStatus: AuthStatus = status === 401 ? 'anonymous' : 'error'
    return { status: telegramStatus, user: null, adopt, recheck }
  }

  if (user) {
    return { status: 'member', user, adopt, recheck }
  }

  return { status: 'checking', user: null, adopt, recheck }
}
