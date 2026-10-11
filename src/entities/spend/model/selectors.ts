import type { PublicFund } from '@shared/api'

export const totalSpent = (fund: PublicFund) =>
  fund.years.reduce((sum, year) => sum + year.amount, 0)

export const categoriesTotal = (fund: PublicFund) =>
  fund.categories.reduce((sum, category) => sum + category.amount, 0)

export const peakMonth = (fund: PublicFund): [number, number] =>
  fund.months.reduce<[number, number]>(
    (best, month) => (month[1] > best[1] ? month : best),
    [0, 0],
  )

const RECENT_LIMIT = 10

export const latestSpends = (fund: PublicFund, limit = RECENT_LIMIT) =>
  [...fund.recent].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
