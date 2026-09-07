import { api } from './baseApi'
import type { AuthUser, PrivateReport, PublicFund } from './types'

interface PollResponse {
  status: 'pending' | 'authorized' | 'denied' | 'expired'
  user?: AuthUser
}

interface StartResponse {
  nonce: string
}

interface HandoffResponse {
  user: AuthUser
}

export const endpoints = api.injectEndpoints({
  endpoints: (build) => ({
    getPublicReport: build.query<PublicFund, void>({
      query: () => '/report/public',
    }),

    getSecretReport: build.query<PrivateReport, void>({
      query: () => '/report/secret',
      keepUnusedDataFor: 0,
      forceRefetch: () => true,
    }),

    getAuthMe: build.query<AuthUser, void>({
      query: () => '/auth/me',
      keepUnusedDataFor: 0,
      forceRefetch: () => true,
    }),

    pollTelegram: build.query<PollResponse, string>({
      query: (nonce) => `/auth/telegram/poll?nonce=${encodeURIComponent(nonce)}`,
    }),

    startTelegram: build.mutation<StartResponse, void>({
      query: () => ({
        url: '/auth/telegram/start',
        method: 'POST',
      }),
    }),

    handoffTelegram: build.mutation<HandoffResponse, { token: string }>({
      query: (body) => ({
        url: '/auth/telegram/handoff',
        method: 'POST',
        body,
      }),
    }),
  }),
})

export const {
  useGetPublicReportQuery,
  useGetSecretReportQuery,
  useGetAuthMeQuery,
  usePollTelegramQuery,
  useStartTelegramMutation,
  useHandoffTelegramMutation,
} = endpoints
