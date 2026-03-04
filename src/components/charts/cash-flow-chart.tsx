"use client"

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MONTHLY_DATA } from "@/config/seed-data"
import { formatBRLCompact } from "@/lib/formatters/currency"

const C = { blue: "#60a5fa", green: "#4ade80", red: "#f87171", grid: "rgba(255,255,255,0.06)", axis: "#64748b", border: "rgba(255,255,255,0.08)" }

const data = MONTHLY_DATA.map((d) => ({
  month: d.month,
  entradas: d.entradas,
  saidas: d.saidas,
  saldo: d.saldoFinal,
}))

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700/50 rounded-lg px-3 py-2.5 shadow-2xl">
      <p className="text-[11px] font-medium text-zinc-200 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.stroke || p.fill }} />
            <span className="text-zinc-400">{p.name}</span>
          </div>
          <span className="font-mono tabular-nums font-medium text-zinc-100">{formatBRLCompact(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function CashFlowChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Fluxo de Caixa</CardTitle>
          <span className="text-[10px] text-muted-foreground">Barras = E/S | Linha = Saldo</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.axis }} axisLine={{ stroke: C.border }} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: C.axis }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBRLCompact(v)} width={65} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
              <Bar dataKey="entradas" name="Entradas" fill={C.green} fillOpacity={0.7} radius={[3, 3, 0, 0]} barSize={12} />
              <Bar dataKey="saidas" name="Saidas" fill={C.red} fillOpacity={0.5} radius={[3, 3, 0, 0]} barSize={12} />
              <Line type="monotone" dataKey="saldo" name="Saldo Acumulado" stroke={C.blue} strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-5 mt-3">
          <Leg color={C.green} label="Entradas" />
          <Leg color={C.red} label="Saidas" />
          <Leg color={C.blue} label="Saldo" type="line" />
        </div>
      </CardContent>
    </Card>
  )
}

function Leg({ color, label, type = "bar" }: { color: string; label: string; type?: "bar" | "line" }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      {type === "line" ? (
        <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
      ) : (
        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
      )}
      {label}
    </div>
  )
}
