"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhaseBadge } from "@/components/shared/phase-badge"
import { getCurrentPhase } from "@/config/phases"
import { usePeriodStore } from "@/stores/period-store"
import {
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  XCircle,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Bill {
  id: string
  type: "payable" | "receivable"
  description: string
  amount: number
  due_date: string
  status: "pending" | "paid" | "overdue"
  category: string
  supplier?: string
  recurrence?: string
  days_until: number
}

const DEMO_BILLS: Bill[] = [
  {
    id: "1",
    type: "payable",
    description: "Folha de Pagamento",
    amount: 85000,
    due_date: "2026-03-05",
    status: "pending",
    category: "Folha de Pagamento",
    recurrence: "monthly",
    days_until: 0,
  },
  {
    id: "2",
    type: "payable",
    description: "AWS Cloud Services",
    amount: 4800,
    due_date: "2026-03-10",
    status: "pending",
    category: "Infraestrutura Cloud",
    supplier: "Amazon Web Services",
    recurrence: "monthly",
    days_until: 5,
  },
  {
    id: "3",
    type: "payable",
    description: "Aluguel Coworking",
    amount: 6500,
    due_date: "2026-03-15",
    status: "pending",
    category: "Aluguel e Coworking",
    supplier: "WeWork",
    recurrence: "monthly",
    days_until: 10,
  },
  {
    id: "4",
    type: "payable",
    description: "Google Workspace",
    amount: 890,
    due_date: "2026-03-08",
    status: "pending",
    category: "Ferramentas SaaS",
    supplier: "Google",
    recurrence: "monthly",
    days_until: 3,
  },
  {
    id: "5",
    type: "payable",
    description: "Assessoria Contábil",
    amount: 3200,
    due_date: "2026-02-28",
    status: "overdue",
    category: "Servicos Contabeis",
    supplier: "Contabilizei",
    recurrence: "monthly",
    days_until: -5,
  },
  {
    id: "6",
    type: "payable",
    description: "Campanha Meta Ads",
    amount: 12000,
    due_date: "2026-02-25",
    status: "paid",
    category: "Marketing Digital",
    supplier: "Meta",
    days_until: -8,
  },
  {
    id: "7",
    type: "receivable",
    description: "Mensalidade Cliente Alpha",
    amount: 15000,
    due_date: "2026-03-10",
    status: "pending",
    category: "Receita SaaS",
    days_until: 5,
  },
  {
    id: "8",
    type: "receivable",
    description: "Mensalidade Cliente Beta",
    amount: 8500,
    due_date: "2026-03-10",
    status: "pending",
    category: "Receita SaaS",
    days_until: 5,
  },
  {
    id: "9",
    type: "receivable",
    description: "Consultoria Projeto Delta",
    amount: 22000,
    due_date: "2026-03-20",
    status: "pending",
    category: "Receita Consultoria",
    days_until: 15,
  },
  {
    id: "10",
    type: "payable",
    description: "Cartão Corporativo Itaú",
    amount: 7200,
    due_date: "2026-03-12",
    status: "pending",
    category: "Diversos",
    days_until: 7,
  },
]

type FilterStatus = "all" | "pending" | "paid" | "overdue"
type FilterType = "all" | "payable" | "receivable"

export default function ContasPagarPage() {
  const currentPhase = getCurrentPhase()
  const [bills, setBills] = useState<Bill[]>(DEMO_BILLS)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all")
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [dialogOpen, setDialogOpen] = useState(false)

  const filtered = useMemo(() => {
    return bills.filter((b) => {
      if (filterStatus !== "all" && b.status !== filterStatus) return false
      if (filterType !== "all" && b.type !== filterType) return false
      if (searchTerm && !b.description.toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
  }, [bills, filterStatus, filterType, searchTerm])

  const totalPayable = bills.filter((b) => b.type === "payable" && b.status === "pending").reduce((s, b) => s + b.amount, 0)
  const totalReceivable = bills.filter((b) => b.type === "receivable" && b.status === "pending").reduce((s, b) => s + b.amount, 0)
  const overdueCount = bills.filter((b) => b.status === "overdue").length
  const overdueTotal = bills.filter((b) => b.status === "overdue").reduce((s, b) => s + b.amount, 0)
  const dueIn3Days = bills.filter((b) => b.status === "pending" && b.days_until >= 0 && b.days_until <= 3)

  const handleMarkPaid = (id: string) => {
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, status: "paid" as const } : b)))
  }

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas a Pagar & Receber</h1>
          <p className="text-muted-foreground text-sm">
            Gestão de contas, vencimentos e conciliação automática
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PhaseBadge phase={currentPhase} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Conta</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select defaultValue="payable">
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payable">A Pagar</SelectItem>
                        <SelectItem value="receivable">A Receber</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Categoria</Label>
                    <Select defaultValue="other">
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="folha">Folha de Pagamento</SelectItem>
                        <SelectItem value="infra">Infraestrutura</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="saas">Ferramentas SaaS</SelectItem>
                        <SelectItem value="other">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Input placeholder="Descrição da conta" className="h-8 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input type="number" placeholder="0,00" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Vencimento</Label>
                    <Input type="date" className="h-8 text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Recorrência</Label>
                  <Select defaultValue="none">
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Avulsa</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => setDialogOpen(false)}
                >
                  Adicionar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">A Pagar (Pendente)</p>
                <p className="text-xl font-bold text-red-400">R$ {fmt(totalPayable)}</p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">A Receber (Pendente)</p>
                <p className="text-xl font-bold text-emerald-400">R$ {fmt(totalReceivable)}</p>
              </div>
              <ArrowDownRight className="h-5 w-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Em Atraso</p>
                <p className="text-xl font-bold text-amber-400">
                  {overdueCount} ({fmt(overdueTotal)})
                </p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Saldo Líquido</p>
                <p className={`text-xl font-bold ${totalReceivable - totalPayable >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  R$ {fmt(totalReceivable - totalPayable)}
                </p>
              </div>
              <Receipt className="h-5 w-5 text-chart-1" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Urgent alerts */}
      {(overdueCount > 0 || dueIn3Days.length > 0) && (
        <div className="space-y-2">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-2">
              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span className="text-xs text-red-400">
                {overdueCount} conta(s) em atraso totalizando R$ {fmt(overdueTotal)}
              </span>
            </div>
          )}
          {dueIn3Days.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2">
              <Clock className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-xs text-amber-400">
                {dueIn3Days.length} conta(s) vencem nos próximos 3 dias: {dueIn3Days.map((b) => b.description).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
          <SelectTrigger className="h-8 text-xs w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="payable">A Pagar</SelectItem>
            <SelectItem value="receivable">A Receber</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
          <SelectTrigger className="h-8 text-xs w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Paga</SelectItem>
            <SelectItem value="overdue">Em Atraso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Categoria</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Valor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimento</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bill) => (
                  <tr key={bill.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3">
                      {bill.type === "payable" ? (
                        <span className="flex items-center gap-1 text-red-400">
                          <ArrowUpRight className="h-3 w-3" /> Pagar
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <ArrowDownRight className="h-3 w-3" /> Receber
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium">{bill.description}</span>
                        {bill.supplier && (
                          <span className="text-muted-foreground ml-1">({bill.supplier})</span>
                        )}
                        {bill.recurrence && (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 bg-chart-1/10 text-chart-1 rounded">
                            {bill.recurrence}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{bill.category}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      R$ {fmt(bill.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {new Date(bill.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        {bill.days_until >= 0 && bill.status === "pending" && (
                          <span
                            className={`ml-1 text-[10px] ${
                              bill.days_until <= 1
                                ? "text-red-400"
                                : bill.days_until <= 3
                                  ? "text-amber-400"
                                  : "text-muted-foreground"
                            }`}
                          >
                            ({bill.days_until}d)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={bill.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {bill.status === "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-emerald-400 hover:text-emerald-300"
                          onClick={() => handleMarkPaid(bill.id)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Pagar
                        </Button>
                      )}
                      {bill.status === "overdue" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] text-amber-400 hover:text-amber-300"
                          onClick={() => handleMarkPaid(bill.id)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Baixar
                        </Button>
                      )}
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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "Pendente", className: "bg-amber-500/20 text-amber-400" },
    paid: { label: "Paga", className: "bg-emerald-500/20 text-emerald-400" },
    overdue: { label: "Em Atraso", className: "bg-red-500/20 text-red-400" },
  }
  const c = config[status] ?? config.pending
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${c.className}`}>{c.label}</span>
}
