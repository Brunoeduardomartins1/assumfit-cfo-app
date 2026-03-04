"use client"

import { Card, CardContent } from "@/components/ui/card"
import { generateInsights, type FinancialInsight } from "@/lib/ai"
import { AlertTriangle, TrendingUp, Info, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const ICON_MAP = {
  risk: AlertTriangle,
  opportunity: TrendingUp,
  info: Info,
  alert: AlertCircle,
}

const COLOR_MAP = {
  risk: "text-despesa bg-despesa/10 border-despesa/20",
  opportunity: "text-receita bg-receita/10 border-receita/20",
  info: "text-chart-1 bg-chart-1/10 border-chart-1/20",
  alert: "text-alerta bg-alerta/10 border-alerta/20",
}

export function InsightsPanel() {
  const insights = generateInsights()

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground px-1">
        Insights automaticos
      </h3>
      {insights.map((insight, i) => {
        const Icon = ICON_MAP[insight.type]
        return (
          <Card key={i} className={cn("border", COLOR_MAP[insight.type])}>
            <CardContent className="py-2.5 px-3">
              <div className="flex items-start gap-2">
                <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{insight.title}</span>
                    {insight.metric && (
                      <span className="text-xs font-mono tabular-nums shrink-0">
                        {insight.metric}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5 opacity-80 leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
