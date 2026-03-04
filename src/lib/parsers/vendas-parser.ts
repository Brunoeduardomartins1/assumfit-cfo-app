import type * as XLSX from "xlsx"
import type { ParsedVendas, VendasRow } from "@/types/spreadsheet"
import { getRange, getCellString, getCellNumber, getCellRaw, serialDateToMonthKey, serialDateToLabel } from "./xlsx-utils"

export function parseVendas(ws: XLSX.WorkSheet, product: string): ParsedVendas {
  const { rows: totalRows, cols: totalCols } = getRange(ws)

  // Parse column headers from rows 0-1
  // Row 0 has group headers (Top, Install, etc.) and row 1 has detail headers
  const headers: string[] = []
  for (let c = 0; c < totalCols; c++) {
    const h0 = getCellString(ws, 0, c)
    const h1 = getCellString(ws, 1, c)
    headers.push(h1 || h0 || `Col${c}`)
  }

  // Parse data rows
  const rows: VendasRow[] = []
  const months: string[] = []

  for (let r = 2; r < totalRows; r++) {
    const raw = getCellRaw(ws, r, 0)
    if (raw === undefined || raw === null) continue

    // First column is month (Excel serial date)
    let monthKey: string
    let monthLabel: string
    if (typeof raw === "number") {
      monthKey = serialDateToMonthKey(raw)
      monthLabel = serialDateToLabel(raw)
    } else {
      const str = String(raw).trim()
      if (!str) continue
      monthKey = str
      monthLabel = str
    }

    if (!months.includes(monthKey)) {
      months.push(monthKey)
    }

    // Parse all column values
    const values: Record<string, number | null> = {}
    for (let c = 1; c < totalCols; c++) {
      const headerKey = headers[c]
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
      values[headerKey] = getCellNumber(ws, r, c)
    }

    rows.push({
      id: `${product}_${monthKey}_r${r}`,
      month: monthKey,
      monthLabel,
      values,
    })
  }

  return { product, headers, rows, months }
}

export function parseVendasInfluencia(ws: XLSX.WorkSheet): ParsedVendas {
  const { rows: totalRows, cols: totalCols } = getRange(ws)

  // This sheet has premissas at the top, then funnel data
  // Row 0: "Premissa" | "Valor", then data rows
  const headers: string[] = []
  const rows: VendasRow[] = []
  const months: string[] = []

  // First collect all column headers
  for (let c = 0; c < totalCols; c++) {
    const h = getCellString(ws, 0, c)
    headers.push(h || `Col${c}`)
  }

  // Parse all data rows
  for (let r = 1; r < totalRows; r++) {
    const label = getCellString(ws, r, 0)
    if (!label) continue

    const values: Record<string, number | null> = {}
    for (let c = 1; c < totalCols; c++) {
      values[`col_${c}`] = getCellNumber(ws, r, c)
    }

    rows.push({
      id: `influencia_r${r}`,
      month: "",
      monthLabel: label,
      values,
    })
  }

  return { product: "influencia", headers, rows, months }
}
