import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { DENIED_PATH, HANDOFF_PARAM, MEMBERS_PATH, TelegramLoginButton, useTelegramAuth } from '@features/auth-telegram'
import { useHandoffTelegramMutation, useLogoutMutation, getFetchErrorStatus } from '@shared/api'
import { useI18n } from '@shared/i18n'
import { BackButton, Card, Crumb, Screen } from '@shared/ui'
import { PrivateReport } from '@widgets/report-view'

const Message = ({ title, text }: { title: string; text: string }) => (
  <>
    <p className="text-sm font-bold tracking-[-.01em]">{title}</p>
    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{text}</p>
  </>
)

export function SecretPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { status, adopt, recheck } = useTelegramAuth()
  const { hash, pathname } = useLocation()
  const handoff = new URLSearchParams(hash.slice(1)).get(HANDOFF_PARAM)
  const [redeeming, setRedeeming] = useState(() => handoff !== null)

  const [handoffTelegram] = useHandoffTelegramMutation()
  const [logout, { isLoading: loggingOut }] = useLogoutMutation()

  const signOut = () => {
    void logout().finally(() => window.location.replace(MEMBERS_PATH))
  }
  const redeemed = useRef(false)

  useEffect(() => {
    if (!handoff || redeemed.current) return
    redeemed.current = true

    void handoffTelegram({ token: handoff })
      .then((result) => {
        if ('data' in result && result.data?.user) {
          adopt(result.data.user)
        } else if ('error' in result) {
          const errorStatus = getFetchErrorStatus(result.error)
          if (errorStatus !== 403) recheck()
        }
      })
      .finally(() => {
        setRedeeming(false)
        navigate(pathname, { replace: true })
      })
  }, [handoff, pathname, adopt, recheck, navigate, handoffTelegram])

  
  
  useEffect(() => {
    if (status === 'denied') navigate(DENIED_PATH, { replace: true })
  }, [status, navigate])

  return (
    <Screen bank="report">
      <div className="flex items-start justify-between gap-3">
        <BackButton label={t('common.back')} to={MEMBERS_PATH} />
        {status === 'member' && (
          <button
            type="button"
            onClick={signOut}
            disabled={loggingOut}
            className="tap inline-flex min-h-12 items-center rounded-xl border border-line bg-card px-4 text-[14px] font-semibold text-ink-2 disabled:opacity-50"
          >
            {t('secret.logout')}
          </button>
        )}
      </div>
      <Crumb mark={<span aria-hidden>🔒</span>} title={t('secret.title')} />

      {(redeeming || status === 'checking') && (
        <Card>
          <p className="text-[12.5px] text-ink-3">{t('private.checking')}</p>
        </Card>
      )}

      {status === 'anonymous' && (
        <Card>
          <Message title={t('private.locked.title')} text={t('private.locked.text')} />
          <div className="mt-4">
            <TelegramLoginButton onAuth={adopt} onDenied={() => navigate(DENIED_PATH, { replace: true })} />
          </div>
        </Card>
      )}


      {status === 'error' && (
        <Card>
          <Message title={t('private.error.title')} text={t('private.error.text')} />
          <button
            type="button"
            onClick={recheck}
            className="mt-3 text-[12.5px] font-semibold underline underline-offset-4"
          >
            {t('private.retry')}
          </button>
        </Card>
      )}

      {status === 'member' && <PrivateReport onSessionExpired={recheck} />}
    </Screen>
  )
}
