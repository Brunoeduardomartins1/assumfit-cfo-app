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
  Store,
  AlertTriangle,
  CalendarClock,
  Search,
  Filter,
} from "lucide-react"

interface Supplier {
  id: string
  name: string
  cnpj: string
  category: string
  contractValue: number
  paymentFrequency: "monthly" | "quarterly" | "annual" | "one-time"
  startDate: string
  endDate: string | null
  renewalDate: string | null
  status: "active" | "inactive" | "pending"
}

const DEMO_SUPPLIERS: Supplier[] = [
  { id: "s1", name: "AWS", cnpj: "", category: "Infraestrutura", contractValue: 8500, paymentFrequency: "monthly", startDate: "2025-07-01", endDate: "2026-07-01", renewalDate: "2026-06-01", status: "active" },
  { id: "s2", name: "Vercel", cnpj: "", category: "Infraestrutura", contractValue: 1200, paymentFrequency: "monthly", startDate: "2025-08-01", endDate: null, renewalDate: null, status: "active" },
  { id: "s3", name: "Contabilidade XYZ", cnpj: "12.345.678/0001-90", category: "Servicos", contractValue: 3500, paymentFrequency: "monthly", startDate: "2025-07-01", endDate: "2026-07-01", renewalDate: "2026-06-01", status: "active" },
  { id: "s4", name: "Escritorio Advocacia", cnpj: "98.765.432/0001-10", category: "Juridico", contractValue: 5000, paymentFrequency: "monthly", startDate: "2025-09-01", endDate: "2026-03-15", renewalDate: "2026-03-01", status: "active" },
  { id: "s5", name: "HubSpot", cnpj: "", category: "Marketing", contractValue: 4800, paymentFrequency: "monthly", startDate: "2026-01-01", endDate: "2027-01-01", renewalDate: "2026-12-01", status: "active" },
  { id: "s6", name: "Slack", cnpj: "", category: "Ferramentas", contractValue: 800, paymentFrequency: "monthly", startDate: "2025-07-01", endDate: null, renewalDate: null, status: "active" },
  { id: "s7", name: "Notion", cnpj: "", category: "Ferramentas", contractValue: 500, paymentFrequency: "monthly", startDate: "2025-07-01", endDate: null, renewalDate: null, status: "active" },
  { id: "s8", name: "Figma", cnpj: "", category: "Ferramentas", contractValue: 600, paymentFrequency: "monthly", startDate: "2025-08-01", endDate: null, renewalDate: null, status: "active" },
  { id: "s9", name: "Consultor BI", cnpj: "11.222.333/0001-44", category: "Consultoria", contractValue: 15000, paymentFrequency: "one-time", startDate: "2026-02-01", endDate: "2026-04-01", renewalDate: null, status: "active" },
]

const statusLabels: Record<string, { label: string; class: string }> = {
  active: { label: "Ativo", class: "bg-receita/20 text-receita" },
  inactive: { label: "Inativo", class: "bg-muted text-muted-foreground" },
  pending: { label: "Pendente", class: "bg-amber-500/20 text-amber-500" },
}

const freqLabels: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
  "one-time": "Unico",
}

export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(DEMO_SUPPLIERS)
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("all")
  const [showNewDialog, setShowNewDialog] = useState(false)

  const [newSupplier, setNewSupplier] = useState({
    name: "",
    category: "Servicos",
    contractValue: "",
    paymentFrequency: "monthly" as Supplier["paymentFrequency"],
    renewalDate: "",
  })

  const categories = useMemo(() => {
    const cats = new Set(suppliers.map((s) => s.category))
    return Array.from(cats).sort()
  }, [suppliers])

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase())
      const matchCat = filterCategory === "all" || s.category === filterCategory
      return matchSearch && matchCat
    })
  }, [suppliers, search, filterCategory])

  const activeSup = suppliers.filter((s) => s.status === "active")
  const totalMonthly = activeSup
    .filter((s) => s.paymentFrequency === "monthly")
    .reduce((sum, s) => sum + s.contractValue, 0)

  // Concentration analysis
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of activeSup) {
      const monthlyEquiv = s.paymentFrequency === "monthly" ? s.contractValue
        : s.paymentFrequency === "quarterly" ? s.contractValue / 3
        : s.paymentFrequency === "annual" ? s.contractValue / 12
        : 0
      map.set(s.category, (map.get(s.category) ?? 0) + monthlyEquiv)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [activeSup])

  const totalCategorySum = categoryTotals.reduce((s, [, v]) => s + v, 0)

  // Upcoming renewals
  const today = new Date()
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  const in15Days = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

  const upcomingRenewals = activeSup
    .filter((s) => s.renewalDate)
    .map((s) => ({ ...s, renewalDateObj: new Date(s.renewalDate!) }))
    .filter((s) => s.renewalDateObj >= today && s.renewalDateObj <= in30Days)
    .sort((a, b) => a.renewalDateObj.getTime() - b.renewalDateObj.getTime())

  const handleAdd = () => {
    setSuppliers((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: newSupplier.name,
        cnpj: "",
        category: newSupplier.category,
        contractValue: parseFloat(newSupplier.contractValue) || 0,
        paymentFrequency: newSupplier.paymentFrequency,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: null,
        renewalDate: newSupplier.renewalDate || null,
        status: "active",
      },
    ])
    setNewSupplier({ name: "", category: "Servicos", contractValue: "", paymentFrequency: "monthly", renewalDate: "" })
    setShowNewDialog(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Fornecedores & Contratos</h2>
          <p className="text-sm text-muted-foreground">
            Gestao de fornecedores, vencimentos e custos
          </p>
        </div>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Fornecedor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Fornecedor</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={newSupplier.name} onChange={(e) => setNewSupplier((p) => ({ ...p, name: e.target.value }))} placeholder="Nome do fornecedor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <Input value={newSupplier.category} onChange={(e) => setNewSupplier((p) => ({ ...p, category: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input type="number" className="font-mono" value={newSupplier.contractValue} onChange={(e) => setNewSupplier((p) => ({ ...p, contractValue: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Frequencia</Label>
                  <Select value={newSupplier.paymentFrequency} onValueChange={(v: Supplier["paymentFrequency"]) => setNewSupplier((p) => ({ ...p, paymentFrequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="quarterly">Trimestral</SelectItem>
                      <SelectItem value="annual">Anual</SelectItem>
                      <SelectItem value="one-time">Unico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Renovacao</Label>
                  <Input type="date" value={newSupplier.renewalDate} onChange={(e) => setNewSupplier((p) => ({ ...p, renewalDate: e.target.value }))} />
                </div>
              </div>
              <Button onClick={handleAdd} disabled={!newSupplier.name} className="w-full">Adicionar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Fornecedores Ativos" value={activeSup.length} format="number" />
        <KPICard title="Custo Mensal Recorrente" value={totalMonthly} format="currency" />
        <KPICard title="Categorias" value={categories.length} format="number" />
        <KPICard title="Renovacoes em 30d" value={upcomingRenewals.length} format="number" />
      </div>

      {/* Renewal Alerts */}
      {upcomingRenewals.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-500" />
              Alertas de Renovacao
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingRenewals.map((s) => {
                const daysUntil = Math.ceil((s.renewalDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                const urgency = daysUntil <= 7 ? "text-despesa" : daysUntil <= 15 ? "text-amber-500" : "text-muted-foreground"
                return (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span>{s.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs">{formatBRL(s.contractValue)}/mes</span>
                      <Badge variant="outline" className={cn("text-[10px]", urgency)}>
                        {daysUntil} dias
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Concentration */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Concentracao de Custos por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoryTotals.map(([cat, total]) => {
              const pct = totalCategorySum > 0 ? (total / totalCategorySum) * 100 : 0
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{cat}</span>
                    <span className="font-mono tabular-nums text-xs">{formatBRLCompact(total)}/mes ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-chart-1/60 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Fornecedores ({filtered.length})</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="h-8 w-48 pl-8 text-xs" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <Filter className="h-3 w-3 mr-1" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Fornecedor</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Categoria</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Valor</th>
                  <th className="text-center py-2 text-xs text-muted-foreground font-medium">Freq.</th>
                  <th className="text-center py-2 text-xs text-muted-foreground font-medium">Status</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Renovacao</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2.5 text-xs font-medium">{s.name}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{s.category}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-xs">{formatBRL(s.contractValue)}</td>
                    <td className="py-2.5 text-center text-xs text-muted-foreground">{freqLabels[s.paymentFrequency]}</td>
                    <td className="py-2.5 text-center">
                      <Badge variant="outline" className={cn("text-[10px]", statusLabels[s.status]?.class)}>{statusLabels[s.status]?.label}</Badge>
                    </td>
                    <td className="py-2.5 text-right text-xs text-muted-foreground">{s.renewalDate ?? "—"}</td>
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
