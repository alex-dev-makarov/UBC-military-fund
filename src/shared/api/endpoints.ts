import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'
import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { api } from './baseApi'
import type { AuthUser, JarBalance, PrivateReport, PublicFund, UsdRate } from './types'

type ApiState = { [api.reducerPath]: ReturnType<typeof api.reducer> }

interface PollResponse {
  status: 'pending' | 'authorized' | 'denied' | 'expired'
  user?: AuthUser
}

interface StartResponse {
  nonce: string
  code: number
  url: string
}

interface HandoffResponse {
  user: AuthUser
}

const endpoints = api.injectEndpoints({
  endpoints: (build) => ({
    getPublicReport: build.query<PublicFund, void>({
      query: () => '/report/public',
    }),

    getJarBalance: build.query<JarBalance, void>({
      query: () => '/report/jar',
    }),

    getUsdRate: build.query<UsdRate, void>({
      query: () => '/report/rate',
      keepUnusedDataFor: 3600,
    }),

    getSecretReport: build.query<PrivateReport, void>({
      query: () => '/report/secret',
      keepUnusedDataFor: 0,
      forceRefetch: () => true,
    }),

    getAuthMe: build.query<AuthUser, void>({
      query: () => '/auth/me',
      // 1s, not 0: a seeded entry (useSeedAuthUser) must survive until the next page subscribes.
      keepUnusedDataFor: 1,
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

    logout: build.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
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
  useGetJarBalanceQuery,
  useGetUsdRateQuery,
  useGetSecretReportQuery,
  useGetAuthMeQuery,
  usePollTelegramQuery,
  useStartTelegramMutation,
  useHandoffTelegramMutation,
  useLogoutMutation,
} = endpoints

/** Writes the user into the getAuthMe cache (fulfilled, no error); resolves once stored. */
export function useSeedAuthUser(): (user: AuthUser) => Promise<unknown> {
  const dispatch = useDispatch<ThunkDispatch<ApiState, unknown, UnknownAction>>()
  return useCallback(
    (user) => dispatch(endpoints.util.upsertQueryData('getAuthMe', undefined, user)),
    [dispatch],
  )
}
