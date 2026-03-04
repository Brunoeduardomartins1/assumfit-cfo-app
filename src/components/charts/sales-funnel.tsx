"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface FunnelStep {
  label: string
  value: number
  format?: "currency" | "number" | "percentage"
}

interface SalesFunnelProps {
  title: string
  steps: FunnelStep[]
}

export function SalesFunnel({ title, steps }: SalesFunnelProps) {
  const maxValue = Math.max(...steps.map((s) => s.value))

  const formatValue = (val: number, format?: string) => {
    switch (format) {
      case "currency":
        return `R$ ${val.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
      case "percentage":
        return `${(val * 100).toFixed(1)}%`
      default:
        return val.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
    }
  }

  const colors = [
    "bg-chart-1",
    "bg-chart-2",
    "bg-receita",
    "bg-fase-escala",
    "bg-alerta",
    "bg-despesa",
    "bg-chart-3",
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {steps.map((step, i) => {
            const widthPercent = maxValue > 0 ? (step.value / maxValue) * 100 : 0
            const convRate =
              i > 0 && steps[i - 1].value > 0
                ? ((step.value / steps[i - 1].value) * 100).toFixed(1)
                : null

            return (
              <div key={step.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{step.label}</span>
                  <div className="flex items-center gap-2">
                    {convRate && (
                      <span className="text-[10px] text-muted-foreground/60">
                        {convRate}%
                      </span>
                    )}
                    <span className="font-mono tabular-nums font-medium">
                      {formatValue(step.value, step.format)}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", colors[i % colors.length])}
                    style={{ width: `${Math.max(widthPercent, 1)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
