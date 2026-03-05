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
import { cn } from "@/lib/utils"
import {
  Plus,
  Users,
  AlertTriangle,
  CalendarClock,
  TrendingDown,
  Search,
  Filter,
} from "lucide-react"

interface Client {
  id: string
  name: string
  email: string
  segment: string
}

interface Contract {
  id: string
  clientId: string
  clientName: string
  planName: string
  mrr: number
  startDate: string
  endDate: string | null
  renewalDate: string | null
  status: "active" | "churned" | "paused" | "pending"
  churnRisk: "low" | "medium" | "high"
}

// Demo data — will be replaced with Supabase queries
const DEMO_CONTRACTS: Contract[] = [
  { id: "1", clientId: "c1", clientName: "TechCorp Ltda", planName: "Enterprise", mrr: 4500, startDate: "2025-08-01", endDate: "2026-08-01", renewalDate: "2026-07-01", status: "active", churnRisk: "low" },
  { id: "2", clientId: "c2", clientName: "StartupX", planName: "Pro", mrr: 1200, startDate: "2025-10-15", endDate: "2026-10-15", renewalDate: "2026-09-15", status: "active", churnRisk: "medium" },
  { id: "3", clientId: "c3", clientName: "MegaStore SA", planName: "Enterprise", mrr: 8000, startDate: "2025-11-01", endDate: "2026-11-01", renewalDate: "2026-10-01", status: "active", churnRisk: "low" },
  { id: "4", clientId: "c4", clientName: "Fintech ABC", planName: "Pro", mrr: 1800, startDate: "2025-09-01", endDate: "2026-03-01", renewalDate: "2026-02-01", status: "active", churnRisk: "high" },
  { id: "5", clientId: "c5", clientName: "AgriTech", planName: "Starter", mrr: 500, startDate: "2026-01-01", endDate: null, renewalDate: null, status: "active", churnRisk: "low" },
  { id: "6", clientId: "c6", clientName: "EduPlatform", planName: "Pro", mrr: 1500, startDate: "2025-07-01", endDate: "2025-12-31", renewalDate: null, status: "churned", churnRisk: "high" },
  { id: "7", clientId: "c7", clientName: "HealthCo", planName: "Enterprise", mrr: 6000, startDate: "2025-12-01", endDate: "2026-12-01", renewalDate: "2026-11-01", status: "active", churnRisk: "medium" },
  { id: "8", clientId: "c8", clientName: "LogiTrans", planName: "Starter", mrr: 800, startDate: "2026-02-01", endDate: null, renewalDate: null, status: "pending", churnRisk: "low" },
]

const statusConfig: Record<string, { label: string; class: string }> = {
  active: { label: "Ativo", class: "bg-receita/20 text-receita" },
  churned: { label: "Churned", class: "bg-despesa/20 text-despesa" },
  paused: { label: "Pausado", class: "bg-amber-500/20 text-amber-500" },
  pending: { label: "Pendente", class: "bg-blue-500/20 text-blue-400" },
}

const riskConfig: Record<string, { label: string; class: string }> = {
  low: { label: "Baixo", class: "bg-receita/20 text-receita" },
  medium: { label: "Medio", class: "bg-amber-500/20 text-amber-500" },
  high: { label: "Alto", class: "bg-despesa/20 text-despesa" },
}

export default function ContratosPage() {
  const [contracts, setContracts] = useState<Contract[]>(DEMO_CONTRACTS)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [showNewDialog, setShowNewDialog] = useState(false)

  // New contract form
  const [newContract, setNewContract] = useState({
    clientName: "",
    planName: "Pro",
    mrr: "",
    startDate: "",
    endDate: "",
    renewalDate: "",
  })

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      const matchSearch = c.clientName.toLowerCase().includes(search.toLowerCase()) ||
        c.planName.toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === "all" || c.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [contracts, search, filterStatus])

  const activeContracts = contracts.filter((c) => c.status === "active")
  const totalMRR = activeContracts.reduce((sum, c) => sum + c.mrr, 0)
  const avgMRR = activeContracts.length > 0 ? totalMRR / activeContracts.length : 0
  const churnedCount = contracts.filter((c) => c.status === "churned").length
  const churnRate = contracts.length > 0 ? churnedCount / contracts.length : 0

  // Renewals in next 30 days
  const today = new Date()
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  const upcomingRenewals = contracts.filter((c) => {
    if (!c.renewalDate || c.status !== "active") return false
    const rd = new Date(c.renewalDate)
    return rd >= today && rd <= in30Days
  })

  const highRiskContracts = activeContracts.filter((c) => c.churnRisk === "high")

  const handleAddContract = () => {
    const id = `new-${Date.now()}`
    setContracts((prev) => [
      ...prev,
      {
        id,
        clientId: id,
        clientName: newContract.clientName,
        planName: newContract.planName,
        mrr: parseFloat(newContract.mrr) || 0,
        startDate: newContract.startDate,
        endDate: newContract.endDate || null,
        renewalDate: newContract.renewalDate || null,
        status: "active",
        churnRisk: "low",
      },
    ])
    setNewContract({ clientName: "", planName: "Pro", mrr: "", startDate: "", endDate: "", renewalDate: "" })
    setShowNewDialog(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Contratos & Receita Recorrente</h2>
          <p className="text-sm text-muted-foreground">
            Gestao de clientes, MRR e renovacoes
          </p>
        </div>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Novo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Contrato</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Cliente</Label>
                <Input
                  value={newContract.clientName}
                  onChange={(e) => setNewContract((p) => ({ ...p, clientName: e.target.value }))}
                  placeholder="Nome do cliente"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Plano</Label>
                  <Select value={newContract.planName} onValueChange={(v) => setNewContract((p) => ({ ...p, planName: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Starter">Starter</SelectItem>
                      <SelectItem value="Pro">Pro</SelectItem>
                      <SelectItem value="Enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">MRR (R$)</Label>
                  <Input
                    type="number"
                    value={newContract.mrr}
                    onChange={(e) => setNewContract((p) => ({ ...p, mrr: e.target.value }))}
                    placeholder="1500"
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Inicio</Label>
                  <Input
                    type="date"
                    value={newContract.startDate}
                    onChange={(e) => setNewContract((p) => ({ ...p, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Renovacao</Label>
                  <Input
                    type="date"
                    value={newContract.renewalDate}
                    onChange={(e) => setNewContract((p) => ({ ...p, renewalDate: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={handleAddContract} disabled={!newContract.clientName || !newContract.mrr} className="w-full">
                Adicionar Contrato
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="MRR Total" value={totalMRR} format="currency" />
        <KPICard title="Clientes Ativos" value={activeContracts.length} format="number" />
        <KPICard title="MRR Medio" value={avgMRR} format="currency" />
        <KPICard title="Churn Rate" value={churnRate} format="percentage" />
      </div>

      {/* Alerts */}
      {(upcomingRenewals.length > 0 || highRiskContracts.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {upcomingRenewals.length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber-500" />
                  Renovacoes Proximas (30 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {upcomingRenewals.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span>{c.clientName}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{formatBRL(c.mrr)}</span>
                        <span className="text-xs text-muted-foreground">{c.renewalDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {highRiskContracts.length > 0 && (
            <Card className="border-despesa/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-despesa" />
                  Alto Risco de Churn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {highRiskContracts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span>{c.clientName}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{formatBRL(c.mrr)}</span>
                        <Badge variant="outline" className={riskConfig.high.class + " text-[10px]"}>
                          {riskConfig.high.label}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-1">
                    MRR em risco: {formatBRL(highRiskContracts.reduce((s, c) => s + c.mrr, 0))}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Contracts Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Contratos ({filtered.length})</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="h-8 w-48 pl-8 text-xs"
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                  <SelectItem value="paused">Pausados</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Cliente</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Plano</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">MRR</th>
                  <th className="text-center py-2 text-xs text-muted-foreground font-medium">Status</th>
                  <th className="text-center py-2 text-xs text-muted-foreground font-medium">Risco</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Renovacao</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2.5 text-xs font-medium">{c.clientName}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{c.planName}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-xs font-medium">
                      {formatBRL(c.mrr)}
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge variant="outline" className={cn("text-[10px]", statusConfig[c.status]?.class)}>
                        {statusConfig[c.status]?.label}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-center">
                      <Badge variant="outline" className={cn("text-[10px]", riskConfig[c.churnRisk]?.class)}>
                        {riskConfig[c.churnRisk]?.label}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right text-xs text-muted-foreground">
                      {c.renewalDate ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
