"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MONTHLY_DATA, type MonthlyData } from "@/config/seed-data"
import { formatBRLCompact } from "@/lib/formatters/currency"

const C = { green: "#4ade80", red: "#f87171", orange: "#fb923c", amber: "#fbbf24", grid: "rgba(255,255,255,0.06)", axis: "#64748b", border: "rgba(255,255,255,0.08)" }

interface RevenueWaterfallChartProps { monthlyData?: MonthlyData[] }

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700/50 rounded-lg px-3 py-2.5 shadow-2xl">
      <p className="text-[11px] font-medium text-zinc-200 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.fill }} />
            <span className="text-zinc-400">{p.name}</span>
          </div>
          <span className="font-mono tabular-nums font-medium text-zinc-100">{formatBRLCompact(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function CustomLegend({ payload }: any) {
  return (
    <div className="flex items-center justify-center gap-5 mt-3">
      {payload?.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: entry.color }} />
          {entry.value}
        </div>
      ))}
    </div>
  )
}

export function RevenueWaterfallChart({ monthlyData }: RevenueWaterfallChartProps) {
  const data = (monthlyData ?? MONTHLY_DATA)
    .filter((d) => d.receita !== null)
    .map((d) => ({
      month: d.month,
      receita: d.receita ?? 0,
      custosFixos: d.custosFixos ?? 0,
      despVariaveis: d.despesasVariaveis ?? 0,
      cogs: d.cogs ?? 0,
    }))
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">DRE Mensal</CardTitle>
          <span className="text-[10px] text-muted-foreground">Stacked — Custos empilhados</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} stackOffset="sign">
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.axis }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBRLCompact(v)} width={65} />
              <Tooltip content={<ChartTooltip />} />
              <Legend content={<CustomLegend />} />
              <Bar dataKey="receita" name="Receita" fill={C.green} fillOpacity={0.8} stackId="a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="cogs" name="COGS" fill={C.amber} fillOpacity={0.6} stackId="b" />
              <Bar dataKey="custosFixos" name="Custos Fixos" fill={C.orange} fillOpacity={0.6} stackId="b" />
              <Bar dataKey="despVariaveis" name="Desp. Var." fill={C.red} fillOpacity={0.6} stackId="b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
