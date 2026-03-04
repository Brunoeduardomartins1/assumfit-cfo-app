"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { PhaseBadge } from "@/components/shared/phase-badge"
import { getCurrentPhase, getPhaseConfig } from "@/config/phases"
import { MONTHLY_DATA, CURRENT_SNAPSHOT, TOP_EXPENSES, REVENUE_SOURCES } from "@/config/seed-data"
import { formatBRL, formatBRLCompact } from "@/lib/formatters/currency"
import { useAuditStore } from "@/stores/audit-store"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  FileText,
  Download,
  Printer,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  User,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from "lucide-react"

function KPIRow({
  label,
  value,
  previousValue,
  format = "brl",
}: {
  label: string
  value: number
  previousValue?: number
  format?: "brl" | "months" | "percent"
}) {
  const formatted =
    format === "brl"
      ? formatBRL(value)
      : format === "months"
        ? `${value.toFixed(1)} meses`
        : `${(value * 100).toFixed(1)}%`

  const delta = previousValue != null ? value - previousValue : null
  const deltaPercent =
    previousValue != null && previousValue !== 0
      ? ((value - previousValue) / Math.abs(previousValue)) * 100
      : null

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono tabular-nums text-sm font-medium">{formatted}</span>
        {delta != null && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-xs font-mono tabular-nums",
              delta > 0 ? "text-receita" : delta < 0 ? "text-despesa" : "text-muted-foreground"
            )}
          >
            {delta > 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : delta < 0 ? (
              <ArrowDownRight className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {deltaPercent != null ? `${deltaPercent > 0 ? "+" : ""}${deltaPercent.toFixed(1)}%` : ""}
          </span>
        )}
      </div>
    </div>
  )
}

export default function RelatoriosPage() {
  const currentPhase = getCurrentPhase()
  const phaseConfig = getPhaseConfig(currentPhase)
  const auditEntries = useAuditStore((s) => s.entries)
  const reportRef = useRef<HTMLDivElement>(null)

  const snap = CURRENT_SNAPSHOT
  const dreMonths = MONTHLY_DATA.filter((d) => d.receita !== null)
  const latestDRE = dreMonths[dreMonths.length - 1]
  const prevDRE = dreMonths.length > 1 ? dreMonths[dreMonths.length - 2] : null

  // Summary metrics
  const totalReceita2026 = dreMonths.reduce((sum, d) => sum + (d.receita ?? 0), 0)
  const totalEbitda2026 = dreMonths.reduce((sum, d) => sum + (d.ebitda ?? 0), 0)
  const avgBurnRate =
    dreMonths.filter((d) => (d.burnRate ?? 0) > 0).reduce((sum, d) => sum + (d.burnRate ?? 0), 0) /
    Math.max(dreMonths.filter((d) => (d.burnRate ?? 0) > 0).length, 1)
  const breakEvenMonth = dreMonths.find((d) => (d.ebitda ?? 0) > 0)

  const handlePrint = () => {
    window.print()
  }

  const handleExportPDF = () => {
    // jsPDF integration — for now trigger print dialog
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-semibold">Relatorios</h2>
          <p className="text-sm text-muted-foreground">
            Relatorio executivo mensal para o board
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Imprimir
          </Button>
          <Button size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-1" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="space-y-6 print:space-y-4">
        {/* Report Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Image src="/logo.png" alt="ASSUMFIT" width={100} height={28} className="h-6 w-auto" />
                  <Separator orientation="vertical" className="h-5" />
                  <h3 className="text-xl font-semibold">Relatorio Executivo Mensal</h3>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {snap.month}
                  </span>
                  <span className="flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" />
                    MUVX (ASSUMFIT)
                  </span>
                </div>
              </div>
              <PhaseBadge phase={currentPhase} />
            </div>
            <Separator className="my-4" />
            <p className="text-sm text-muted-foreground">
              Fase atual: <strong className="text-foreground">{phaseConfig.label}</strong> ({phaseConfig.dateRange.start} a {phaseConfig.dateRange.end})
            </p>
          </CardContent>
        </Card>

        {/* KPI Summary */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Indicadores de Caixa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <KPIRow label="Saldo de Caixa" value={snap.saldo_caixa} previousValue={snap.saldo_anterior} />
              <Separator />
              <KPIRow label="Burn Rate" value={snap.burn_rate} previousValue={snap.burn_rate_anterior} />
              <Separator />
              <KPIRow label="Runway" value={snap.runway_meses} format="months" />
              <Separator />
              <KPIRow label="EBITDA" value={snap.ebitda} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Acumulado 2026
              </CardTitle>
            </CardHeader>
            <CardContent>
              <KPIRow label="Receita Total" value={totalReceita2026} />
              <Separator />
              <KPIRow label="EBITDA Acumulado" value={totalEbitda2026} />
              <Separator />
              <KPIRow label="Burn Rate Medio" value={avgBurnRate} />
              <Separator />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Break-even</span>
                <Badge variant="outline" className={cn(
                  "text-xs",
                  breakEvenMonth ? "bg-receita/20 text-receita" : "bg-despesa/20 text-despesa"
                )}>
                  {breakEvenMonth ? breakEvenMonth.month : "Nao atingido"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* DRE Summary Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">DRE Resumida — Ultimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs text-muted-foreground font-medium">Mes</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Receita</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Custos Fixos</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Desp. Var.</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">EBITDA</th>
                    <th className="text-right py-2 text-xs text-muted-foreground font-medium">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {dreMonths.slice(-6).map((d) => (
                    <tr key={d.month} className="border-b border-border/50">
                      <td className="py-2 text-xs font-medium">{d.month}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs">
                        {formatBRLCompact(d.receita ?? 0)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs text-despesa">
                        {formatBRLCompact(d.custosFixos ?? 0)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs text-despesa">
                        {formatBRLCompact(d.despesasVariaveis ?? 0)}
                      </td>
                      <td className={cn(
                        "py-2 text-right font-mono tabular-nums text-xs font-medium",
                        (d.ebitda ?? 0) >= 0 ? "text-receita" : "text-despesa"
                      )}>
                        {formatBRLCompact(d.ebitda ?? 0)}
                      </td>
                      <td className={cn(
                        "py-2 text-right font-mono tabular-nums text-xs",
                        (d.margemEbitda ?? 0) >= 0 ? "text-receita" : "text-despesa"
                      )}>
                        {d.margemEbitda != null ? `${(d.margemEbitda * 100).toFixed(1)}%` : "—"}
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
            <CardTitle className="text-base">Maiores Despesas — {snap.month}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {TOP_EXPENSES.map((exp, i) => {
                const total = TOP_EXPENSES.reduce((s, e) => s + e.value, 0)
                const pct = (exp.value / total) * 100
                return (
                  <div key={exp.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{exp.name}</span>
                      <span className="font-mono tabular-nums text-xs font-medium">
                        {formatBRL(exp.value)} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-despesa/70 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Sources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fontes de Receita — Projecao 2026</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {REVENUE_SOURCES.map((src) => {
                const total = REVENUE_SOURCES.reduce((s, r) => s + r.value, 0)
                const pct = (src.value / total) * 100
                return (
                  <div key={src.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{src.name}</span>
                      <span className="font-mono tabular-nums text-xs font-medium">
                        {formatBRLCompact(src.value)} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-receita/70 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Audit Trail */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Historico de Alteracoes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {auditEntries.slice(0, 10).map((entry) => {
                const date = new Date(entry.timestamp)
                const timeStr = date.toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
                const actionColors: Record<string, string> = {
                  create: "bg-receita/20 text-receita",
                  update: "bg-chart-1/20 text-chart-1",
                  delete: "bg-despesa/20 text-despesa",
                  import: "bg-blue-500/20 text-blue-400",
                  export: "bg-violet-500/20 text-violet-400",
                  connect: "bg-amber-500/20 text-amber-400",
                  classify: "bg-emerald-500/20 text-emerald-400",
                }
                return (
                  <div key={entry.id} className="flex items-start gap-3 text-sm">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground font-mono">{timeStr}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("text-[9px] flex-shrink-0", actionColors[entry.action] ?? "")}
                    >
                      {entry.action}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{entry.details}</p>
                      {entry.before && entry.after && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {entry.before} → {entry.after}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 flex-shrink-0">
                      <User className="h-2.5 w-2.5" />
                      {entry.user}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
