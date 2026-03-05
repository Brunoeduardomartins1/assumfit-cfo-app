import type { BankTransaction, ReconciliationEntry } from "@/types/open-finance"
import type { SpreadsheetRow } from "@/types/spreadsheet"

/**
 * Group transactions by month and account label, then compare with spreadsheet estimates.
 * Works with both spreadsheet rows (fluxoRows) or a simple estimado map.
 */
export function reconcile(
  transactions: BankTransaction[],
  fluxoRows: SpreadsheetRow[],
  monthKeys: string[],
  estimadoMap?: Map<string, Map<string, number>>
): ReconciliationEntry[] {
  const entries: ReconciliationEntry[] = []

  // Group transactions by month and classified account
  const txByMonth = new Map<string, Map<string, number>>()

  for (const tx of transactions) {
    if (tx.isInternalTransfer || tx.isDuplicate) continue

    // Extract month key from date "YYYY-MM-DD" -> "YYYY-MM"
    const monthKey = tx.date.substring(0, 7)
    if (!monthKeys.includes(monthKey)) continue

    const label = tx.classifiedAccount || "Nao classificado"

    if (!txByMonth.has(monthKey)) {
      txByMonth.set(monthKey, new Map())
    }
    const monthMap = txByMonth.get(monthKey)!
    const current = monthMap.get(label) || 0
    monthMap.set(label, current + Math.abs(tx.amount))
  }

  // If estimadoMap is provided (from DB), use it directly
  if (estimadoMap && estimadoMap.size > 0) {
    for (const [monthKey, accountMap] of estimadoMap) {
      if (!monthKeys.includes(monthKey)) continue
      for (const [accountLabel, estimado] of accountMap) {
        const monthMap = txByMonth.get(monthKey)
        const realizado = monthMap?.get(accountLabel) ?? 0
        if (estimado === 0 && realizado === 0) continue
        const variance = realizado - estimado
        const variancePercent = estimado !== 0
          ? (variance / Math.abs(estimado)) * 100
          : realizado !== 0 ? 100 : 0
        const absPercent = Math.abs(variancePercent)
        let status: ReconciliationEntry["status"] = "ok"
        if (absPercent > 15) status = "alert"
        else if (absPercent > 5) status = "warning"
        entries.push({ monthKey, accountLabel, estimado, realizado, variance, variancePercent, status })
      }
    }
  } else {
    // Find Estimado rows in fluxo and match with realized totals
    for (const row of fluxoRows) {
      if (!row.isEstimado) continue

      // Find matching Realizado row
      const baseName = row.category.replace(/ - Estimado$/, "")

      for (const monthKey of monthKeys) {
        const estimado = row.values[monthKey] ?? 0

        // Get realized from bank transactions
        const monthMap = txByMonth.get(monthKey)
        const realizado = monthMap?.get(baseName) ?? 0

        if (estimado === 0 && realizado === 0) continue

        const variance = realizado - estimado
        const variancePercent = estimado !== 0
          ? (variance / Math.abs(estimado)) * 100
          : realizado !== 0 ? 100 : 0

        const absPercent = Math.abs(variancePercent)
        let status: ReconciliationEntry["status"] = "ok"
        if (absPercent > 15) status = "alert"
        else if (absPercent > 5) status = "warning"

        entries.push({
          monthKey,
          accountLabel: baseName,
          estimado,
          realizado,
          variance,
          variancePercent,
          status,
        })
      }
    }
  }

  return entries.sort((a, b) => {
    // Sort by status severity then by variance
    const statusOrder = { alert: 0, warning: 1, ok: 2 }
    const diff = statusOrder[a.status] - statusOrder[b.status]
    if (diff !== 0) return diff
    return Math.abs(b.variancePercent) - Math.abs(a.variancePercent)
  })
}

/**
 * Get summary stats for reconciliation
 */
export function getReconciliationSummary(entries: ReconciliationEntry[]) {
  const alerts = entries.filter((e) => e.status === "alert").length
  const warnings = entries.filter((e) => e.status === "warning").length
  const ok = entries.filter((e) => e.status === "ok").length
  const totalEstimado = entries.reduce((sum, e) => sum + e.estimado, 0)
  const totalRealizado = entries.reduce((sum, e) => sum + e.realizado, 0)

  return { alerts, warnings, ok, total: entries.length, totalEstimado, totalRealizado }
}
