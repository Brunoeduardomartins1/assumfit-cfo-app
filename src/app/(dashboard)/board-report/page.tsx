"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { PhaseBadge } from "@/components/shared/phase-badge"
import { getCurrentPhase, getPhaseConfig } from "@/config/phases"
import { useOrg } from "@/hooks/use-org"
import { useFinancialData } from "@/hooks/use-financial-data"
import { usePeriodStore } from "@/stores/period-store"
import { filterByPeriod, formatPeriodLabel } from "@/lib/period-utils"
import { formatBRL, formatBRLCompact } from "@/lib/formatters/currency"
import { cn } from "@/lib/utils"
import Image from "next/image"
import {
  Download,
  Printer,
  Send,
  Sparkles,
  Calendar,
  Activity,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"

export default function BoardReportPage() {
  const currentPhase = getCurrentPhase()
  const phaseConfig = getPhaseConfig(currentPhase)
  const { orgId } = useOrg()
  const { monthlyData: allMonthlyData, snapshot, topExpenses, loading } = useFinancialData(orgId)
  const periodRange = usePeriodStore((s) => s.getDateRange)()
  const periodLabel = formatPeriodLabel(periodRange)
  const monthlyData = filterByPeriod(allMonthlyData, periodRange, (m) => m.monthKey)
  const reportRef = useRef<HTMLDivElement>(null)

  const [narrative, setNarrative] = useState("")
  const [generatingNarrative, setGeneratingNarrative] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  const dreMonths = monthlyData.filter((d) => d.receita !== null)
  const totalReceita = dreMonths.reduce((sum, d) => sum + (d.receita ?? 0), 0)
  const totalEbitda = dreMonths.reduce((sum, d) => sum + (d.ebitda ?? 0), 0)
  const avgBurnRate =
    dreMonths.filter((d) => (d.burnRate ?? 0) > 0).reduce((sum, d) => sum + (d.burnRate ?? 0), 0) /
    Math.max(dreMonths.filter((d) => (d.burnRate ?? 0) > 0).length, 1)

  const snap = snapshot

  const handleGenerateNarrative = async () => {
    setGeneratingNarrative(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Gere uma narrativa executiva em portugues para o board report mensal da ASSUMFIT/MUVX.
Dados do periodo ${periodLabel}:
- Receita Total: ${formatBRL(totalReceita)}
- EBITDA: ${formatBRL(totalEbitda)}
- Burn Rate: ${formatBRL(avgBurnRate)}
- Saldo de Caixa: ${formatBRL(snap.saldo_caixa)}
- Runway: ${snap.runway_meses.toFixed(1)} meses
- Fase: ${phaseConfig.label}

Escreva 3-4 paragrafos profissionais destacando: performance do periodo, principais conquistas, riscos e proximos passos. Tom formal mas direto.`,
            },
          ],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setNarrative(data.response || data.message || "")
      }
    } catch (err) {
      console.error("Failed to generate narrative:", err)
    } finally {
      setGeneratingNarrative(false)
    }
  }

  const handlePrint = () => window.print()

  const handleSendEmail = async () => {
    setSendingEmail(true)
    // Placeholder — would integrate with email API
    await new Promise((r) => setTimeout(r, 1500))
    setSendingEmail(false)
    alert("Board report enviado por email (simulacao)")
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted/20 rounded animate-pulse" />
        <div className="h-96 bg-muted/20 rounded-lg animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-semibold">Board Report</h2>
          <p className="text-sm text-muted-foreground">
            Relatorio automatizado para investidores — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleGenerateNarrative} disabled={generatingNarrative}>
            {generatingNarrative ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Gerar Narrativa IA
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button size="sm" onClick={handleSendEmail} disabled={sendingEmail}>
            {sendingEmail ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar
          </Button>
        </div>
      </div>

      {/* Report */}
      <div ref={reportRef} className="space-y-6 print:space-y-4">
        {/* Report Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Image src="/logo.png" alt="ASSUMFIT" width={100} height={28} className="h-6 w-auto" />
                  <Separator orientation="vertical" className="h-5" />
                  <h3 className="text-xl font-semibold">Board Report — {periodLabel}</h3>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date().toLocaleDateString("pt-BR")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" />
                    MUVX (ASSUMFIT)
                  </span>
                </div>
              </div>
              <PhaseBadge phase={currentPhase} />
            </div>
          </CardContent>
        </Card>

        {/* KPI Summary Grid */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Receita Total", value: totalReceita, format: "currency" as const },
            { label: "EBITDA", value: totalEbitda, format: "currency" as const },
            { label: "Saldo de Caixa", value: snap.saldo_caixa, format: "currency" as const },
            { label: "Burn Rate", value: snap.burn_rate, format: "currency" as const },
            { label: "Runway", value: snap.runway_meses, format: "months" as const },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-4 pb-3">
                <p className="text-[11px] text-muted-foreground mb-1">{kpi.label}</p>
                <p className="text-lg font-bold font-mono tabular-nums">
                  {kpi.format === "months" ? `${kpi.value.toFixed(1)} meses` : formatBRLCompact(kpi.value)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* DRE Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">DRE Resumida</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Mes</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Receita</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">EBITDA</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Margem</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Burn Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {dreMonths.map((d) => (
                    <tr key={d.monthKey} className="border-b border-border/50">
                      <td className="py-2 text-xs font-medium">{d.month}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs">{formatBRLCompact(d.receita ?? 0)}</td>
                      <td className={cn("py-2 text-right font-mono tabular-nums text-xs font-medium", (d.ebitda ?? 0) >= 0 ? "text-receita" : "text-despesa")}>
                        {formatBRLCompact(d.ebitda ?? 0)}
                      </td>
                      <td className={cn("py-2 text-right font-mono tabular-nums text-xs", (d.margemEbitda ?? 0) >= 0 ? "text-receita" : "text-despesa")}>
                        {d.margemEbitda != null ? `${(d.margemEbitda * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs text-despesa">
                        {d.burnRate ? formatBRLCompact(d.burnRate) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Top Expenses */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Maiores Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topExpenses.slice(0, 5).map((exp) => {
                const total = topExpenses.reduce((s, e) => s + e.value, 0)
                const pct = total > 0 ? (exp.value / total) * 100 : 0
                return (
                  <div key={exp.name} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">{exp.name}</span>
                    <span className="font-mono tabular-nums text-xs">{formatBRLCompact(exp.value)} ({pct.toFixed(0)}%)</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* AI Narrative */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-chart-1" />
              Narrativa Executiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            {narrative ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Textarea
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  className="min-h-[200px] text-sm"
                  placeholder="Clique em 'Gerar Narrativa IA' para criar automaticamente..."
                />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Clique em &quot;Gerar Narrativa IA&quot; para criar a narrativa executiva automaticamente</p>
                <p className="text-xs mt-1">Usa Claude AI para analisar os dados e gerar um texto profissional</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
