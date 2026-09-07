import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { DENIED_PATH, HANDOFF_PARAM, MEMBERS_PATH, TelegramLoginButton, useTelegramAuth } from '@features/auth-telegram'
import { useHandoffTelegramMutation, getFetchErrorStatus } from '@shared/api'
import { useI18n } from '@shared/i18n'
import { BackButton, Card, Crumb, Screen } from '@shared/ui'
import { PrivateReport } from '@widgets/report-view'
import { PublicReport } from '@widgets/public-report'

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
  const [params, setParams] = useSearchParams()
  const [redeeming, setRedeeming] = useState(() => params.has(HANDOFF_PARAM))

  const [handoffTelegram] = useHandoffTelegramMutation()
  const redeemed = useRef(false)

  useEffect(() => {
    const handoff = params.get(HANDOFF_PARAM)
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
        setParams({}, { replace: true })
      })
  }, [params, adopt, recheck, setParams, handoffTelegram])

  
  
  useEffect(() => {
    if (status === 'denied') navigate(DENIED_PATH, { replace: true })
  }, [status, navigate])

  return (
    <Screen bank="report">
      <BackButton label={t('common.back')} to={MEMBERS_PATH} />
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
            <TelegramLoginButton onAuth={adopt} />
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

      {status === 'member' && (
        <>
          <PrivateReport onSessionExpired={recheck} />

          <Card className="mt-4">
            <p className="text-sm font-bold tracking-[-.01em]">{t('secret.more.title')}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{t('secret.more.text')}</p>
          </Card>

          <h3 className="mb-2.5 mt-6 pl-0.5 text-[13px] font-bold tracking-[.02em] text-ink-2">
            {t('secret.public.h')}
          </h3>
          <PublicReport />
        </>
      )}
    </Screen>
  )
}
