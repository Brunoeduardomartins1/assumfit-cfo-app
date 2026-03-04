"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PhaseBadge } from "@/components/shared/phase-badge"
import { getCurrentPhase } from "@/config/phases"
import { SCENARIO_TEMPLATES, applyScenario } from "@/lib/scenarios/engine"
import type { Scenario } from "@/types/scenarios"
import { formatBRL, formatBRLCompact } from "@/lib/formatters/currency"
import { cn } from "@/lib/utils"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { GitBranch, TrendingUp, TrendingDown, Minus } from "lucide-react"

const METRIC_OPTIONS = [
  { key: "ebitda" as const, label: "EBITDA" },
  { key: "receita" as const, label: "Receita" },
  { key: "saldoFinal" as const, label: "Saldo de Caixa" },
  { key: "burnRate" as const, label: "Burn Rate" },
]

const TYPE_COLORS = {
  base: "bg-muted text-muted-foreground",
  optimistic: "bg-receita/20 text-receita border-receita/30",
  pessimistic: "bg-despesa/20 text-despesa border-despesa/30",
  custom: "bg-chart-1/20 text-chart-1 border-chart-1/30",
}

const CHART_COLORS = [
  "#94a3b8",
  "#4ade80",
  "#f87171",
  "#60a5fa",
]

function CompareTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700/50 rounded-lg px-3 py-2.5 shadow-2xl">
      <p className="text-[11px] font-medium text-zinc-200 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.stroke }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono tabular-nums font-medium">
            {formatBRLCompact(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function CenariosPage() {
  const currentPhase = getCurrentPhase()
  const [scenarios] = useState<Scenario[]>(SCENARIO_TEMPLATES)
  const [selectedIds, setSelectedIds] = useState<string[]>(["base", "optimistic", "pessimistic"])
  const [metric, setMetric] = useState<"ebitda" | "receita" | "saldoFinal" | "burnRate">("ebitda")

  const selectedScenarios = scenarios.filter((s) => selectedIds.includes(s.id))

  const toggleScenario = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // Build chart data
  const chartData = useMemo(() => {
    if (selectedScenarios.length === 0) return []

    const projections = selectedScenarios.map((s) => ({
      scenario: s,
      data: applyScenario(s, metric),
    }))

    // Merge into single array by month
    return projections[0].data.map((d, i) => {
      const point: Record<string, string | number> = { month: d.month }
      projections.forEach((p) => {
        point[p.scenario.name] = p.data[i].scenario
      })
      return point
    })
  }, [selectedScenarios, metric])

  // Summary: last month comparison
  const summaryData = useMemo(() => {
    return selectedScenarios.map((s) => {
      const proj = applyScenario(s, metric)
      const last = proj[proj.length - 1]
      return { scenario: s, lastMonth: last }
    })
  }, [selectedScenarios, metric])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Cenarios</h2>
          <p className="text-sm text-muted-foreground">
            Planejamento what-if — Compare projecoes lado a lado
          </p>
        </div>
        <PhaseBadge phase={currentPhase} />
      </div>

      {/* Scenario cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {scenarios.map((s) => {
          const isSelected = selectedIds.includes(s.id)
          return (
            <Card
              key={s.id}
              className={cn(
                "cursor-pointer transition-all",
                isSelected ? "ring-2 ring-ring" : "opacity-60 hover:opacity-80"
              )}
              onClick={() => toggleScenario(s.id)}
            >
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className={cn("text-[10px]", TYPE_COLORS[s.type])}>
                    {s.type === "base" ? "Base" : s.type === "optimistic" ? "Otimista" : s.type === "pessimistic" ? "Pessimista" : "Custom"}
                  </Badge>
                </div>
                <h4 className="text-sm font-medium">{s.name}</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.description}</p>
                {s.modifiers.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {s.modifiers.map((m) => (
                      <div key={m.id} className="text-[10px] text-muted-foreground">
                        {m.label}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Metric selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Metrica:</span>
        {METRIC_OPTIONS.map((opt) => (
          <Button
            key={opt.key}
            variant={metric === opt.key ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setMetric(opt.key)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Comparison chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Comparacao — {METRIC_OPTIONS.find((o) => o.key === metric)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatBRLCompact(v)}
                  width={70}
                />
                <Tooltip content={<CompareTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="line"
                />
                {selectedScenarios.map((s, i) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={s.name}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    strokeWidth={s.type === "base" ? 1.5 : 2}
                    strokeDasharray={s.type === "base" ? "5 5" : undefined}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Summary table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumo Dez/26</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Cenario</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Valor Base</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Valor Cenario</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Delta</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.map(({ scenario, lastMonth }) => (
                  <tr key={scenario.id} className="border-b border-border/50">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-[9px]", TYPE_COLORS[scenario.type])}>
                          {scenario.type === "base" ? "Base" : scenario.type === "optimistic" ? "Otimista" : scenario.type === "pessimistic" ? "Pessimista" : "Custom"}
                        </Badge>
                        <span className="text-xs">{scenario.name}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-xs">
                      {formatBRL(lastMonth.base)}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-xs font-medium">
                      {formatBRL(lastMonth.scenario)}
                    </td>
                    <td className={cn(
                      "py-2 text-right font-mono tabular-nums text-xs",
                      lastMonth.delta > 0 ? "text-receita" : lastMonth.delta < 0 ? "text-despesa" : ""
                    )}>
                      <span className="flex items-center justify-end gap-1">
                        {lastMonth.delta > 0 ? <TrendingUp className="h-3 w-3" /> : lastMonth.delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {formatBRL(Math.abs(lastMonth.delta))}
                      </span>
                    </td>
                    <td className={cn(
                      "py-2 text-right font-mono tabular-nums text-xs font-medium",
                      lastMonth.deltaPercent > 0 ? "text-receita" : lastMonth.deltaPercent < 0 ? "text-despesa" : ""
                    )}>
                      {lastMonth.deltaPercent > 0 ? "+" : ""}{lastMonth.deltaPercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
