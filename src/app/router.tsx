import { Route, Routes } from 'react-router'
import { MonoPage, OtherPage, PrivatPage } from '@pages/bank'
import { PickPage } from '@pages/pick'
import { ReportPage } from '@pages/report'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PickPage />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="/mono" element={<MonoPage />} />
      <Route path="/privat" element={<PrivatPage />} />
      <Route path="/other" element={<OtherPage />} />
      <Route path="*" element={<PickPage />} />
    </Routes>
  )
}
