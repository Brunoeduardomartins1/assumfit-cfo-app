"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { KPICard } from "@/components/charts/kpi-card"
import { formatBRL, formatBRLCompact } from "@/lib/formatters/currency"
import { cn } from "@/lib/utils"
import { Grid3X3, Users, TrendingDown } from "lucide-react"

// Demo cohort data — months since acquisition
interface CohortRow {
  cohort: string // "2025-07", "2025-08", etc.
  label: string  // "Jul/25"
  initialCustomers: number
  retention: number[] // retention rate for month 0, 1, 2, ...
  avgRevenue: number // avg revenue per customer
}

const DEMO_COHORTS: CohortRow[] = [
  { cohort: "2025-07", label: "Jul/25", initialCustomers: 0, retention: [1, 0, 0, 0, 0, 0, 0, 0], avgRevenue: 0 },
  { cohort: "2025-08", label: "Ago/25", initialCustomers: 0, retention: [1, 0, 0, 0, 0, 0, 0], avgRevenue: 0 },
  { cohort: "2025-09", label: "Set/25", initialCustomers: 0, retention: [1, 0, 0, 0, 0, 0], avgRevenue: 0 },
  { cohort: "2025-10", label: "Out/25", initialCustomers: 5, retention: [1, 0.8, 0.8, 0.6, 0.6], avgRevenue: 800 },
  { cohort: "2025-11", label: "Nov/25", initialCustomers: 8, retention: [1, 0.875, 0.75, 0.75], avgRevenue: 1200 },
  { cohort: "2025-12", label: "Dez/25", initialCustomers: 12, retention: [1, 0.917, 0.833], avgRevenue: 1500 },
  { cohort: "2026-01", label: "Jan/26", initialCustomers: 18, retention: [1, 0.889], avgRevenue: 2000 },
  { cohort: "2026-02", label: "Fev/26", initialCustomers: 25, retention: [1], avgRevenue: 2200 },
]

function getRetentionColor(rate: number): string {
  if (rate >= 0.9) return "bg-emerald-600/80 text-white"
  if (rate >= 0.7) return "bg-emerald-500/50 text-emerald-100"
  if (rate >= 0.5) return "bg-amber-500/50 text-amber-100"
  if (rate >= 0.3) return "bg-orange-500/50 text-orange-100"
  if (rate > 0) return "bg-red-500/50 text-red-100"
  return "bg-muted/20 text-muted-foreground"
}

export default function CohortPage() {
  const [cohorts] = useState<CohortRow[]>(DEMO_COHORTS)

  const maxMonths = Math.max(...cohorts.map((c) => c.retention.length))

  // Calculate overall metrics
  const totalCustomers = cohorts.reduce((s, c) => s + c.initialCustomers, 0)
  const activeCohorts = cohorts.filter((c) => c.initialCustomers > 0)

  const avgRetentionM1 = activeCohorts.length > 0
    ? activeCohorts
        .filter((c) => c.retention.length > 1)
        .reduce((s, c) => s + (c.retention[1] ?? 0), 0) /
      Math.max(activeCohorts.filter((c) => c.retention.length > 1).length, 1)
    : 0

  const avgRetentionM3 = activeCohorts.length > 0
    ? activeCohorts
        .filter((c) => c.retention.length > 3)
        .reduce((s, c) => s + (c.retention[3] ?? 0), 0) /
      Math.max(activeCohorts.filter((c) => c.retention.length > 3).length, 1)
    : 0

  // LTV by cohort
  const cohortLTV = useMemo(() => {
    return activeCohorts.map((c) => {
      const totalRevenue = c.retention.reduce((sum, r) => sum + r * c.avgRevenue, 0)
      return { label: c.label, ltv: totalRevenue, customers: c.initialCustomers }
    })
  }, [activeCohorts])

  const avgLTV = cohortLTV.length > 0
    ? cohortLTV.reduce((s, c) => s + c.ltv, 0) / cohortLTV.length
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Analise de Cohort</h2>
        <p className="text-sm text-muted-foreground">
          Retencao e LTV por cohort de clientes
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total Clientes" value={totalCustomers} format="number" />
        <KPICard title="Retencao M+1" value={avgRetentionM1} format="percentage" />
        <KPICard title="Retencao M+3" value={avgRetentionM3} format="percentage" />
        <KPICard title="LTV Medio" value={avgLTV} format="currency" />
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            Heatmap de Retencao
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium text-muted-foreground min-w-[80px]">Cohort</th>
                  <th className="text-center py-2 font-medium text-muted-foreground min-w-[50px]">Clientes</th>
                  {Array.from({ length: maxMonths }, (_, i) => (
                    <th key={i} className="text-center py-2 font-medium text-muted-foreground min-w-[55px]">
                      M+{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((cohort) => (
                  <tr key={cohort.cohort} className="border-b border-border/50">
                    <td className="py-1.5 font-medium">{cohort.label}</td>
                    <td className="py-1.5 text-center font-mono tabular-nums">{cohort.initialCustomers}</td>
                    {Array.from({ length: maxMonths }, (_, i) => {
                      const rate = cohort.retention[i]
                      if (rate === undefined) {
                        return <td key={i} className="py-1.5" />
                      }
                      return (
                        <td key={i} className="py-1.5 text-center">
                          <span className={cn(
                            "inline-block px-2 py-0.5 rounded text-[10px] font-mono tabular-nums min-w-[42px]",
                            getRetentionColor(rate)
                          )}>
                            {rate > 0 ? `${(rate * 100).toFixed(0)}%` : "0%"}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 text-[10px] text-muted-foreground">
            <span>Retencao:</span>
            <span className={cn("px-2 py-0.5 rounded", getRetentionColor(1))}>90%+</span>
            <span className={cn("px-2 py-0.5 rounded", getRetentionColor(0.8))}>70-89%</span>
            <span className={cn("px-2 py-0.5 rounded", getRetentionColor(0.5))}>50-69%</span>
            <span className={cn("px-2 py-0.5 rounded", getRetentionColor(0.3))}>30-49%</span>
            <span className={cn("px-2 py-0.5 rounded", getRetentionColor(0.1))}>&lt;30%</span>
          </div>
        </CardContent>
      </Card>

      {/* LTV by Cohort */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">LTV por Cohort</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cohortLTV.filter((c) => c.ltv > 0).map((c) => {
              const maxLTV = Math.max(...cohortLTV.map((x) => x.ltv))
              const pct = maxLTV > 0 ? (c.ltv / maxLTV) * 100 : 0
              return (
                <div key={c.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.label} ({c.customers} clientes)</span>
                    <span className="font-mono tabular-nums text-xs font-medium">{formatBRL(c.ltv)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-receita/60 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Churn Pattern Analysis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-despesa" />
            Padroes de Churn
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            {(() => {
              // Average retention drop per month
              const drops: { month: number; avgDrop: number }[] = []
              for (let m = 1; m < maxMonths; m++) {
                const relevant = activeCohorts.filter((c) => c.retention.length > m)
                if (relevant.length === 0) continue
                const avgDrop = relevant.reduce((s, c) => s + (c.retention[m - 1] - c.retention[m]), 0) / relevant.length
                drops.push({ month: m, avgDrop })
              }

              const worstMonth = drops.reduce((max, d) => d.avgDrop > max.avgDrop ? d : max, drops[0])

              return (
                <>
                  {drops.map((d) => (
                    <div key={d.month} className="flex items-center justify-between">
                      <span className="text-muted-foreground">M+{d.month - 1} → M+{d.month}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-despesa/60 rounded-full" style={{ width: `${Math.min(100, d.avgDrop * 500)}%` }} />
                        </div>
                        <span className="font-mono tabular-nums text-xs text-despesa w-12 text-right">
                          -{(d.avgDrop * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {worstMonth && (
                    <p className="text-xs text-muted-foreground pt-2">
                      Maior queda de retencao: <strong className="text-foreground">M+{worstMonth.month - 1} → M+{worstMonth.month}</strong> (media -{(worstMonth.avgDrop * 100).toFixed(1)}%)
                    </p>
                  )}
                </>
              )
            })()}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
