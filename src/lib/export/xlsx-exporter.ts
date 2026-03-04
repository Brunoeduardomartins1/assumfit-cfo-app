import * as XLSX from "xlsx"
import type { SpreadsheetRow, SpreadsheetMonth, PhaseHeader } from "@/types/spreadsheet"

export function exportFluxoCaixaToXlsx(
  rows: SpreadsheetRow[],
  months: SpreadsheetMonth[],
  phases: PhaseHeader[]
): ArrayBuffer {
  const wb = XLSX.utils.book_new()

  // Build 2D array
  const data: (string | number | null)[][] = []

  // Row 0: Phase headers
  const phaseRow: (string | null)[] = [null]
  for (let c = 0; c < months.length; c++) {
    const phase = phases.find((p) => c + 1 >= p.startCol && c + 1 <= p.endCol)
    // Only put label at start of phase range
    if (phase && c + 1 === phase.startCol) {
      phaseRow.push(phase.label)
    } else {
      phaseRow.push(null)
    }
  }
  data.push(phaseRow)

  // Row 1: Month headers
  data.push(["Categoria", ...months.map((m) => m.label)])

  // Data rows
  for (const row of rows) {
    const indent = "  ".repeat(row.level)
    const values = months.map((m) => row.values[m.key] ?? null)
    data.push([`${indent}${row.category}`, ...values])
  }

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Set column widths
  ws["!cols"] = [{ wch: 40 }, ...months.map(() => ({ wch: 15 }))]

  // Merge phase header cells
  const merges: XLSX.Range[] = []
  for (const phase of phases) {
    merges.push({
      s: { r: 0, c: phase.startCol },
      e: { r: 0, c: phase.endCol },
    })
  }
  ws["!merges"] = merges

  // Format numbers as BRL
  for (let r = 2; r < data.length; r++) {
    for (let c = 1; c <= months.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (ws[addr] && ws[addr].t === "n") {
        ws[addr].z = '#,##0.00'
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Fluxo_Caixa_Mensal")

  return XLSX.write(wb, { type: "array", bookType: "xlsx" })
}

export function downloadXlsx(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
