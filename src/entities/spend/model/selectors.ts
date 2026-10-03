import type { FundConfig } from '@shared/config'

export const totalSpent = (fund: FundConfig) =>
  fund.years.reduce((sum, year) => sum + year.amount, 0)

export const categoriesTotal = (fund: FundConfig) =>
  fund.categories.reduce((sum, category) => sum + category.amount, 0)

export const peakMonth = (fund: FundConfig) =>
  fund.months.reduce((best, month) => (month[1] > best[1] ? month : best))

export const RECENT_LIMIT = 10

export const latestSpends = (fund: FundConfig, limit = RECENT_LIMIT) =>
  [...fund.recent].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
