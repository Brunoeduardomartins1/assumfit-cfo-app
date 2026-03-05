"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useOrg } from "@/hooks/use-org"
import { useFinancialData } from "@/hooks/use-financial-data"
import { usePeriodStore } from "@/stores/period-store"
import { filterByPeriod, formatPeriodLabel } from "@/lib/period-utils"
import { formatBRL, formatBRLCompact } from "@/lib/formatters/currency"
import { cn } from "@/lib/utils"
import {
  Gauge,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Pencil,
  Save,
  X,
} from "lucide-react"

interface GoalDef {
  key: string
  label: string
  category: "financial" | "growth" | "operational"
  format: "currency" | "percentage" | "number" | "months"
  invertColors?: boolean // true = lower is better
  defaultTarget: number
}

const GOAL_DEFINITIONS: GoalDef[] = [
  { key: "receita", label: "Receita Mensal", category: "financial", format: "currency", defaultTarget: 500000 },
  { key: "ebitda", label: "EBITDA", category: "financial", format: "currency", defaultTarget: 50000 },
  { key: "margem_ebitda", label: "Margem EBITDA", category: "financial", format: "percentage", defaultTarget: 0.10 },
  { key: "burn_rate", label: "Burn Rate", category: "financial", format: "currency", invertColors: true, defaultTarget: 200000 },
  { key: "runway", label: "Runway", category: "financial", format: "months", defaultTarget: 12 },
  { key: "mrr", label: "MRR", category: "growth", format: "currency", defaultTarget: 100000 },
  { key: "clientes_ativos", label: "Clientes Ativos", category: "growth", format: "number", defaultTarget: 50 },
  { key: "churn_rate", label: "Churn Rate", category: "operational", format: "percentage", invertColors: true, defaultTarget: 0.05 },
  { key: "nps", label: "NPS", category: "operational", format: "number", defaultTarget: 70 },
  { key: "cac", label: "CAC", category: "growth", format: "currency", invertColors: true, defaultTarget: 500 },
]

type TrafficLight = "green" | "yellow" | "red"

function getTrafficLight(actual: number, target: number, invertColors?: boolean): TrafficLight {
  if (target === 0) return "green"
  const deviation = invertColors
    ? (actual - target) / Math.abs(target)
    : (target - actual) / Math.abs(target)

  if (deviation <= 0.05) return "green"
  if (deviation <= 0.15) return "yellow"
  return "red"
}

const lightStyles: Record<TrafficLight, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  green: { bg: "bg-emerald-500", text: "text-emerald-500", icon: CheckCircle, label: "No alvo" },
  yellow: { bg: "bg-amber-500", text: "text-amber-500", icon: AlertTriangle, label: "Atencao" },
  red: { bg: "bg-red-500", text: "text-red-500", icon: XCircle, label: "Fora da meta" },
}

function formatGoalValue(value: number, format: GoalDef["format"]): string {
  switch (format) {
    case "currency": return formatBRLCompact(value)
    case "percentage": return `${(value * 100).toFixed(1)}%`
    case "number": return value.toFixed(0)
    case "months": return `${value.toFixed(1)} meses`
  }
}

export default function MetasPage() {
  const { orgId } = useOrg()
  const { monthlyData: allMonthlyData, snapshot, loading } = useFinancialData(orgId)
  const periodRange = usePeriodStore((s) => s.getDateRange)()
  const periodLabel = formatPeriodLabel(periodRange)
  const monthlyData = filterByPeriod(allMonthlyData, periodRange, (m) => m.monthKey)

  const [targets, setTargets] = useState<Record<string, number>>(() =>
    Object.fromEntries(GOAL_DEFINITIONS.map((g) => [g.key, g.defaultTarget]))
  )
  const [editing, setEditing] = useState(false)
  const [draftTargets, setDraftTargets] = useState<Record<string, string>>({})

  // Compute actual values from financial data
  const actuals: Record<string, number> = useMemo(() => {
    const latest = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1] : null
    const snap = snapshot

    return {
      receita: latest?.receita ?? 0,
      ebitda: latest?.ebitda ?? 0,
      margem_ebitda: latest?.margemEbitda ?? 0,
      burn_rate: Math.abs(latest?.burnRate ?? snap.burn_rate ?? 0),
      runway: snap.runway_meses,
      mrr: latest?.receita ?? 0, // simplified
      clientes_ativos: latest?.receita ? Math.ceil((latest.receita) / 2000) : 0,
      churn_rate: 0.05, // would come from contracts
      nps: 50 + (latest?.margemEbitda ?? 0) * 200,
      cac: latest?.despesasVariaveis ? (latest.despesasVariaveis * 0.3) / Math.max(1, Math.ceil((latest.receita ?? 0) / 2000)) : 0,
    }
  }, [monthlyData, snapshot])

  // Build goals with traffic lights
  const goals = useMemo(() => {
    return GOAL_DEFINITIONS.map((def) => {
      const actual = actuals[def.key] ?? 0
      const target = targets[def.key] ?? def.defaultTarget
      const light = getTrafficLight(actual, target, def.invertColors)
      const deviation = target !== 0
        ? def.invertColors
          ? (actual - target) / Math.abs(target)
          : (target - actual) / Math.abs(target)
        : 0

      return { ...def, actual, target, light, deviation }
    })
  }, [actuals, targets])

  const summary = { green: 0, yellow: 0, red: 0 }
  for (const g of goals) summary[g.light]++

  const handleStartEdit = () => {
    setDraftTargets(
      Object.fromEntries(
        GOAL_DEFINITIONS.map((g) => {
          const val = targets[g.key]
          return [g.key, g.format === "percentage" ? (val * 100).toString() : val.toString()]
        })
      )
    )
    setEditing(true)
  }

  const handleSave = () => {
    const newTargets: Record<string, number> = {}
    for (const def of GOAL_DEFINITIONS) {
      const raw = parseFloat(draftTargets[def.key] ?? "0")
      newTargets[def.key] = def.format === "percentage" ? raw / 100 : raw
    }
    setTargets(newTargets)
    setEditing(false)
  }

  const categories = [
    { key: "financial", label: "Financeiro" },
    { key: "growth", label: "Crescimento" },
    { key: "operational", label: "Operacional" },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted/20 rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-48 bg-muted/20 rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Meta vs Realizado</h2>
          <p className="text-sm text-muted-foreground">
            Painel semaforo de metas — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button variant="outline" size="sm" onClick={handleStartEdit}>
              <Pencil className="h-4 w-4 mr-1" />
              Editar Metas
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                Salvar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-emerald-500" />
          <span className="text-sm">{summary.green} no alvo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-amber-500" />
          <span className="text-sm">{summary.yellow} atencao</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-red-500" />
          <span className="text-sm">{summary.red} fora da meta</span>
        </div>
      </div>

      {/* Goals by Category */}
      {categories.map((cat) => {
        const catGoals = goals.filter((g) => g.category === cat.key)
        if (catGoals.length === 0) return null

        return (
          <div key={cat.key}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{cat.label}</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {catGoals.map((goal) => {
                const style = lightStyles[goal.light]
                const Icon = style.icon

                return (
                  <Card key={goal.key} className="relative overflow-hidden">
                    {/* Traffic light indicator */}
                    <div className={cn("absolute top-0 left-0 w-1 h-full", style.bg)} />

                    <CardContent className="pt-4 pl-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-sm font-medium">{goal.label}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-2xl font-bold font-mono tabular-nums">
                              {formatGoalValue(goal.actual, goal.format)}
                            </span>
                          </div>
                        </div>
                        <div className={cn("p-1.5 rounded-full", `${style.bg}/20`)}>
                          <Icon className={cn("h-4 w-4", style.text)} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-muted-foreground">
                          Meta: {editing ? (
                            <Input
                              className="inline-block h-6 w-20 text-xs font-mono px-1"
                              value={draftTargets[goal.key] ?? ""}
                              onChange={(e) => setDraftTargets((d) => ({ ...d, [goal.key]: e.target.value }))}
                            />
                          ) : (
                            <span className="font-mono font-medium">{formatGoalValue(goal.target, goal.format)}</span>
                          )}
                        </span>
                        <Badge variant="outline" className={cn("text-[10px]", `${style.bg}/20 ${style.text}`)}>
                          {style.label}
                        </Badge>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", style.bg)}
                          style={{
                            width: `${Math.min(100, goal.target > 0
                              ? goal.invertColors
                                ? Math.max(0, (1 - Math.max(0, goal.actual - goal.target) / goal.target)) * 100
                                : (goal.actual / goal.target) * 100
                              : 0
                            )}%`,
                          }}
                        />
                      </div>

                      {/* Deviation */}
                      <p className={cn("text-[10px] mt-1 font-mono", style.text)}>
                        {goal.deviation <= 0
                          ? "Meta atingida"
                          : `${(goal.deviation * 100).toFixed(1)}% abaixo da meta`}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
