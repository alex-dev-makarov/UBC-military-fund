import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { DENIED_PATH, HANDOFF_PARAM, SECRET_PATH } from '@features/auth-telegram'
import { useHandoffTelegramMutation, useSeedAuthUser, getFetchErrorStatus } from '@shared/api'
import { useI18n } from '@shared/i18n'
import { Card, Screen } from '@shared/ui'

export function AuthCallbackPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const seedAuthUser = useSeedAuthUser()
  const { hash, pathname } = useLocation()
  // Captured on first render: the hash is cleared below, but the request still needs the token.
  const [token] = useState(() => new URLSearchParams(hash.slice(1)).get(HANDOFF_PARAM))
  const [handoffTelegram] = useHandoffTelegramMutation()
  const redeemed = useRef(false)

  // Drop the token from the URL right away so it does not stay in history.
  useEffect(() => {
    if (hash) navigate(pathname, { replace: true })
  }, [hash, pathname, navigate])

  // Ref guard: StrictMode runs effects twice and the token must be redeemed once.
  useEffect(() => {
    if (redeemed.current) return
    redeemed.current = true

    if (!token) {
      navigate(SECRET_PATH, { replace: true })
      return
    }

    void handoffTelegram({ token }).then((result) => {
      if ('data' in result && result.data?.user) {
        // Seed the cache first so SecretPage's first render already sees the member.
        void seedAuthUser(result.data.user).finally(() => navigate(SECRET_PATH, { replace: true }))
      } else if ('error' in result && getFetchErrorStatus(result.error) === 403) {
        navigate(DENIED_PATH, { replace: true })
      } else {
        navigate(SECRET_PATH, { replace: true })
      }
    })
  }, [token, seedAuthUser, navigate, handoffTelegram])

  return (
    <Screen bank="report">
      <Card>
        <p className="text-[12.5px] text-ink-3">{t('private.checking')}</p>
      </Card>
    </Screen>
  )
}
