"use client"

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MONTHLY_DATA, type MonthlyData } from "@/config/seed-data"
import { formatBRLCompact } from "@/lib/formatters/currency"

const C = { purple: "#a78bfa", cyan: "#22d3ee", grid: "rgba(255,255,255,0.06)", axis: "#64748b", border: "rgba(255,255,255,0.08)" }

interface ValuationChartProps { monthlyData?: MonthlyData[] }

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const val = payload.find((p: any) => p.dataKey === "valuation")
  if (!val) return null
  return (
    <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700/50 rounded-lg px-3 py-2.5 shadow-2xl">
      <p className="text-[11px] font-medium text-zinc-200 mb-1">{label}</p>
      <p className="text-sm font-mono tabular-nums font-semibold" style={{ color: C.purple }}>
        {formatBRLCompact(val.value)}
      </p>
    </div>
  )
}

export function ValuationChart({ monthlyData }: ValuationChartProps) {
  const data = (monthlyData ?? MONTHLY_DATA)
    .filter((d) => d.valuation > 0)
    .map((d) => ({
      month: d.month,
      valuation: d.valuation,
      milestone: (d.valuation > 100_000_000 || d.valuation > 50_000_000 || d.valuation > 10_000_000) ? d.valuation : undefined,
    }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Valuation Estimado</CardTitle>
          <span className="text-[10px] text-muted-foreground">ARR-Based | Marcos destacados</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.purple} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={C.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.axis }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBRLCompact(v)} width={65} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="valuation" fill="url(#valGrad)" stroke="none" />
              <Line type="monotone" dataKey="valuation" stroke={C.purple} strokeWidth={2.5} dot={false} name="Valuation" />
              <Scatter dataKey="milestone" fill={C.cyan} r={5} name="Marco" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
