"use client"

import { useState, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { KPICard } from "@/components/charts/kpi-card"
import { formatBRL, formatBRLCompact } from "@/lib/formatters/currency"
import { usePeriodStore } from "@/stores/period-store"
import { filterByPeriod, formatPeriodLabel } from "@/lib/period-utils"
import { cn } from "@/lib/utils"
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Search,
  Link2,
  AlertTriangle,
} from "lucide-react"

interface Invoice {
  id: string
  type: "emitida" | "recebida"
  number: string
  issuerName: string
  issuerCnpj: string
  recipientName: string
  issueDate: string
  totalValue: number
  taxValue: number
  description: string
  reconciled: boolean
  transactionId: string | null
}

const DEMO_INVOICES: Invoice[] = [
  { id: "nf1", type: "emitida", number: "000123", issuerName: "MUVX Ltda", issuerCnpj: "12.345.678/0001-90", recipientName: "TechCorp Ltda", issueDate: "2026-01-15", totalValue: 4500, taxValue: 675, description: "Licenca SaaS Jan/26", reconciled: true, transactionId: "t1" },
  { id: "nf2", type: "emitida", number: "000124", issuerName: "MUVX Ltda", issuerCnpj: "12.345.678/0001-90", recipientName: "MegaStore SA", issueDate: "2026-01-20", totalValue: 8000, taxValue: 1200, description: "Licenca Enterprise Jan/26", reconciled: true, transactionId: "t2" },
  { id: "nf3", type: "emitida", number: "000125", issuerName: "MUVX Ltda", issuerCnpj: "12.345.678/0001-90", recipientName: "StartupX", issueDate: "2026-02-05", totalValue: 1200, taxValue: 180, description: "Licenca Pro Fev/26", reconciled: false, transactionId: null },
  { id: "nf4", type: "recebida", number: "789456", issuerName: "AWS", issuerCnpj: "", recipientName: "MUVX Ltda", issueDate: "2026-01-31", totalValue: 8500, taxValue: 0, description: "Cloud Services Jan/26", reconciled: true, transactionId: "t3" },
  { id: "nf5", type: "recebida", number: "654321", issuerName: "Contabilidade XYZ", issuerCnpj: "98.765.432/0001-10", recipientName: "MUVX Ltda", issueDate: "2026-02-01", totalValue: 3500, taxValue: 0, description: "Servicos Contabeis Fev/26", reconciled: false, transactionId: null },
  { id: "nf6", type: "emitida", number: "000126", issuerName: "MUVX Ltda", issuerCnpj: "12.345.678/0001-90", recipientName: "HealthCo", issueDate: "2026-02-10", totalValue: 6000, taxValue: 900, description: "Licenca Enterprise Fev/26", reconciled: true, transactionId: "t4" },
  { id: "nf7", type: "recebida", number: "111222", issuerName: "HubSpot", issuerCnpj: "", recipientName: "MUVX Ltda", issueDate: "2026-02-15", totalValue: 4800, taxValue: 0, description: "Marketing Platform Fev/26", reconciled: false, transactionId: null },
  { id: "nf8", type: "emitida", number: "000127", issuerName: "MUVX Ltda", issuerCnpj: "12.345.678/0001-90", recipientName: "Fintech ABC", issueDate: "2026-02-28", totalValue: 1800, taxValue: 270, description: "Licenca Pro Fev/26", reconciled: false, transactionId: null },
]

export default function NotasFiscaisPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(DEMO_INVOICES)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"all" | "emitida" | "recebida">("all")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const periodRange = usePeriodStore((s) => s.getDateRange)()
  const periodLabel = formatPeriodLabel(periodRange)

  const filteredByPeriod = filterByPeriod(invoices, periodRange, (nf) => nf.issueDate)

  const filtered = useMemo(() => {
    return filteredByPeriod.filter((nf) => {
      const matchSearch = nf.issuerName.toLowerCase().includes(search.toLowerCase()) ||
        nf.recipientName.toLowerCase().includes(search.toLowerCase()) ||
        nf.number.includes(search)
      const matchType = filterType === "all" || nf.type === filterType
      return matchSearch && matchType
    })
  }, [filteredByPeriod, search, filterType])

  const emitidas = filteredByPeriod.filter((nf) => nf.type === "emitida")
  const recebidas = filteredByPeriod.filter((nf) => nf.type === "recebida")
  const totalEmitido = emitidas.reduce((s, nf) => s + nf.totalValue, 0)
  const totalRecebido = recebidas.reduce((s, nf) => s + nf.totalValue, 0)
  const totalImpostos = filteredByPeriod.reduce((s, nf) => s + nf.taxValue, 0)
  const reconciledCount = filteredByPeriod.filter((nf) => nf.reconciled).length
  const unreconciledCount = filteredByPeriod.length - reconciledCount
  const reconRate = filteredByPeriod.length > 0 ? reconciledCount / filteredByPeriod.length : 0

  const handleXMLImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    // Placeholder: parse XML files
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const reader = new FileReader()
      reader.onload = () => {
        // In production: parse XML and extract NF data
        const newInvoice: Invoice = {
          id: `import-${Date.now()}-${i}`,
          type: "recebida",
          number: `IMP-${Date.now()}`,
          issuerName: file.name.replace(".xml", ""),
          issuerCnpj: "",
          recipientName: "MUVX Ltda",
          issueDate: new Date().toISOString().slice(0, 10),
          totalValue: 0,
          taxValue: 0,
          description: `Importado de ${file.name}`,
          reconciled: false,
          transactionId: null,
        }
        setInvoices((prev) => [...prev, newInvoice])
      }
      reader.readAsText(file)
    }
    e.target.value = ""
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Notas Fiscais</h2>
          <p className="text-sm text-muted-foreground">
            Import de NFs e reconciliacao — {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button size="sm" onClick={handleXMLImport}>
            <Upload className="h-4 w-4 mr-1" />
            Importar XML
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="NFs Emitidas" value={totalEmitido} format="currency" />
        <KPICard title="NFs Recebidas" value={totalRecebido} format="currency" />
        <KPICard title="Impostos" value={totalImpostos} format="currency" />
        <KPICard title="Reconciliacao" value={reconRate} format="percentage" />
      </div>

      {/* Reconciliation Alert */}
      {unreconciledCount > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {unreconciledCount} nota{unreconciledCount > 1 ? "s" : ""} nao reconciliada{unreconciledCount > 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredByPeriod.filter((nf) => !nf.reconciled).map((nf) => (
                <div key={nf.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[10px]", nf.type === "emitida" ? "bg-receita/20 text-receita" : "bg-despesa/20 text-despesa")}>
                      {nf.type === "emitida" ? "Emitida" : "Recebida"}
                    </Badge>
                    <span className="text-xs">{nf.type === "emitida" ? nf.recipientName : nf.issuerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{formatBRL(nf.totalValue)}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]">
                      <Link2 className="h-3 w-3 mr-1" />
                      Reconciliar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoices Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Notas Fiscais ({filtered.length})</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="h-8 w-48 pl-8 text-xs" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="flex gap-1">
                {(["all", "emitida", "recebida"] as const).map((t) => (
                  <Button
                    key={t}
                    variant={filterType === t ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setFilterType(t)}
                  >
                    {t === "all" ? "Todas" : t === "emitida" ? "Emitidas" : "Recebidas"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Numero</th>
                  <th className="text-center py-2 text-xs text-muted-foreground font-medium">Tipo</th>
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Emitente / Destinatario</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Data</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Valor</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Impostos</th>
                  <th className="text-center py-2 text-xs text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((nf) => (
                  <tr key={nf.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2.5 text-xs font-mono">{nf.number}</td>
                    <td className="py-2.5 text-center">
                      <Badge variant="outline" className={cn("text-[10px]", nf.type === "emitida" ? "bg-receita/20 text-receita" : "bg-chart-1/20 text-chart-1")}>
                        {nf.type === "emitida" ? "Emitida" : "Recebida"}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-xs">
                      {nf.type === "emitida" ? nf.recipientName : nf.issuerName}
                    </td>
                    <td className="py-2.5 text-right text-xs text-muted-foreground">{nf.issueDate}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-xs font-medium">{formatBRL(nf.totalValue)}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-xs text-muted-foreground">{nf.taxValue > 0 ? formatBRL(nf.taxValue) : "—"}</td>
                    <td className="py-2.5 text-center">
                      {nf.reconciled ? (
                        <CheckCircle className="h-4 w-4 text-receita inline" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground inline" />
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
