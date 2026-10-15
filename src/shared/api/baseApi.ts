import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { config } from '@shared/config'

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: config.apiUrl,
    credentials: 'include',
  }),
  endpoints: () => ({}),
})
