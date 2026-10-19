export function pct(part: number, total: number): string {
  return `${((part / total) * 100).toFixed(2)}%`
}
