export interface SpreadsheetRow {
  id: string
  category: string
  level: number
  isGroup: boolean
  isEstimado: boolean
  isRealizado: boolean
  parentId: string | null
  rowIndex: number
  section: FluxoSection
  values: Record<string, number | null> // monthKey -> value (e.g. "2025-07" -> 1234.56)
}

export type FluxoSection =
  | "valuation"
  | "entradas"
  | "saidas"
  | "geracao_caixa"
  | "capital"
  | "saidas_financeiras"
  | "ajustes"
  | "consolidacao"

export interface SpreadsheetMonth {
  key: string // "2025-07"
  label: string // "Jul-25"
  colIndex: number
  serialDate: number
}

export interface PhaseHeader {
  label: string
  startCol: number
  endCol: number
}

export interface ParsedFluxoCaixa {
  rows: SpreadsheetRow[]
  months: SpreadsheetMonth[]
  phases: PhaseHeader[]
  totalColIndex: number | null
}

export interface ParsedDRE {
  headers: string[]
  rows: DRERow[]
  phases: { label: string; startCol: number; endCol: number }[]
}

export interface DRERow {
  id: string
  category: string
  values: Record<string, number | null>
  isCalculated: boolean
  formatType: "currency" | "percentage" | "months" | "number"
}

export interface ParsedPremissas {
  items: PremissaItem[]
}

export interface PremissaItem {
  id: string
  key: string
  label: string
  value: number | string | null
}

export interface ParsedVendas {
  product: string
  headers: string[]
  rows: VendasRow[]
  months: string[]
}

export interface VendasRow {
  id: string
  month: string
  monthLabel: string
  values: Record<string, number | null>
}

export type SheetTab =
  | "fluxo_caixa"
  | "dre"
  | "premissas"
  | "vendas_core_new"
  | "vendas_digital"
  | "vendas_influencia"
  | "vendas_core"

export interface SheetTabConfig {
  key: SheetTab
  label: string
  excelName: string
}

export const SHEET_TABS: SheetTabConfig[] = [
  { key: "fluxo_caixa", label: "Fluxo de Caixa", excelName: "Fluxo_Caixa_Mensal" },
  { key: "dre", label: "DRE Mensal", excelName: "DRE_Mensal" },
  { key: "premissas", label: "Premissas", excelName: "Premissas" },
  { key: "vendas_core_new", label: "Vendas Core New", excelName: "Proj. Vendas MUVX Core New" },
  { key: "vendas_digital", label: "Vendas Digital", excelName: "Proj. Vendas MUVX Digital" },
  { key: "vendas_influencia", label: "Vendas Influência", excelName: "Proj. Vendas Influencia Faixa" },
  { key: "vendas_core", label: "Vendas Core", excelName: "Proj. Vendas MUVX Core" },
]
