"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { formatBRL, formatBRLCompact } from "@/lib/formatters/currency"
import { formatPercent } from "@/lib/formatters/percentage"
import { cn } from "@/lib/utils"

interface KPICardProps {
  title: string
  value: number
  previousValue?: number
  format?: "currency" | "currency-compact" | "percentage" | "months" | "number"
  invertColors?: boolean
}

export function KPICard({
  title,
  value,
  previousValue,
  format = "currency",
  invertColors,
}: KPICardProps) {
  const change = previousValue
    ? ((value - previousValue) / Math.abs(previousValue)) * 100
    : 0
  const isPositive = invertColors ? change < 0 : change > 0
  const isNeutral = Math.abs(change) < 0.5

  const formatValue = (v: number) => {
    switch (format) {
      case "currency":
        return formatBRL(v)
      case "currency-compact":
        return formatBRLCompact(v)
      case "percentage":
        return formatPercent(v)
      case "months":
        return `${v.toFixed(1)} meses`
      case "number":
        return v.toLocaleString("pt-BR")
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono tabular-nums">
          {formatValue(value)}
        </div>
        {previousValue !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs mt-1",
              isNeutral
                ? "text-muted-foreground"
                : isPositive
                  ? "text-receita"
                  : "text-despesa"
            )}
          >
            {isNeutral ? (
              <Minus className="h-3 w-3" />
            ) : isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(change).toFixed(1)}% vs. mes anterior
          </div>
        )}
      </CardContent>
    </Card>
  )
}
