"use client"

import { useSpreadsheetStore } from "@/stores/spreadsheet-store"
import { formatBRL } from "@/lib/formatters/currency"
import { formatPercent } from "@/lib/formatters/percentage"
import { cn } from "@/lib/utils"

export function DRETable() {
  const { dreData } = useSpreadsheetStore()

  if (!dreData) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        Nenhum dado DRE carregado.
      </div>
    )
  }

  const months = dreData.headers
  const HIGHLIGHT_ROWS = new Set([
    "Resultado Bruto",
    "Resultado Operacional",
    "EBITDA",
  ])

  const formatValue = (
    value: number | null,
    type: "currency" | "percentage" | "months" | "number"
  ) => {
    if (value === null || value === undefined) return "—"
    switch (type) {
      case "currency":
        return formatBRL(value)
      case "percentage":
        return formatPercent(value)
      case "months":
        return value.toFixed(2)
      default:
        return value.toLocaleString("pt-BR")
    }
  }

  return (
    <div className="overflow-auto border border-border rounded-md">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-card">
            <th className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-medium text-muted-foreground min-w-[240px]">
              Categoria
            </th>
            {months.map((m) => (
              <th
                key={m}
                className="px-3 py-2 text-right font-medium text-muted-foreground min-w-[110px] whitespace-nowrap"
              >
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dreData.rows.map((row) => {
            const isHighlight = HIGHLIGHT_ROWS.has(row.category)
            const isBurnOrRunway =
              row.category.startsWith("Burn") || row.category.startsWith("Runway")

            return (
              <tr
                key={row.id}
                className={cn(
                  "border-t border-border",
                  isHighlight && "bg-muted/50 font-semibold",
                  isBurnOrRunway && "text-muted-foreground text-xs"
                )}
              >
                <td
                  className={cn(
                    "sticky left-0 z-10 px-4 py-1.5",
                    isHighlight ? "bg-muted/50 font-semibold" : "bg-background"
                  )}
                >
                  {row.category}
                </td>
                {months.map((m, i) => {
                  // Build month key from header (e.g. "Jan/26" -> "2026-01")
                  const match = m.match(/^(\w+)\/(\d{2})$/)
                  let monthKey = m
                  if (match) {
                    const monthMap: Record<string, string> = {
                      Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
                      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
                    }
                    monthKey = `20${match[2]}-${monthMap[match[1]] || "01"}`
                  }
                  const val = row.values[monthKey]

                  return (
                    <td
                      key={`${row.id}_${m}`}
                      className={cn(
                        "px-3 py-1.5 text-right font-mono tabular-nums",
                        val !== null && val !== undefined && val < 0 && "text-despesa",
                        val !== null && val !== undefined && val > 0 && row.formatType === "currency" && "text-foreground"
                      )}
                    >
                      {formatValue(val, row.formatType)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
