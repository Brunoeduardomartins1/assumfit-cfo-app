import type * as XLSX from "xlsx"
import type {
  SpreadsheetRow,
  SpreadsheetMonth,
  PhaseHeader,
  ParsedFluxoCaixa,
  FluxoSection,
} from "@/types/spreadsheet"
import {
  getRange,
  getCellString,
  getCellNumber,
  getCellRaw,
  serialDateToMonthKey,
  serialDateToLabel,
  categoryToId,
} from "./xlsx-utils"

// Group rows and their hierarchy levels - defined by category name
const GROUP_DEFINITIONS: Record<string, { level: number; section: FluxoSection }> = {
  "Entradas Operacionais": { level: 0, section: "entradas" },
  "Receita Recorrente / Transacional": { level: 1, section: "entradas" },
  "Receita Não Recorrente": { level: 1, section: "entradas" },
  "Saídas Operacionais": { level: 0, section: "saidas" },
  "Custos Fixos Operacionais": { level: 1, section: "saidas" },
  "Custos com pessoal": { level: 2, section: "saidas" },
  "Infraestrutura": { level: 2, section: "saidas" },
  "Software + Equipamentos": { level: 2, section: "saidas" },
  "Serviços de terceiros": { level: 2, section: "saidas" },
  "Custos Variáveis Diretos (COGS)": { level: 1, section: "saidas" },
  "Comissões": { level: 2, section: "saidas" },
  "Infraestrutura AWS": { level: 2, section: "saidas" },
  "Despesas Operacionais Variáveis": { level: 1, section: "saidas" },
  "Marketing e Growth": { level: 2, section: "saidas" },
  "Pessoas e Recrutamento": { level: 2, section: "saidas" },
  "Operacional e Geral": { level: 2, section: "saidas" },
  "Eventos": { level: 2, section: "saidas" },
  "Impostos Sobre Faturamento": { level: 1, section: "saidas" },
  "Capital / Empréstimos": { level: 0, section: "capital" },
  "Saídas Financeiras": { level: 0, section: "saidas_financeiras" },
  "Ajustes de Caixa / Reembolsos": { level: 0, section: "ajustes" },
  "Consolidação de Resultados": { level: 0, section: "consolidacao" },
}

// Standalone / calculated rows at level 0
const STANDALONE_ROWS: Record<string, FluxoSection> = {
  "Valuation Estimado (ARR-Based)": "valuation",
  "Geração Caixa Operacional": "geracao_caixa",
}

export function parseFluxoCaixa(ws: XLSX.WorkSheet): ParsedFluxoCaixa {
  const { rows: totalRows, cols: totalCols } = getRange(ws)

  // Parse phase headers (row 0, merged cells)
  const phases: PhaseHeader[] = []
  const merges = ws["!merges"] || []
  for (const merge of merges) {
    if (merge.s.r === 0) {
      const label = getCellString(ws, 0, merge.s.c)
      if (label) {
        phases.push({
          label,
          startCol: merge.s.c,
          endCol: merge.e.c,
        })
      }
    }
  }

  // Parse month columns (row 1)
  const months: SpreadsheetMonth[] = []
  let totalColIndex: number | null = null

  for (let c = 1; c < totalCols; c++) {
    const raw = getCellRaw(ws, 1, c)
    if (raw === undefined || raw === null) continue

    if (typeof raw === "string" && raw.includes("Total")) {
      totalColIndex = c
      continue
    }

    if (typeof raw === "number") {
      months.push({
        key: serialDateToMonthKey(raw),
        label: serialDateToLabel(raw),
        colIndex: c,
        serialDate: raw,
      })
    }
  }

  // Parse data rows (row 2 onwards)
  const parsedRows: SpreadsheetRow[] = []
  const parentStack: { id: string; level: number }[] = []

  for (let r = 2; r < totalRows; r++) {
    const category = getCellString(ws, r, 0)
    if (!category) continue

    const id = categoryToId(category, r)
    const isEstimado = category.includes("- Estimado") || category.includes("Estimado")
    const isRealizado = category.includes("- Realizado") || category.includes("Realizado")

    // Determine level and section
    let level: number
    let section: FluxoSection
    let isGroup: boolean

    if (GROUP_DEFINITIONS[category]) {
      level = GROUP_DEFINITIONS[category].level
      section = GROUP_DEFINITIONS[category].section
      isGroup = true
    } else if (STANDALONE_ROWS[category]) {
      level = 0
      section = STANDALONE_ROWS[category]
      isGroup = false
    } else {
      // Leaf node - level is parent's level + 1
      isGroup = false
      if (parentStack.length > 0) {
        const parent = parentStack[parentStack.length - 1]
        level = parent.level + 1
        section = parsedRows.find((row) => row.id === parent.id)?.section || "saidas"
      } else {
        level = 1
        section = "entradas"
      }
    }

    // Update parent stack
    // Pop parents that are at the same level or deeper
    while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= level) {
      parentStack.pop()
    }

    const parentId = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : null

    if (isGroup) {
      parentStack.push({ id, level })
    }

    // Parse values for each month
    const values: Record<string, number | null> = {}
    for (const month of months) {
      values[month.key] = getCellNumber(ws, r, month.colIndex)
    }
    // Also parse total column if it exists
    if (totalColIndex !== null) {
      values["total_anual"] = getCellNumber(ws, r, totalColIndex)
    }

    parsedRows.push({
      id,
      category,
      level,
      isGroup,
      isEstimado: isEstimado && !isRealizado,
      isRealizado,
      parentId,
      rowIndex: r,
      section,
      values,
    })
  }

  return { rows: parsedRows, months, phases, totalColIndex }
}
