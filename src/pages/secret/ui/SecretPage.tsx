import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { DENIED_PATH, HANDOFF_PARAM, HANDOFF_PATH, MEMBERS_PATH, TelegramLoginButton, useTelegramAuth } from '@features/auth-telegram'
import { useLogoutMutation } from '@shared/api'
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
  const { hash } = useLocation()
  // Old bot links carry the token here; forward them to the callback route, which redeems it.
  // Done before SecretContent mounts, so no /auth/me request (and cached 401) is made first.
  if (new URLSearchParams(hash.slice(1)).has(HANDOFF_PARAM)) return <LegacyForward hash={hash} />
  return <SecretContent />
}

function LegacyForward({ hash }: { hash: string }) {
  const { t } = useI18n()
  const navigate = useNavigate()

  useEffect(() => {
    navigate(HANDOFF_PATH + hash, { replace: true })
  }, [hash, navigate])

  return (
    <Screen bank="report">
      <Card>
        <p className="text-[12.5px] text-ink-3">{t('private.checking')}</p>
      </Card>
    </Screen>
  )
}

function SecretContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { status, adopt, recheck } = useTelegramAuth()

  const [logout, { isLoading: loggingOut }] = useLogoutMutation()

  const signOut = () => {
    void logout().finally(() => window.location.replace(MEMBERS_PATH))
  }

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

      {status === 'checking' && (
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
