export function getFetchErrorStatus(error: unknown): number | null {
  if (!error) return null
  if (typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
    return error.status
  }
  return null
}

export function isFetchErrorWithStatus(error: unknown, status: number): boolean {
  return getFetchErrorStatus(error) === status
}
