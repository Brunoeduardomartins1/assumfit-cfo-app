"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PhaseBadge } from "@/components/shared/phase-badge"
import { MarginsChart } from "@/components/charts/margins-chart"
import { getCurrentPhase } from "@/config/phases"
import { formatBRL, formatBRLCompact } from "@/lib/formatters/currency"
import { formatPercent } from "@/lib/formatters/percentage"
import { MONTHLY_DATA, TOP_EXPENSES } from "@/config/seed-data"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight } from "lucide-react"
import { usePeriodStore } from "@/stores/period-store"
import { filterByPeriod } from "@/lib/period-utils"

interface DRERowConfig {
  key: string
  label: string
  getValue: (d: (typeof MONTHLY_DATA)[number]) => number | null
  format: "currency" | "percentage"
  isHighlight?: boolean
  isSeparator?: boolean
  isExpandable?: boolean
  indent?: number
}

const DRE_ROWS: DRERowConfig[] = [
  { key: "receita", label: "Receita Operacional", getValue: (d) => d.receita, format: "currency", isHighlight: true },
  { key: "cogs", label: "(-) COGS", getValue: (d) => d.cogs ? -d.cogs : null, format: "currency", indent: 1 },
  { key: "resultado_bruto", label: "Resultado Bruto", getValue: (d) => d.resultadoBruto, format: "currency", isHighlight: true, isSeparator: true },
  { key: "custos_fixos", label: "(-) Custos Fixos", getValue: (d) => d.custosFixos ? -d.custosFixos : null, format: "currency", isExpandable: true, indent: 1 },
  { key: "desp_variaveis", label: "(-) Despesas Variaveis", getValue: (d) => d.despesasVariaveis ? -d.despesasVariaveis : null, format: "currency", indent: 1 },
  { key: "ebitda", label: "EBITDA", getValue: (d) => d.ebitda, format: "currency", isHighlight: true, isSeparator: true },
  { key: "margem_bruta", label: "Margem Bruta", getValue: (d) => d.margemBruta, format: "percentage" },
  { key: "margem_ebitda", label: "Margem EBITDA", getValue: (d) => d.margemEbitda, format: "percentage" },
  { key: "burn_rate", label: "Burn Rate", getValue: (d) => d.burnRate, format: "currency" },
]

export default function DrePage() {
  const currentPhase = getCurrentPhase()
  const periodRange = usePeriodStore((s) => s.getDateRange)()
  const DRE_MONTHS = filterByPeriod(
    MONTHLY_DATA.filter((d) => d.receita !== null),
    periodRange,
    (d) => d.monthKey
  )
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleExpand = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const formatValue = (val: number | null, format: string) => {
    if (val === null || val === undefined) return "—"
    if (format === "percentage") return formatPercent(val)
    return formatBRL(val)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">DRE Mensal</h2>
          <p className="text-sm text-muted-foreground">
            Demonstracao de Resultado do Exercicio — Jan a Dez/2026
          </p>
        </div>
        <PhaseBadge phase={currentPhase} />
      </div>

      {/* DRE Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-medium text-muted-foreground min-w-[220px]">
                    Categoria
                  </th>
                  {DRE_MONTHS.map((d) => (
                    <th
                      key={d.monthKey}
                      className="px-3 py-2.5 text-right font-medium text-muted-foreground min-w-[105px] whitespace-nowrap text-xs"
                    >
                      {d.month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DRE_ROWS.map((row) => (
                  <>
                    <tr
                      key={row.key}
                      className={cn(
                        "border-b border-border transition-colors hover:bg-muted/30",
                        row.isHighlight && "bg-muted/20",
                        row.isSeparator && "border-t-2 border-t-border"
                      )}
                    >
                      <td
                        className={cn(
                          "sticky left-0 z-10 px-4 py-2",
                          row.isHighlight ? "bg-muted/20 font-semibold" : "bg-background",
                          row.isExpandable && "cursor-pointer select-none"
                        )}
                        style={{ paddingLeft: row.indent ? `${row.indent * 16 + 16}px` : undefined }}
                        onClick={() => row.isExpandable && toggleExpand(row.key)}
                      >
                        <span className="flex items-center gap-1">
                          {row.isExpandable && (
                            expandedRows.has(row.key)
                              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {row.label}
                        </span>
                      </td>
                      {DRE_MONTHS.map((d) => {
                        const val = row.getValue(d)
                        return (
                          <td
                            key={`${row.key}_${d.monthKey}`}
                            className={cn(
                              "px-3 py-2 text-right font-mono tabular-nums",
                              val !== null && val < 0 && "text-despesa",
                              val !== null && val > 0 && row.format === "currency" && "text-receita",
                              row.isHighlight && "font-semibold"
                            )}
                          >
                            {formatValue(val, row.format)}
                          </td>
                        )
                      })}
                    </tr>
                    {/* Drill-down for Custos Fixos */}
                    {row.key === "custos_fixos" && expandedRows.has("custos_fixos") && (
                      TOP_EXPENSES.map((exp) => (
                        <tr key={`detail_${exp.name}`} className="border-b border-border/50 bg-muted/10">
                          <td className="sticky left-0 z-10 bg-muted/10 px-4 py-1.5 text-muted-foreground text-xs" style={{ paddingLeft: 48 }}>
                            {exp.name}
                          </td>
                          {DRE_MONTHS.map((d, i) => (
                            <td key={`${exp.name}_${d.monthKey}`} className="px-3 py-1.5 text-right font-mono tabular-nums text-xs text-despesa">
                              {i === 0 ? formatBRL(exp.value) : "—"}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Margins Chart */}
      <MarginsChart />
    </div>
  )
}
