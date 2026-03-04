import type * as XLSX from "xlsx"
import type { ParsedPremissas } from "@/types/spreadsheet"
import { getRange, getCellString, getCellRaw } from "./xlsx-utils"

export function parsePremissas(ws: XLSX.WorkSheet): ParsedPremissas {
  const { rows: totalRows } = getRange(ws)
  const items: ParsedPremissas["items"] = []

  // Skip header row (row 0: "Premissa" | "Valor")
  for (let r = 1; r < totalRows; r++) {
    const label = getCellString(ws, r, 0)
    if (!label) continue

    const rawValue = getCellRaw(ws, r, 1)
    const value = rawValue !== undefined && rawValue !== null ? rawValue : null

    const slug = label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")

    items.push({
      id: `prem_${slug}`,
      key: slug,
      label,
      value: value as number | string | null,
    })
  }

  return { items }
}
