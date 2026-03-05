"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { KPICard } from "@/components/charts/kpi-card"
import { formatBRL, formatBRLCompact } from "@/lib/formatters/currency"
import { usePeriodStore } from "@/stores/period-store"
import { formatPeriodLabel } from "@/lib/period-utils"
import { cn } from "@/lib/utils"
import {
  Plus,
  Users,
  AlertTriangle,
  Building2,
  UserPlus,
  UserCheck,
  UserX,
} from "lucide-react"

interface Department {
  id: string
  name: string
  budgetMonthly: number
}

interface HeadcountEntry {
  id: string
  departmentId: string
  roleTitle: string
  plannedStart: string
  actualStart: string | null
  monthlyCost: number
  status: "planned" | "hired" | "cancelled"
  employeeName: string | null
}

const DEMO_DEPARTMENTS: Department[] = [
  { id: "d1", name: "Engenharia", budgetMonthly: 120000 },
  { id: "d2", name: "Produto", budgetMonthly: 45000 },
  { id: "d3", name: "Comercial", budgetMonthly: 60000 },
  { id: "d4", name: "Operacoes", budgetMonthly: 35000 },
  { id: "d5", name: "Marketing", budgetMonthly: 25000 },
]

const DEMO_HEADCOUNT: HeadcountEntry[] = [
  { id: "h1", departmentId: "d1", roleTitle: "Senior Frontend Dev", plannedStart: "2026-01", actualStart: "2026-01", monthlyCost: 18000, status: "hired", employeeName: "Carlos Silva" },
  { id: "h2", departmentId: "d1", roleTitle: "Backend Engineer", plannedStart: "2026-02", actualStart: "2026-02", monthlyCost: 16000, status: "hired", employeeName: "Ana Santos" },
  { id: "h3", departmentId: "d1", roleTitle: "DevOps Engineer", plannedStart: "2026-03", actualStart: null, monthlyCost: 17000, status: "planned", employeeName: null },
  { id: "h4", departmentId: "d1", roleTitle: "Mobile Developer", plannedStart: "2026-04", actualStart: null, monthlyCost: 15000, status: "planned", employeeName: null },
  { id: "h5", departmentId: "d2", roleTitle: "Product Manager", plannedStart: "2026-01", actualStart: "2026-01", monthlyCost: 20000, status: "hired", employeeName: "Maria Oliveira" },
  { id: "h6", departmentId: "d2", roleTitle: "UX Designer", plannedStart: "2026-03", actualStart: null, monthlyCost: 12000, status: "planned", employeeName: null },
  { id: "h7", departmentId: "d3", roleTitle: "Account Executive", plannedStart: "2026-02", actualStart: "2026-02", monthlyCost: 14000, status: "hired", employeeName: "Pedro Costa" },
  { id: "h8", departmentId: "d3", roleTitle: "SDR", plannedStart: "2026-03", actualStart: null, monthlyCost: 8000, status: "planned", employeeName: null },
  { id: "h9", departmentId: "d3", roleTitle: "SDR", plannedStart: "2026-05", actualStart: null, monthlyCost: 8000, status: "planned", employeeName: null },
  { id: "h10", departmentId: "d4", roleTitle: "CS Manager", plannedStart: "2026-01", actualStart: "2026-01", monthlyCost: 15000, status: "hired", employeeName: "Julia Lima" },
  { id: "h11", departmentId: "d5", roleTitle: "Growth Marketer", plannedStart: "2026-04", actualStart: null, monthlyCost: 12000, status: "planned", employeeName: null },
  { id: "h12", departmentId: "d1", roleTitle: "QA Engineer", plannedStart: "2026-02", actualStart: null, monthlyCost: 10000, status: "cancelled", employeeName: null },
]

const statusConfig: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  planned: { label: "Planejado", class: "bg-blue-500/20 text-blue-400", icon: UserPlus },
  hired: { label: "Contratado", class: "bg-receita/20 text-receita", icon: UserCheck },
  cancelled: { label: "Cancelado", class: "bg-despesa/20 text-despesa", icon: UserX },
}

export default function HeadcountPage() {
  const [departments] = useState<Department[]>(DEMO_DEPARTMENTS)
  const [headcount, setHeadcount] = useState<HeadcountEntry[]>(DEMO_HEADCOUNT)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const periodRange = usePeriodStore((s) => s.getDateRange)()
  const periodLabel = formatPeriodLabel(periodRange)

  const [newEntry, setNewEntry] = useState({
    departmentId: "d1",
    roleTitle: "",
    plannedStart: "",
    monthlyCost: "",
  })

  const active = headcount.filter((h) => h.status !== "cancelled")
  const hired = active.filter((h) => h.status === "hired")
  const planned = active.filter((h) => h.status === "planned")

  const totalPlannedCost = active.reduce((s, h) => s + h.monthlyCost, 0)
  const totalActualCost = hired.reduce((s, h) => s + h.monthlyCost, 0)
  const totalBudget = departments.reduce((s, d) => s + d.budgetMonthly, 0)
  const budgetUtilization = totalBudget > 0 ? totalActualCost / totalBudget : 0

  // Per-department breakdown
  const deptBreakdown = useMemo(() => {
    return departments.map((dept) => {
      const deptHC = active.filter((h) => h.departmentId === dept.id)
      const deptHired = deptHC.filter((h) => h.status === "hired")
      const deptPlanned = deptHC.filter((h) => h.status === "planned")
      const actualCost = deptHired.reduce((s, h) => s + h.monthlyCost, 0)
      const projectedCost = deptHC.reduce((s, h) => s + h.monthlyCost, 0)
      const overBudget = projectedCost > dept.budgetMonthly

      return {
        ...dept,
        hiredCount: deptHired.length,
        plannedCount: deptPlanned.length,
        totalCount: deptHC.length,
        actualCost,
        projectedCost,
        overBudget,
      }
    })
  }, [departments, active])

  // 12 month projection
  const monthProjection = useMemo(() => {
    const months: { month: string; cost: number; headcount: number }[] = []
    for (let m = 1; m <= 12; m++) {
      const monthKey = `2026-${String(m).padStart(2, "0")}`
      const activeInMonth = active.filter((h) => h.plannedStart <= monthKey)
      months.push({
        month: monthKey,
        cost: activeInMonth.reduce((s, h) => s + h.monthlyCost, 0),
        headcount: activeInMonth.length,
      })
    }
    return months
  }, [active])

  const handleAdd = () => {
    setHeadcount((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        departmentId: newEntry.departmentId,
        roleTitle: newEntry.roleTitle,
        plannedStart: newEntry.plannedStart,
        actualStart: null,
        monthlyCost: parseFloat(newEntry.monthlyCost) || 0,
        status: "planned",
        employeeName: null,
      },
    ])
    setNewEntry({ departmentId: "d1", roleTitle: "", plannedStart: "", monthlyCost: "" })
    setShowNewDialog(false)
  }

  const overBudgetDepts = deptBreakdown.filter((d) => d.overBudget)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Headcount & Orcamento</h2>
          <p className="text-sm text-muted-foreground">
            Contratacao planejada vs realizada — {periodLabel}
          </p>
        </div>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nova Vaga
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Posicao</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Departamento</Label>
                <Select value={newEntry.departmentId} onValueChange={(v) => setNewEntry((p) => ({ ...p, departmentId: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cargo</Label>
                <Input value={newEntry.roleTitle} onChange={(e) => setNewEntry((p) => ({ ...p, roleTitle: e.target.value }))} placeholder="Ex: Backend Engineer" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Inicio Planejado (YYYY-MM)</Label>
                  <Input value={newEntry.plannedStart} onChange={(e) => setNewEntry((p) => ({ ...p, plannedStart: e.target.value }))} placeholder="2026-06" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Custo Mensal (R$)</Label>
                  <Input type="number" className="font-mono" value={newEntry.monthlyCost} onChange={(e) => setNewEntry((p) => ({ ...p, monthlyCost: e.target.value }))} placeholder="15000" />
                </div>
              </div>
              <Button onClick={handleAdd} disabled={!newEntry.roleTitle || !newEntry.plannedStart} className="w-full">Adicionar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Headcount Total" value={active.length} format="number" />
        <KPICard title="Contratados" value={hired.length} format="number" />
        <KPICard title="Folha Atual" value={totalActualCost} format="currency" />
        <KPICard title="Utilizacao Orcamento" value={budgetUtilization} format="percentage" />
      </div>

      {/* Budget alerts */}
      {overBudgetDepts.length > 0 && (
        <Card className="border-despesa/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-despesa" />
              Departamentos acima do orcamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overBudgetDepts.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span>{d.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs">Projetado: {formatBRLCompact(d.projectedCost)}</span>
                    <span className="font-mono text-xs text-muted-foreground">Budget: {formatBRLCompact(d.budgetMonthly)}</span>
                    <Badge variant="outline" className="bg-despesa/20 text-despesa text-[10px]">
                      +{(((d.projectedCost - d.budgetMonthly) / d.budgetMonthly) * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Department Breakdown */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {deptBreakdown.map((dept) => (
          <Card key={dept.id} className={dept.overBudget ? "border-despesa/30" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {dept.name}
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {dept.hiredCount}/{dept.totalCount}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Orcamento</span>
                <span className="font-mono">{formatBRLCompact(dept.budgetMonthly)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Custo Atual</span>
                <span className="font-mono">{formatBRLCompact(dept.actualCost)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Projetado</span>
                <span className={cn("font-mono font-medium", dept.overBudget ? "text-despesa" : "text-receita")}>
                  {formatBRLCompact(dept.projectedCost)}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", dept.overBudget ? "bg-despesa/60" : "bg-receita/60")}
                  style={{ width: `${Math.min(100, (dept.projectedCost / dept.budgetMonthly) * 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 12-Month Projection Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Projecao de Folha 12 Meses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Mes</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Headcount</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Custo Mensal</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">vs Orcamento</th>
                </tr>
              </thead>
              <tbody>
                {monthProjection.map((m) => {
                  const overBudget = m.cost > totalBudget
                  return (
                    <tr key={m.month} className="border-b border-border/50">
                      <td className="py-2 text-xs font-medium">{m.month}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs">{m.headcount}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs">{formatBRLCompact(m.cost)}</td>
                      <td className={cn("py-2 text-right font-mono tabular-nums text-xs", overBudget ? "text-despesa" : "text-receita")}>
                        {overBudget ? "+" : ""}{formatBRLCompact(m.cost - totalBudget)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Full Headcount Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Quadro de Pessoal ({active.length} posicoes ativas)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Cargo</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Departamento</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Nome</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Custo</th>
                  <th className="text-center py-2 text-xs text-muted-foreground font-medium">Inicio Plan.</th>
                  <th className="text-center py-2 text-xs text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {headcount.filter((h) => h.status !== "cancelled").map((h) => {
                  const dept = departments.find((d) => d.id === h.departmentId)
                  const sc = statusConfig[h.status]
                  return (
                    <tr key={h.id} className="border-b border-border/50">
                      <td className="py-2 text-xs font-medium">{h.roleTitle}</td>
                      <td className="py-2 text-xs text-muted-foreground">{dept?.name}</td>
                      <td className="py-2 text-xs">{h.employeeName ?? "—"}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs">{formatBRL(h.monthlyCost)}</td>
                      <td className="py-2 text-center text-xs text-muted-foreground">{h.plannedStart}</td>
                      <td className="py-2 text-center">
                        <Badge variant="outline" className={cn("text-[10px]", sc.class)}>{sc.label}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
