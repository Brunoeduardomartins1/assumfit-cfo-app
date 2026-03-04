"use client"

import { useCallback } from "react"
import dynamic from "next/dynamic"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { SpreadsheetToolbar } from "@/components/spreadsheet/spreadsheet-toolbar"

const HotTableWrapper = dynamic(() => import("@/components/spreadsheet/hot-table-wrapper").then(m => m.HotTableWrapper), { ssr: false, loading: () => <div className="flex-1 bg-muted/30 animate-pulse rounded-lg" /> })
const DRETable = dynamic(() => import("@/components/spreadsheet/dre-table").then(m => m.DRETable), { ssr: false })
const PremissasTable = dynamic(() => import("@/components/spreadsheet/premissas-table").then(m => m.PremissasTable), { ssr: false })
const VendasTable = dynamic(() => import("@/components/spreadsheet/vendas-table").then(m => m.VendasTable), { ssr: false })
import { useSpreadsheetStore } from "@/stores/spreadsheet-store"
import { PhaseBadge } from "@/components/shared/phase-badge"
import { getCurrentPhase } from "@/config/phases"
import { SHEET_TABS } from "@/types/spreadsheet"
import { exportFluxoCaixaToXlsx, downloadXlsx } from "@/lib/export/xlsx-exporter"
import { toast } from "sonner"
import "@/components/spreadsheet/handsontable-dark.css"

export default function FluxoCaixaPage() {
  const {
    activeTab,
    setActiveTab,
    fluxoRows,
    fluxoMonths,
    fluxoPhases,
    isLoaded,
    isLoading,
    setLoading,
    importWorkbook,
    vendasCoreNew,
    vendasDigital,
    vendasInfluencia,
    vendasCore,
  } = useSpreadsheetStore()

  const currentPhase = getCurrentPhase()

  const handleImport = useCallback(
    async (file: File) => {
      setLoading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch("/api/import-xlsx", {
          method: "POST",
          body: formData,
        })

        const result = await res.json()

        if (!res.ok) {
          throw new Error(result.error || "Erro ao importar")
        }

        importWorkbook({
          fluxoRows: result.data.fluxoCaixa.rows,
          fluxoMonths: result.data.fluxoCaixa.months,
          fluxoPhases: result.data.fluxoCaixa.phases,
          dre: result.data.dre,
          premissas: result.data.premissas,
          vendasCoreNew: result.data.vendasCoreNew,
          vendasDigital: result.data.vendasDigital,
          vendasInfluencia: result.data.vendasInfluencia,
          vendasCore: result.data.vendasCore,
        })

        toast.success("Planilha importada", {
          description: `${result.stats.fluxoRows} linhas, ${result.stats.fluxoMonths} meses carregados.`,
        })
      } catch (error) {
        toast.error("Erro na importacao", {
          description:
            error instanceof Error ? error.message : "Erro desconhecido",
        })
      } finally {
        setLoading(false)
      }
    },
    [setLoading, importWorkbook]
  )

  const handleExport = useCallback(() => {
    if (!isLoaded) return
    const buffer = exportFluxoCaixaToXlsx(fluxoRows, fluxoMonths, fluxoPhases)
    const date = new Date().toISOString().slice(0, 10)
    downloadXlsx(buffer, `ASSUMFIT_Fluxo_Caixa_${date}.xlsx`)
    toast.success("Arquivo XLSX baixado com sucesso.")
  }, [isLoaded, fluxoRows, fluxoMonths, fluxoPhases])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold">Planilha Financeira</h2>
          <p className="text-xs text-muted-foreground">
            Fluxo de Caixa, DRE, Premissas e Projecoes de Vendas
          </p>
        </div>
        <PhaseBadge phase={currentPhase} />
      </div>

      {/* Toolbar */}
      <SpreadsheetToolbar onImport={handleImport} onExport={handleExport} />

      {/* Loading overlay */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <div className="animate-spin h-5 w-5 border-2 border-muted-foreground border-t-transparent rounded-full mr-2" />
          Processando planilha...
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="mx-4 mt-2 w-fit">
          {SHEET_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="text-xs">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="fluxo_caixa" className="flex-1 overflow-hidden px-4 pb-4">
          <HotTableWrapper />
        </TabsContent>

        <TabsContent value="dre" className="flex-1 overflow-auto px-4 pb-4">
          <DRETable />
        </TabsContent>

        <TabsContent value="premissas" className="flex-1 overflow-auto px-4 pb-4">
          <PremissasTable />
        </TabsContent>

        <TabsContent value="vendas_core_new" className="flex-1 overflow-auto px-4 pb-4">
          <VendasTable data={vendasCoreNew} title="Vendas Core New" />
        </TabsContent>

        <TabsContent value="vendas_digital" className="flex-1 overflow-auto px-4 pb-4">
          <VendasTable data={vendasDigital} title="Vendas Digital" />
        </TabsContent>

        <TabsContent value="vendas_influencia" className="flex-1 overflow-auto px-4 pb-4">
          <VendasTable data={vendasInfluencia} title="Vendas Influencia" />
        </TabsContent>

        <TabsContent value="vendas_core" className="flex-1 overflow-auto px-4 pb-4">
          <VendasTable data={vendasCore} title="Vendas Core" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
