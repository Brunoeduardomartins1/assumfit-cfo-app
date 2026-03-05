"use client"

import dynamic from "next/dynamic"
import { KPICard } from "@/components/charts/kpi-card"
import { PhaseBadge } from "@/components/shared/phase-badge"
import { PhaseTimeline } from "@/components/charts/phase-timeline"
import { getCurrentPhase } from "@/config/phases"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatBRL } from "@/lib/formatters/currency"
import { useOrg } from "@/hooks/use-org"
import { useFinancialData } from "@/hooks/use-financial-data"

function ChartSkeleton() {
  return <div className="h-[300px] bg-muted/20 rounded-lg animate-pulse" />
}

const CashFlowChart = dynamic(() => import("@/components/charts/cash-flow-chart").then(m => m.CashFlowChart), { ssr: false, loading: () => <ChartSkeleton /> })
const BurnRateChart = dynamic(() => import("@/components/charts/burn-rate-chart").then(m => m.BurnRateChart), { ssr: false, loading: () => <ChartSkeleton /> })
const RevenueWaterfallChart = dynamic(() => import("@/components/charts/revenue-waterfall").then(m => m.RevenueWaterfallChart), { ssr: false, loading: () => <ChartSkeleton /> })
const MarginsChart = dynamic(() => import("@/components/charts/margins-chart").then(m => m.MarginsChart), { ssr: false, loading: () => <ChartSkeleton /> })
const ValuationChart = dynamic(() => import("@/components/charts/valuation-chart").then(m => m.ValuationChart), { ssr: false, loading: () => <ChartSkeleton /> })
const EbitdaChart = dynamic(() => import("@/components/charts/ebitda-chart").then(m => m.EbitdaChart), { ssr: false, loading: () => <ChartSkeleton /> })
const ExpensesDonut = dynamic(() => import("@/components/charts/expenses-donut").then(m => m.ExpensesDonut), { ssr: false, loading: () => <ChartSkeleton /> })

export default function PainelPage() {
  const currentPhase = getCurrentPhase()
  const { orgId } = useOrg()
  const { monthlyData, snapshot: d, topExpenses, loading } = useFinancialData(orgId)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted/20 rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted/20 rounded-lg animate-pulse" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ChartSkeleton /><ChartSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Visao Geral Financeira</h2>
          <p className="text-sm text-muted-foreground">
            ASSUMFIT / MUVX — Dados de {d.month}
          </p>
        </div>
        <PhaseBadge phase={currentPhase} />
      </div>

      {/* Phase Timeline */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <PhaseTimeline />
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Saldo de Caixa" value={d.saldo_caixa} previousValue={d.saldo_anterior} format="currency" />
        <KPICard title="Burn Rate Mensal" value={d.burn_rate} previousValue={d.burn_rate_anterior} format="currency" invertColors />
        <KPICard title="Runway" value={d.runway_meses} format="months" />
        <KPICard title="EBITDA" value={d.ebitda} format="currency" />
      </div>

      {/* Row 1: Combo chart + Conditional bars */}
      <div className="grid gap-4 md:grid-cols-2">
        <CashFlowChart monthlyData={monthlyData} />
        <BurnRateChart monthlyData={monthlyData} />
      </div>

      {/* Row 2: Stacked DRE + Radar health */}
      <div className="grid gap-4 md:grid-cols-2">
        <RevenueWaterfallChart monthlyData={monthlyData} />
        <MarginsChart monthlyData={monthlyData} />
      </div>

      {/* Row 3: EBITDA bars + Expenses donut */}
      <div className="grid gap-4 md:grid-cols-2">
        <EbitdaChart monthlyData={monthlyData} />
        <ExpensesDonut expenses={topExpenses} />
      </div>

      {/* Row 4: Valuation full-width + DRE summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <ValuationChart monthlyData={monthlyData} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Resumo DRE ({d.month})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <DRESummaryRow label="Receita Operacional" value={d.receita_total} />
              <DRESummaryRow label="Custos Fixos" value={-d.custos_fixos} negative />
              <DRESummaryRow label="Despesas Variaveis" value={-d.despesas_variaveis} negative />
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="text-sm font-medium">EBITDA</span>
                <span className="text-sm font-mono tabular-nums font-bold text-despesa">
                  {formatBRL(d.ebitda)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DRESummaryRow({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono tabular-nums font-medium ${negative ? "text-despesa" : ""}`}>
        {formatBRL(value)}
      </span>
    </div>
  )
}
