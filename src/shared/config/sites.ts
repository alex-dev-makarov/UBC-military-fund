export const API_URL = {
  development: '/api',
  dev: 'https://api-dev.ubc-military-fund.com',
  production: 'https://api.ubc-military-fund.com',
} as const

export type SiteMode = keyof typeof API_URL

export const LOCAL_API = 'http://localhost:3001'

export const isSiteMode = (mode: string): mode is SiteMode => mode in API_URL
