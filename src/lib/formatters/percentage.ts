import { LOCALE } from "@/config/constants"

const percentFormatter = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatPercent(value: number): string {
  return percentFormatter.format(value)
}

export function formatPercentPoints(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${(value * 100).toFixed(1)}pp`
}
