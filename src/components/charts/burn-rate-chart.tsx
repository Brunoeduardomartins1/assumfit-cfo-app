"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MONTHLY_DATA, type MonthlyData } from "@/config/seed-data"
import { formatBRLCompact } from "@/lib/formatters/currency"

const C = { red: "#f87171", green: "#4ade80", grid: "rgba(255,255,255,0.06)", axis: "#64748b", border: "rgba(255,255,255,0.08)" }

interface BurnRateChartProps { monthlyData?: MonthlyData[] }

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  const isProfit = val < 0
  return (
    <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700/50 rounded-lg px-3 py-2.5 shadow-2xl">
      <p className="text-[11px] font-medium text-zinc-200 mb-1">{label}</p>
      <p className="text-[11px] font-mono tabular-nums font-medium" style={{ color: isProfit ? C.green : C.red }}>
        {isProfit ? "Lucro: " : "Queima: "}{formatBRLCompact(Math.abs(val))}
      </p>
    </div>
  )
}

export function BurnRateChart({ monthlyData }: BurnRateChartProps) {
  const data = (monthlyData ?? MONTHLY_DATA)
    .filter((d) => d.burnRate !== null)
    .map((d) => ({ month: d.month, burnRate: d.burnRate ?? 0 }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Burn Rate Mensal</CardTitle>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: C.red }} />Queima
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: C.green }} />Lucro
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.axis }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBRLCompact(v)} width={70} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke={C.green} strokeWidth={1.5} strokeDasharray="6 3" label={{ value: "Break-even", position: "insideTopRight", fill: C.green, fontSize: 10, fontWeight: 600 }} />
              <Bar dataKey="burnRate" radius={[4, 4, 4, 4]} barSize={20}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.burnRate < 0 ? C.green : C.red} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
