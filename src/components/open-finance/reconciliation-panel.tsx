"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ReconciliationEntry } from "@/types/open-finance"
import { formatBRL } from "@/lib/formatters/currency"
import { cn } from "@/lib/utils"
import { AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react"

interface ReconciliationPanelProps {
  entries: ReconciliationEntry[]
}

const STATUS_ICON = {
  ok: CheckCircle2,
  warning: AlertTriangle,
  alert: AlertCircle,
}

const STATUS_COLORS = {
  ok: "text-receita",
  warning: "text-alerta",
  alert: "text-despesa",
}

export function ReconciliationPanel({ entries }: ReconciliationPanelProps) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conciliacao</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Importe transacoes bancarias para iniciar a conciliacao.
          </p>
        </CardContent>
      </Card>
    )
  }

  const alerts = entries.filter((e) => e.status === "alert")
  const warnings = entries.filter((e) => e.status === "warning")
  const ok = entries.filter((e) => e.status === "ok")

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Conciliacao Estimado vs Realizado</CardTitle>
          <div className="flex items-center gap-2 text-xs">
            {alerts.length > 0 && (
              <Badge variant="outline" className="bg-despesa/20 text-despesa border-despesa/30 text-[10px]">
                {alerts.length} alertas
              </Badge>
            )}
            {warnings.length > 0 && (
              <Badge variant="outline" className="bg-alerta/20 text-alerta border-alerta/30 text-[10px]">
                {warnings.length} avisos
              </Badge>
            )}
            <Badge variant="outline" className="bg-receita/20 text-receita border-receita/30 text-[10px]">
              {ok.length} ok
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 text-xs text-muted-foreground font-medium" />
                <th className="text-left py-1.5 text-xs text-muted-foreground font-medium">Conta</th>
                <th className="text-right py-1.5 text-xs text-muted-foreground font-medium">Estimado</th>
                <th className="text-right py-1.5 text-xs text-muted-foreground font-medium">Realizado</th>
                <th className="text-right py-1.5 text-xs text-muted-foreground font-medium">Variancia</th>
                <th className="text-right py-1.5 text-xs text-muted-foreground font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const Icon = STATUS_ICON[entry.status]
                return (
                  <tr key={`${entry.accountLabel}_${entry.monthKey}_${i}`} className="border-b border-border/50">
                    <td className="py-1.5 pr-2">
                      <Icon className={cn("h-3.5 w-3.5", STATUS_COLORS[entry.status])} />
                    </td>
                    <td className="py-1.5 text-xs">{entry.accountLabel}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-xs">
                      {formatBRL(entry.estimado)}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-xs">
                      {formatBRL(entry.realizado)}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 text-right font-mono tabular-nums text-xs",
                        entry.variance > 0 ? "text-despesa" : "text-receita"
                      )}
                    >
                      {entry.variance > 0 ? "+" : ""}
                      {formatBRL(entry.variance)}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 text-right font-mono tabular-nums text-xs font-medium",
                        STATUS_COLORS[entry.status]
                      )}
                    >
                      {entry.variancePercent > 0 ? "+" : ""}
                      {entry.variancePercent.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
