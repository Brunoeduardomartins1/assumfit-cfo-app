import * as XLSX from "xlsx"

/**
 * Convert Excel serial date to month key "YYYY-MM"
 */
export function serialDateToMonthKey(serial: number): string {
  const date = XLSX.SSF.parse_date_code(serial)
  const year = date.y
  const month = String(date.m).padStart(2, "0")
  return `${year}-${month}`
}

/**
 * Convert Excel serial date to display label "Mon-YY"
 */
export function serialDateToLabel(serial: number): string {
  const date = XLSX.SSF.parse_date_code(serial)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const year = String(date.y).slice(-2)
  return `${months[date.m - 1]}-${year}`
}

/**
 * Safely get a cell value as number
 */
export function getCellNumber(ws: XLSX.WorkSheet, row: number, col: number): number | null {
  const addr = XLSX.utils.encode_cell({ r: row, c: col })
  const cell = ws[addr]
  if (!cell) return null
  if (cell.t === "n") return cell.v as number
  if (cell.t === "s") {
    const parsed = parseFloat(String(cell.v).replace(/[^\d.-]/g, ""))
    return isNaN(parsed) ? null : parsed
  }
  return null
}

/**
 * Safely get a cell value as string
 */
export function getCellString(ws: XLSX.WorkSheet, row: number, col: number): string {
  const addr = XLSX.utils.encode_cell({ r: row, c: col })
  const cell = ws[addr]
  if (!cell) return ""
  return String(cell.w || cell.v || "").trim()
}

/**
 * Get the raw cell value (any type)
 */
export function getCellRaw(ws: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row, c: col })
  const cell = ws[addr]
  return cell ? cell.v : undefined
}

/**
 * Get worksheet range
 */
export function getRange(ws: XLSX.WorkSheet): { rows: number; cols: number; range: XLSX.Range } {
  const ref = ws["!ref"] || "A1"
  const range = XLSX.utils.decode_range(ref)
  return {
    rows: range.e.r + 1,
    cols: range.e.c + 1,
    range,
  }
}

/**
 * Generate a unique ID from category name
 */
export function categoryToId(category: string, rowIndex: number): string {
  const slug = category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
  return `${slug}_r${rowIndex}`
}
