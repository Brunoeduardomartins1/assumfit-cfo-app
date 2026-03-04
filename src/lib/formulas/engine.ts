import type { SpreadsheetRow } from "@/types/spreadsheet"
import { getDirectChildren } from "./hierarchy"

/**
 * Recalculate all group sums bottom-up.
 * When a leaf value changes, recompute parent sums up the tree.
 * Returns a new array with updated values (immutable).
 */
export function recalculateHierarchy(
  rows: SpreadsheetRow[],
  monthKeys: string[]
): SpreadsheetRow[] {
  const updated = rows.map((r) => ({
    ...r,
    values: { ...r.values },
  }))

  const rowMap = new Map(updated.map((r) => [r.id, r]))

  // Process groups bottom-up: sort by level descending so deepest groups compute first
  const groups = updated
    .filter((r) => r.isGroup)
    .sort((a, b) => b.level - a.level)

  for (const group of groups) {
    const children = getDirectChildren(updated, group.id)
    if (children.length === 0) continue

    for (const mk of monthKeys) {
      let sum = 0
      let hasAny = false
      for (const child of children) {
        const val = child.values[mk]
        if (val !== null && val !== undefined) {
          sum += val
          hasAny = true
        }
      }
      group.values[mk] = hasAny ? sum : null
    }

    // Update total_anual too
    if (group.values["total_anual"] !== undefined) {
      let totalSum = 0
      let hasTotal = false
      for (const child of children) {
        const val = child.values["total_anual"]
        if (val !== null && val !== undefined) {
          totalSum += val
          hasTotal = true
        }
      }
      group.values["total_anual"] = hasTotal ? totalSum : null
    }
  }

  return updated
}

/**
 * Update a single cell value and recalculate affected parents.
 * Returns the full updated rows array.
 */
export function updateCellAndRecalculate(
  rows: SpreadsheetRow[],
  rowId: string,
  monthKey: string,
  newValue: number | null,
  allMonthKeys: string[]
): SpreadsheetRow[] {
  // Clone and update the target cell
  const updated = rows.map((r) => ({
    ...r,
    values: { ...r.values },
  }))

  const target = updated.find((r) => r.id === rowId)
  if (!target) return rows

  target.values[monthKey] = newValue

  // Recalculate all group sums (simple approach - could optimize to only walk up the tree)
  return recalculateHierarchy(updated, allMonthKeys)
}

/**
 * Calculate variance between Estimado and Realizado for paired rows
 */
export function calculateVariance(
  rows: SpreadsheetRow[],
  monthKey: string
): { rowId: string; estimado: number; realizado: number; variance: number; variancePercent: number }[] {
  const results: {
    rowId: string
    estimado: number
    realizado: number
    variance: number
    variancePercent: number
  }[] = []

  for (let i = 0; i < rows.length - 1; i++) {
    const row = rows[i]
    const nextRow = rows[i + 1]

    if (row.isEstimado && nextRow.isRealizado) {
      const baseName = row.category.replace(/ - Estimado$/, "")
      const nextBaseName = nextRow.category.replace(/ - Realizado$/, "")

      if (baseName === nextBaseName) {
        const estimado = row.values[monthKey] || 0
        const realizado = nextRow.values[monthKey] || 0
        const variance = realizado - estimado
        const variancePercent = estimado !== 0 ? (variance / Math.abs(estimado)) * 100 : 0

        results.push({
          rowId: row.id,
          estimado,
          realizado,
          variance,
          variancePercent,
        })
      }
    }
  }

  return results
}
