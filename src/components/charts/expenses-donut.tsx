"use client"

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TOP_EXPENSES } from "@/config/seed-data"
import { formatBRL } from "@/lib/formatters/currency"

const COLORS = ["#f87171", "#fb923c", "#fbbf24", "#a78bfa", "#60a5fa", "#4ade80", "#22d3ee"]

const data = TOP_EXPENSES.map((e, i) => ({
  name: e.name,
  value: e.value,
  color: COLORS[i % COLORS.length],
}))

const total = data.reduce((s, d) => s + d.value, 0)

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const pct = ((d.value / total) * 100).toFixed(1)
  return (
    <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700/50 rounded-lg px-3 py-2.5 shadow-2xl">
      <p className="text-[11px] font-medium text-zinc-200 mb-1">{d.name}</p>
      <p className="text-[11px] font-mono tabular-nums font-medium text-zinc-100">
        {formatBRL(d.value)} ({pct}%)
      </p>
    </div>
  )
}

export function ExpensesDonut() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Composicao de Custos</CardTitle>
          <span className="text-[10px] text-muted-foreground">Jan/26</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="h-[220px] w-[220px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5">
            {data.map((d) => {
              const pct = ((d.value / total) * 100).toFixed(0)
              return (
                <div key={d.name} className="flex items-center gap-2 text-[11px]">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground flex-1 truncate">{d.name}</span>
                  <span className="font-mono tabular-nums text-foreground">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
