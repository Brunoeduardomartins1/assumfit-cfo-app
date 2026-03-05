"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useOrg } from "@/hooks/use-org"
import { useFinancialData } from "@/hooks/use-financial-data"
import { usePeriodStore } from "@/stores/period-store"
import { filterByPeriod, formatPeriodLabel } from "@/lib/period-utils"
import { formatBRL, formatBRLCompact } from "@/lib/formatters/currency"
import { cn } from "@/lib/utils"
import {
  Target,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Pencil,
  Save,
  X,
} from "lucide-react"

interface KPIDefinition {
  key: string
  label: string
  description: string
  icon: React.ElementType
  format: "currency" | "percentage" | "number" | "months" | "score"
  invertColors?: boolean // true = lower is better (e.g. CAC, Churn)
  defaultTarget: number
}

const KPI_DEFINITIONS: KPIDefinition[] = [
  {
    key: "mrr",
    label: "MRR",
    description: "Receita Recorrente Mensal",
    icon: DollarSign,
    format: "currency",
    defaultTarget: 100000,
  },
  {
    key: "cac",
    label: "CAC",
    description: "Custo de Aquisicao de Cliente",
    icon: Target,
    format: "currency",
    invertColors: true,
    defaultTarget: 500,
  },
  {
    key: "ltv",
    label: "LTV",
    description: "Lifetime Value do Cliente",
    icon: Users,
    format: "currency",
    defaultTarget: 5000,
  },
  {
    key: "churn_rate",
    label: "Churn Rate",
    description: "Taxa de cancelamento mensal",
    icon: TrendingDown,
    format: "percentage",
    invertColors: true,
    defaultTarget: 0.03,
  },
  {
    key: "nps",
    label: "NPS",
    description: "Net Promoter Score",
    icon: TrendingUp,
    format: "score",
    defaultTarget: 70,
  },
]

function formatKPIValue(value: number, format: KPIDefinition["format"]): string {
  switch (format) {
    case "currency":
      return formatBRL(value)
    case "percentage":
      return `${(value * 100).toFixed(1)}%`
    case "number":
      return value.toLocaleString("pt-BR")
    case "months":
      return `${value.toFixed(1)} meses`
    case "score":
      return value.toFixed(0)
  }
}

type AlertLevel = "green" | "yellow" | "red"

function getAlertLevel(
  actual: number,
  target: number,
  invertColors?: boolean
): AlertLevel {
  if (target === 0) return "green"
  const deviation = invertColors
    ? (actual - target) / Math.abs(target)
    : (target - actual) / Math.abs(target)

  if (deviation <= 0) return "green"
  if (deviation <= 0.15) return "yellow"
  return "red"
}

const alertStyles: Record<AlertLevel, { bg: string; text: string; border: string; badge: string }> = {
  green: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/30", badge: "bg-emerald-500/20 text-emerald-500" },
  yellow: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30", badge: "bg-amber-500/20 text-amber-500" },
  red: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30", badge: "bg-red-500/20 text-red-500" },
}

const alertLabels: Record<AlertLevel, string> = {
  green: "No alvo",
  yellow: "Atencao",
  red: "Critico",
}

interface KPIData {
  key: string
  actual: number
  target: number
  previousActual?: number
}

export default function KPIsPage() {
  const { orgId } = useOrg()
  const { monthlyData: allMonthlyData, snapshot, loading: financialLoading } = useFinancialData(orgId)
  const periodRange = usePeriodStore((s) => s.getDateRange)()
  const periodLabel = formatPeriodLabel(periodRange)
  const monthlyData = filterByPeriod(allMonthlyData, periodRange, (m) => m.monthKey)

  const [editingTargets, setEditingTargets] = useState(false)
  const [targets, setTargets] = useState<Record<string, number>>(() =>
    Object.fromEntries(KPI_DEFINITIONS.map((d) => [d.key, d.defaultTarget]))
  )
  const [draftTargets, setDraftTargets] = useState<Record<string, string>>({})
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)

  // Compute KPIs from financial data
  const kpiData: KPIData[] = useMemo(() => {
    const latest = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1] : null
    const previous = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2] : null

    // MRR = latest month receita (or 0)
    const mrr = latest?.receita ?? 0
    const prevMrr = previous?.receita ?? undefined

    // CAC = total despesas variaveis / estimated new customers
    // Simplified: custos fixos marketing estimate = 30% of despesas variaveis
    const totalDespVar = latest?.despesasVariaveis ?? 0
    const marketingCost = totalDespVar * 0.3
    const estimatedNewCustomers = mrr > 0 ? Math.max(Math.ceil(mrr / 2000), 1) : 1
    const cac = marketingCost / estimatedNewCustomers
    const prevTotalDespVar = previous?.despesasVariaveis ?? 0
    const prevMarketingCost = prevTotalDespVar * 0.3
    const prevEstCustomers = prevMrr && prevMrr > 0 ? Math.max(Math.ceil(prevMrr / 2000), 1) : 1
    const prevCac = prevMarketingCost / prevEstCustomers

    // LTV = MRR * avg lifetime (estimated 24 months) / churn
    const churnRate = 0.05 // 5% default if no real data
    const ltv = mrr > 0 ? (mrr / estimatedNewCustomers) / churnRate : 0
    const prevLtv = prevMrr && prevMrr > 0 ? (prevMrr / prevEstCustomers) / churnRate : undefined

    // Churn Rate = estimated 5% (would come from contracts in feature #3)
    const actualChurn = churnRate

    // NPS = estimated from EBITDA margin health (would come from surveys)
    const margin = latest?.margemEbitda ?? 0
    const nps = Math.min(100, Math.max(-100, 50 + margin * 200))
    const prevMargin = previous?.margemEbitda ?? 0
    const prevNps = Math.min(100, Math.max(-100, 50 + prevMargin * 200))

    return [
      { key: "mrr", actual: mrr, target: targets.mrr, previousActual: prevMrr ?? undefined },
      { key: "cac", actual: cac, target: targets.cac, previousActual: prevCac },
      { key: "ltv", actual: ltv, target: targets.ltv, previousActual: prevLtv },
      { key: "churn_rate", actual: actualChurn, target: targets.churn_rate },
      { key: "nps", actual: nps, target: targets.nps, previousActual: prevNps },
    ]
  }, [monthlyData, targets])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!autoRefreshEnabled) return
    const interval = setInterval(() => {
      setLastRefresh(new Date())
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [autoRefreshEnabled])

  const handleStartEdit = () => {
    setDraftTargets(
      Object.fromEntries(
        KPI_DEFINITIONS.map((d) => {
          const val = targets[d.key]
          return [d.key, d.format === "percentage" ? (val * 100).toString() : val.toString()]
        })
      )
    )
    setEditingTargets(true)
  }

  const handleSaveTargets = () => {
    const newTargets: Record<string, number> = {}
    for (const def of KPI_DEFINITIONS) {
      const raw = parseFloat(draftTargets[def.key] ?? "0")
      newTargets[def.key] = def.format === "percentage" ? raw / 100 : raw
    }
    setTargets(newTargets)
    setEditingTargets(false)
  }

  const summaryCount = { green: 0, yellow: 0, red: 0 }
  for (const kpi of kpiData) {
    const def = KPI_DEFINITIONS.find((d) => d.key === kpi.key)!
    const level = getAlertLevel(kpi.actual, kpi.target, def.invertColors)
    summaryCount[level]++
  }

  if (financialLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted/20 rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-48 bg-muted/20 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">KPIs em Tempo Real</h2>
          <p className="text-sm text-muted-foreground">
            Metricas de performance — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Atualizado: {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLastRefresh(new Date())}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          {!editingTargets ? (
            <Button variant="outline" size="sm" onClick={handleStartEdit}>
              <Pencil className="h-4 w-4 mr-1" />
              Editar Metas
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={handleSaveTargets}>
                <Save className="h-4 w-4 mr-1" />
                Salvar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingTargets(false)}>
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Alert Summary */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={alertStyles.green.badge}>
          <CheckCircle className="h-3 w-3 mr-1" />
          {summaryCount.green} no alvo
        </Badge>
        {summaryCount.yellow > 0 && (
          <Badge variant="outline" className={alertStyles.yellow.badge}>
            <AlertTriangle className="h-3 w-3 mr-1" />
            {summaryCount.yellow} atencao
          </Badge>
        )}
        {summaryCount.red > 0 && (
          <Badge variant="outline" className={alertStyles.red.badge}>
            <AlertTriangle className="h-3 w-3 mr-1" />
            {summaryCount.red} critico
          </Badge>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {KPI_DEFINITIONS.map((def) => {
          const kpi = kpiData.find((k) => k.key === def.key)!
          const alertLevel = getAlertLevel(kpi.actual, kpi.target, def.invertColors)
          const styles = alertStyles[alertLevel]
          const Icon = def.icon

          const change =
            kpi.previousActual != null && kpi.previousActual !== 0
              ? ((kpi.actual - kpi.previousActual) / Math.abs(kpi.previousActual)) * 100
              : null

          return (
            <Card
              key={def.key}
              className={cn("relative overflow-hidden border", styles.border)}
            >
              {/* Alert indicator strip */}
              <div className={cn("absolute top-0 left-0 right-0 h-1", styles.bg.replace("/10", "/60"))} />

              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-md", styles.bg)}>
                      <Icon className={cn("h-4 w-4", styles.text)} />
                    </div>
                    <CardTitle className="text-sm font-medium">{def.label}</CardTitle>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px]", styles.badge)}>
                    {alertLabels[alertLevel]}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">{def.description}</p>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Actual value */}
                <div className="text-2xl font-bold font-mono tabular-nums">
                  {formatKPIValue(kpi.actual, def.format)}
                </div>

                {/* Change indicator */}
                {change != null && (
                  <div className="flex items-center gap-1 text-xs">
                    {change > 0 ? (
                      <ArrowUpRight className={cn("h-3 w-3", def.invertColors ? "text-despesa" : "text-receita")} />
                    ) : change < 0 ? (
                      <ArrowDownRight className={cn("h-3 w-3", def.invertColors ? "text-receita" : "text-despesa")} />
                    ) : (
                      <Minus className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className={cn(
                      "font-mono tabular-nums",
                      change === 0
                        ? "text-muted-foreground"
                        : (change > 0) !== (def.invertColors ?? false)
                          ? "text-receita"
                          : "text-despesa"
                    )}>
                      {change > 0 ? "+" : ""}{change.toFixed(1)}% vs. anterior
                    </span>
                  </div>
                )}

                <Separator />

                {/* Target */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Meta</span>
                  {editingTargets ? (
                    <Input
                      className="h-7 w-24 text-xs font-mono text-right"
                      value={draftTargets[def.key] ?? ""}
                      onChange={(e) =>
                        setDraftTargets((d) => ({ ...d, [def.key]: e.target.value }))
                      }
                    />
                  ) : (
                    <span className="text-xs font-mono tabular-nums font-medium">
                      {formatKPIValue(kpi.target, def.format)}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", styles.bg.replace("/10", "/60"))}
                    style={{
                      width: `${Math.min(100, kpi.target > 0
                        ? def.invertColors
                          ? Math.max(0, (1 - (kpi.actual - kpi.target) / kpi.target)) * 100
                          : (kpi.actual / kpi.target) * 100
                        : 0
                      )}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Monthly Trend Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolucao Mensal de KPIs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Mes</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">MRR</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">CAC</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">LTV</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">LTV/CAC</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Margem EBITDA</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData
                  .filter((d) => d.receita !== null)
                  .map((d) => {
                    const mrr = d.receita ?? 0
                    const despVar = d.despesasVariaveis ?? 0
                    const marketingCost = despVar * 0.3
                    const estCustomers = mrr > 0 ? Math.max(Math.ceil(mrr / 2000), 1) : 1
                    const cac = marketingCost / estCustomers
                    const churn = 0.05
                    const ltv = mrr > 0 ? (mrr / estCustomers) / churn : 0
                    const ltvCac = cac > 0 ? ltv / cac : 0

                    return (
                      <tr key={d.monthKey} className="border-b border-border/50">
                        <td className="py-2 text-xs font-medium">{d.month}</td>
                        <td className="py-2 text-right font-mono tabular-nums text-xs">
                          {formatBRLCompact(mrr)}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-xs">
                          {formatBRLCompact(cac)}
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-xs">
                          {formatBRLCompact(ltv)}
                        </td>
                        <td className={cn(
                          "py-2 text-right font-mono tabular-nums text-xs font-medium",
                          ltvCac >= 3 ? "text-receita" : ltvCac >= 1 ? "text-amber-500" : "text-despesa"
                        )}>
                          {ltvCac.toFixed(1)}x
                        </td>
                        <td className={cn(
                          "py-2 text-right font-mono tabular-nums text-xs",
                          (d.margemEbitda ?? 0) >= 0 ? "text-receita" : "text-despesa"
                        )}>
                          {d.margemEbitda != null ? `${(d.margemEbitda * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
