import { API_URL, type SiteMode } from './sites'

export const config = {
  apiUrl: API_URL[import.meta.env.MODE as SiteMode],
}
