import * as XLSX from "xlsx"
import { parseFluxoCaixa } from "./fluxo-caixa-parser"
import { parseDRE } from "./dre-parser"
import { parsePremissas } from "./premissas-parser"
import { parseVendas, parseVendasInfluencia } from "./vendas-parser"
import type {
  ParsedFluxoCaixa,
  ParsedDRE,
  ParsedPremissas,
  ParsedVendas,
} from "@/types/spreadsheet"

export interface ParsedWorkbook {
  fluxoCaixa: ParsedFluxoCaixa
  dre: ParsedDRE
  premissas: ParsedPremissas
  vendasCoreNew: ParsedVendas
  vendasDigital: ParsedVendas
  vendasInfluencia: ParsedVendas
  vendasCore: ParsedVendas
}

export function parseWorkbook(buffer: ArrayBuffer): ParsedWorkbook {
  const wb = XLSX.read(buffer, { type: "array" })

  const getSheet = (name: string): XLSX.WorkSheet => {
    const ws = wb.Sheets[name]
    if (!ws) throw new Error(`Sheet "${name}" not found in workbook`)
    return ws
  }

  return {
    fluxoCaixa: parseFluxoCaixa(getSheet("Fluxo_Caixa_Mensal")),
    dre: parseDRE(getSheet("DRE_Mensal")),
    premissas: parsePremissas(getSheet("Premissas")),
    vendasCoreNew: parseVendas(getSheet("Proj. Vendas MUVX Core New"), "core_new"),
    vendasDigital: parseVendas(getSheet("Proj. Vendas MUVX Digital"), "digital"),
    vendasInfluencia: parseVendasInfluencia(getSheet("Proj. Vendas Influencia Faixa")),
    vendasCore: parseVendas(getSheet("Proj. Vendas MUVX Core"), "core"),
  }
}

export { parseFluxoCaixa } from "./fluxo-caixa-parser"
export { parseDRE } from "./dre-parser"
export { parsePremissas } from "./premissas-parser"
export { parseVendas, parseVendasInfluencia } from "./vendas-parser"
