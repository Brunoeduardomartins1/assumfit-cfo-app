"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { SalesFunnel } from "@/components/charts/sales-funnel"
import { KPICard } from "@/components/charts/kpi-card"
import { PhaseBadge } from "@/components/shared/phase-badge"
import { getCurrentPhase } from "@/config/phases"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { formatBRLCompact } from "@/lib/formatters/currency"
import { MONTHLY_DATA } from "@/config/seed-data"

// Revenue projection data
const revenueData = MONTHLY_DATA
  .filter((d) => d.receita !== null && d.receita !== undefined)
  .map((d) => ({
    month: d.month,
    receita: d.receita ?? 0,
  }))

// Sample funnel data for MUVX Core
const coreFunnel = [
  { label: "Investimento Growth", value: 5000, format: "currency" as const },
  { label: "CPL Trafego", value: 13.18, format: "currency" as const },
  { label: "Novos Cadastros", value: 379 },
  { label: "Installs", value: 114 },
  { label: "Ativacoes", value: 34 },
  { label: "Conversao", value: 17 },
  { label: "Ativos Acumulados", value: 286 },
]

const digitalFunnel = [
  { label: "Investimento Growth", value: 69920, format: "currency" as const },
  { label: "CPL Trafego", value: 10.63, format: "currency" as const },
  { label: "Novos Cadastros Personal", value: 6578 },
  { label: "Personais Ativados", value: 395 },
  { label: "Alunos Ativados", value: 1974 },
  { label: "Receita Mensal", value: 117450, format: "currency" as const },
]

const influenciaFunnel = [
  { label: "Seguidores IG", value: 339000 },
  { label: "Alcance IG", value: 40000 },
  { label: "Cliques (CTR 2%)", value: 800 },
  { label: "Conversao (5%)", value: 40 },
  { label: "Base Personal Total", value: 50000 },
  { label: "Personal Ativos", value: 5000 },
]

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700/50 rounded-lg px-3 py-2.5 shadow-2xl">
      <p className="text-[11px] font-medium text-zinc-200 mb-1">{label}</p>
      <p className="text-sm font-mono tabular-nums font-semibold" style={{ color: "#4ade80" }}>
        {formatBRLCompact(payload[0].value)}
      </p>
    </div>
  )
}

export default function ProjecoesPage() {
  const currentPhase = getCurrentPhase()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Projecoes de Vendas</h2>
          <p className="text-sm text-muted-foreground">
            MUVX Core, Digital e Influencia — Funis e metricas
          </p>
        </div>
        <PhaseBadge phase={currentPhase} />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPICard title="Receita Projetada (Dez/26)" value={7049208.64} format="currency" />
        <KPICard title="Valuation (Nov/26)" value={338362014.85} format="currency-compact" />
        <KPICard title="Break-even" value={5} format="months" />
      </div>

      {/* Revenue Curve */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Curva de Receita Projetada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
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
                  width={65}
                />
                <Tooltip content={<RevenueTooltip />} />
                <Line
                  type="monotone"
                  dataKey="receita"
                  stroke="#4ade80"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Funnels by Product */}
      <Tabs defaultValue="core">
        <TabsList>
          <TabsTrigger value="core">MUVX Core</TabsTrigger>
          <TabsTrigger value="digital">MUVX Digital</TabsTrigger>
          <TabsTrigger value="influencia">Influencia</TabsTrigger>
        </TabsList>

        <TabsContent value="core" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SalesFunnel title="Funil MUVX Core (Cenario 5%)" steps={coreFunnel} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metricas Core</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cenario</span>
                  <span className="font-medium">5% / 15% growth</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CPL medio</span>
                  <span className="font-mono">R$ 13,18</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa Install</span>
                  <span className="font-mono">30%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa Ativacao</span>
                  <span className="font-mono">30%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Churn mensal</span>
                  <span className="font-mono">5%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="digital" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SalesFunnel title="Funil MUVX Digital (Cenario 40%)" steps={digitalFunnel} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metricas Digital</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Take Rate</span>
                  <span className="font-mono">7,5%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tarifa por transacao</span>
                  <span className="font-mono">R$ 3,99</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CPL medio</span>
                  <span className="font-mono">R$ 10,63</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxa Ativacao Personal</span>
                  <span className="font-mono">6%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="influencia" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SalesFunnel title="Funil Influencia" steps={influenciaFunnel} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Premissas Influencia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Seguidores IG</span>
                  <span className="font-mono">339K</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base personal total</span>
                  <span className="font-mono">50K</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Personal ativos</span>
                  <span className="font-mono">5K</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CTR IG</span>
                  <span className="font-mono">2%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Conversao IG</span>
                  <span className="font-mono">5%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
