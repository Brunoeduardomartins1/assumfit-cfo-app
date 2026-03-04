import type * as XLSX from "xlsx"
import type { ParsedDRE, DRERow } from "@/types/spreadsheet"
import { getRange, getCellString, getCellNumber, getCellRaw, serialDateToMonthKey } from "./xlsx-utils"

// Define format types for each DRE row
const DRE_ROW_CONFIG: Record<string, { isCalculated: boolean; formatType: DRERow["formatType"] }> = {
  "Receita Operacional": { isCalculated: false, formatType: "currency" },
  "COGS": { isCalculated: false, formatType: "currency" },
  "Resultado Bruto": { isCalculated: true, formatType: "currency" },
  "Custos Fixos": { isCalculated: false, formatType: "currency" },
  "Despesas Variáveis": { isCalculated: false, formatType: "currency" },
  "Resultado Operacional": { isCalculated: true, formatType: "currency" },
  "Depreciação": { isCalculated: false, formatType: "currency" },
  "Amortização": { isCalculated: false, formatType: "currency" },
  "EBITDA": { isCalculated: true, formatType: "currency" },
  "Margem Bruta": { isCalculated: true, formatType: "percentage" },
  "Margem Operacional": { isCalculated: true, formatType: "percentage" },
  "Margem EBITDA": { isCalculated: true, formatType: "percentage" },
  "Burn Rate (Operacional)": { isCalculated: true, formatType: "currency" },
  "Runway (Médio)": { isCalculated: true, formatType: "number" },
  "Runway (Mensal)": { isCalculated: true, formatType: "number" },
  "Tx Crescimento": { isCalculated: true, formatType: "percentage" },
}

export function parseDRE(ws: XLSX.WorkSheet): ParsedDRE {
  const { rows: totalRows, cols: totalCols } = getRange(ws)

  // Parse phase headers (row 0)
  const phases: ParsedDRE["phases"] = []
  const merges = ws["!merges"] || []
  for (const merge of merges) {
    if (merge.s.r === 0) {
      const label = getCellString(ws, 0, merge.s.c)
      if (label) {
        phases.push({ label, startCol: merge.s.c, endCol: merge.e.c })
      }
    }
  }

  // Parse month headers (row 1)
  const headers: string[] = []
  const monthKeys: string[] = []
  for (let c = 1; c < totalCols; c++) {
    const raw = getCellString(ws, 1, c)
    if (raw) {
      headers.push(raw)
      // Convert "Jan/26" -> "2026-01"
      const match = raw.match(/^(\w+)\/(\d{2})$/)
      if (match) {
        const monthMap: Record<string, string> = {
          Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
          Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
        }
        const m = monthMap[match[1]] || "01"
        monthKeys.push(`20${match[2]}-${m}`)
      }
    }
  }

  // Parse data rows (row 2 onwards)
  const rows: DRERow[] = []
  for (let r = 2; r < totalRows; r++) {
    const category = getCellString(ws, r, 0)
    if (!category) continue

    const config = DRE_ROW_CONFIG[category] || { isCalculated: false, formatType: "currency" as const }

    const values: Record<string, number | null> = {}
    for (let c = 1; c < totalCols; c++) {
      if (c - 1 < monthKeys.length) {
        const val = getCellNumber(ws, r, c)
        // Handle "N/A" strings
        const raw = getCellRaw(ws, r, c)
        if (raw === "N/A") {
          values[monthKeys[c - 1]] = null
        } else {
          values[monthKeys[c - 1]] = val
        }
      }
    }

    const slug = category
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")

    rows.push({
      id: `dre_${slug}`,
      category,
      values,
      isCalculated: config.isCalculated,
      formatType: config.formatType,
    })
  }

  return { headers, rows, phases }
}
