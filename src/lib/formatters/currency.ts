import { LOCALE, CURRENCY } from "@/config/constants"

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactCurrencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatBRL(value: number): string {
  return currencyFormatter.format(value)
}

export function formatBRLCompact(value: number): string {
  return compactCurrencyFormatter.format(value)
}

export function parseBRL(str: string): number {
  const cleaned = str
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
  return parseFloat(cleaned) || 0
}

export function formatVariance(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${formatBRL(value)}`
}
