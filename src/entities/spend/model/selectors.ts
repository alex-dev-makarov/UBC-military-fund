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
