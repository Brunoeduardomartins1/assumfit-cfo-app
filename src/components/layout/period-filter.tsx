"use client"

import { CalendarDays } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePeriodStore } from "@/stores/period-store"
import { formatPeriodLabel } from "@/lib/period-utils"

const MONTH_OPTIONS = [
  { value: "2025-07", label: "Jul/25" },
  { value: "2025-08", label: "Ago/25" },
  { value: "2025-09", label: "Set/25" },
  { value: "2025-10", label: "Out/25" },
  { value: "2025-11", label: "Nov/25" },
  { value: "2025-12", label: "Dez/25" },
  { value: "2026-01", label: "Jan/26" },
  { value: "2026-02", label: "Fev/26" },
  { value: "2026-03", label: "Mar/26" },
  { value: "2026-04", label: "Abr/26" },
  { value: "2026-05", label: "Mai/26" },
  { value: "2026-06", label: "Jun/26" },
  { value: "2026-07", label: "Jul/26" },
  { value: "2026-08", label: "Ago/26" },
  { value: "2026-09", label: "Set/26" },
  { value: "2026-10", label: "Out/26" },
  { value: "2026-11", label: "Nov/26" },
  { value: "2026-12", label: "Dez/26" },
]

const QUARTER_OPTIONS = [
  { value: "2025-Q3", label: "Q3 2025 (Jul-Set)" },
  { value: "2025-Q4", label: "Q4 2025 (Out-Dez)" },
  { value: "2026-Q1", label: "Q1 2026 (Jan-Mar)" },
  { value: "2026-Q2", label: "Q2 2026 (Abr-Jun)" },
  { value: "2026-Q3", label: "Q3 2026 (Jul-Set)" },
  { value: "2026-Q4", label: "Q4 2026 (Out-Dez)" },
]

const YEAR_OPTIONS = [
  { value: "2025", label: "2025 (Jul-Dez)" },
  { value: "2026", label: "2026" },
]

function encodeValue(mode: string, key: string): string {
  return `${mode}:${key}`
}

function decodeValue(encoded: string): { mode: string; key: string } {
  const idx = encoded.indexOf(":")
  return { mode: encoded.slice(0, idx), key: encoded.slice(idx + 1) }
}

export function PeriodFilter() {
  const { mode, selectedMonth, selectedQuarter, selectedYear, getDateRange, setMonth, setQuarter, setYear } =
    usePeriodStore()

  const currentValue =
    mode === "month"
      ? encodeValue("month", selectedMonth)
      : mode === "quarter"
        ? encodeValue("quarter", selectedQuarter)
        : mode === "year"
          ? encodeValue("year", selectedYear)
          : encodeValue("year", selectedYear)

  const range = getDateRange()
  const displayLabel = formatPeriodLabel(range)

  function handleChange(encoded: string) {
    const { mode: m, key } = decodeValue(encoded)
    if (m === "month") setMonth(key)
    else if (m === "quarter") setQuarter(key)
    else if (m === "year") setYear(key)
  }

  return (
    <Select value={currentValue} onValueChange={handleChange}>
      <SelectTrigger size="sm" className="w-auto gap-1.5 text-xs">
        <CalendarDays className="h-3.5 w-3.5" />
        <SelectValue>{displayLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        <SelectGroup>
          <SelectLabel>Ano</SelectLabel>
          {YEAR_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={encodeValue("year", opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Trimestre</SelectLabel>
          {QUARTER_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={encodeValue("quarter", opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Mes</SelectLabel>
          {MONTH_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={encodeValue("month", opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
