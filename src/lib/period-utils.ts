/**
 * Check if a monthKey (YYYY-MM) falls within a range (inclusive).
 */
export function isMonthInRange(
  monthKey: string,
  range: { from: string; to: string }
): boolean {
  return monthKey >= range.from && monthKey <= range.to
}

/**
 * Filter an array of items by period range.
 * @param data Array of items
 * @param range { from: "YYYY-MM", to: "YYYY-MM" }
 * @param getKey Function to extract the monthKey from each item
 */
export function filterByPeriod<T>(
  data: T[],
  range: { from: string; to: string },
  getKey: (item: T) => string
): T[] {
  return data.filter((item) => {
    const key = getKey(item).slice(0, 7) // normalize "YYYY-MM-DD" → "YYYY-MM"
    return isMonthInRange(key, range)
  })
}

/**
 * Format a period range for display.
 * E.g. { from: "2026-01", to: "2026-03" } → "Jan-Mar/26"
 */
export function formatPeriodLabel(range: { from: string; to: string }): string {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

  const [fy, fm] = range.from.split("-")
  const [ty, tm] = range.to.split("-")
  const fromLabel = `${months[parseInt(fm) - 1]}/${fy.slice(2)}`

  if (range.from === range.to) return fromLabel

  const toLabel = `${months[parseInt(tm) - 1]}/${ty.slice(2)}`
  return `${fromLabel} - ${toLabel}`
}
