import { Route, Routes } from 'react-router'
import { MonoPage, OtherPage, PrivatPage } from '@pages/bank'
import { PickPage } from '@pages/pick'
import { ReportPage } from '@pages/report'
import { SecretPage } from '@pages/secret'
import { MembersDeniedPage } from '@pages/members-denied'
import { DENIED_PATH, SECRET_PATH } from '@features/auth-telegram'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PickPage />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path={SECRET_PATH} element={<SecretPage />} />
      <Route path={DENIED_PATH} element={<MembersDeniedPage />} />
      <Route path="/mono" element={<MonoPage />} />
      <Route path="/privat" element={<PrivatPage />} />
      <Route path="/other" element={<OtherPage />} />
      <Route path="*" element={<PickPage />} />
    </Routes>
  )
}
