import { API_URL, type SiteMode } from './sites'

export const config = {
  apiUrl: API_URL[import.meta.env.MODE as SiteMode],
  telegramBot: import.meta.env.DEV
    ? import.meta.env.VITE_TELEGRAM_BOT_LOCAL
    : import.meta.env.VITE_TELEGRAM_BOT,
}
