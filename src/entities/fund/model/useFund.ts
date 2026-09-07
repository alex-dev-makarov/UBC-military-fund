import { useGetPublicReportQuery, type PublicFund } from '@shared/api'

export function useFund(): PublicFund {
  const { data } = useGetPublicReportQuery()
  if (!data) throw new Error('useFund read before the public fund resolved — is the Layout gate still in place?')
  return data
}
