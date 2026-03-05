"use client"

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MONTHLY_DATA, type MonthlyData } from "@/config/seed-data"

const C = { green: "#4ade80", blue: "#60a5fa", purple: "#a78bfa" }

interface MarginsChartProps { monthlyData?: MonthlyData[] }

function buildRadarData(source: MonthlyData[]) {
  const dreMonths = source.filter((d) => d.receita !== null && (d.receita ?? 0) > 0)
  const latest = dreMonths[dreMonths.length - 1]
  const prev = dreMonths.length > 1 ? dreMonths[dreMonths.length - 2] : null

  return {
    latest,
    prev,
    radarData: [
      { metric: "M. Bruta", atual: Math.max(0, (latest?.margemBruta ?? 0) * 100), anterior: Math.max(0, (prev?.margemBruta ?? 0) * 100), fullMark: 100 },
      { metric: "M. EBITDA", atual: Math.max(0, (latest?.margemEbitda ?? 0) * 100), anterior: Math.max(0, (prev?.margemEbitda ?? 0) * 100), fullMark: 100 },
      { metric: "Eficiencia", atual: latest && latest.receita ? Math.min(100, ((latest.receita - (latest.custosFixos ?? 0)) / latest.receita) * 100) : 0, anterior: prev && prev.receita ? Math.min(100, ((prev.receita - (prev.custosFixos ?? 0)) / prev.receita) * 100) : 0, fullMark: 100 },
      { metric: "Crescimento", atual: prev && prev.receita && latest?.receita ? Math.min(100, ((latest.receita - prev.receita) / Math.max(prev.receita, 1)) * 100) : 0, anterior: 0, fullMark: 100 },
      { metric: "Cobertura", atual: latest && latest.receita ? Math.min(100, (latest.receita / Math.max((latest.custosFixos ?? 0) + (latest.despesasVariaveis ?? 0), 1)) * 100) : 0, anterior: prev && prev.receita ? Math.min(100, (prev.receita / Math.max((prev.custosFixos ?? 0) + (prev.despesasVariaveis ?? 0), 1)) * 100) : 0, fullMark: 100 },
    ],
  }
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const data = payload[0]?.payload
  if (!data) return null
  return (
    <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700/50 rounded-lg px-3 py-2.5 shadow-2xl">
      <p className="text-[11px] font-medium text-zinc-200 mb-1">{data.metric}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-[11px]">
          <span className="text-zinc-400">{p.name}</span>
          <span className="font-mono tabular-nums font-medium text-zinc-100">{p.value?.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

export function MarginsChart({ monthlyData }: MarginsChartProps) {
  const { latest, prev, radarData } = buildRadarData(monthlyData ?? MONTHLY_DATA)
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Saude Financeira</CardTitle>
          <span className="text-[10px] text-muted-foreground">{latest?.month ?? "—"} vs {prev?.month ?? "—"}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Radar name="Anterior" dataKey="anterior" stroke={C.blue} fill={C.blue} fillOpacity={0.15} strokeWidth={1.5} strokeDasharray="4 3" />
              <Radar name="Atual" dataKey="atual" stroke={C.green} fill={C.green} fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-5 mt-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: C.green }} />Atual ({latest?.month})
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <div className="w-3 h-0.5 rounded border-dashed" style={{ backgroundColor: C.blue }} />Anterior ({prev?.month})
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
