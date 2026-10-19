import { Route, Routes } from 'react-router'
import { BankPage, monoPageConfig, otherPageConfig, privatPageConfig } from '@pages/bank'
import { PickPage } from '@pages/pick'
import { ReportPage } from '@pages/report'
import { SecretPage } from '@pages/secret'
import { AuthCallbackPage } from '@pages/auth-callback'
import { MembersDeniedPage } from '@pages/members-denied'
import { DENIED_PATH, HANDOFF_PATH, SECRET_PATH } from '@features/auth-telegram'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PickPage />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path={SECRET_PATH} element={<SecretPage />} />
      <Route path={HANDOFF_PATH} element={<AuthCallbackPage />} />
      <Route path={DENIED_PATH} element={<MembersDeniedPage />} />
      <Route path="/mono" element={<BankPage key="mono" config={monoPageConfig} />} />
      <Route path="/privat" element={<BankPage key="privat" config={privatPageConfig} />} />
      <Route path="/other" element={<BankPage key="other" config={otherPageConfig} />} />
      <Route path="*" element={<PickPage />} />
    </Routes>
  )
}
