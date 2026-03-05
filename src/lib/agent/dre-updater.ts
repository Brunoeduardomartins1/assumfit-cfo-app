import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Update income_statement when a transaction is classified.
 * Recalculates line items for the transaction's month.
 */
export async function updateDREFromTransaction(
  orgId: string,
  context: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient()
  const month = context.month as string
  const accountCode = context.accountCode as string
  const amount = context.amount as number

  if (!month || !accountCode) return

  // Map account codes to DRE line items
  const lineItemMap: Record<string, string> = {
    "Receita SaaS": "receita",
    "Receita Servicos": "receita",
    "Receita Consultoria": "receita",
    "Outras Receitas": "receita",
    "Folha de Pagamento": "custos_fixos",
    "Aluguel e Coworking": "custos_fixos",
    "Servicos Contabeis": "custos_fixos",
    "Servicos Juridicos": "custos_fixos",
    "Ferramentas SaaS": "custos_fixos",
    "Infraestrutura Cloud": "custos_fixos",
    "Marketing Digital": "despesas_variaveis",
    "Impostos e Taxas": "despesas_variaveis",
    "Outras Despesas": "despesas_variaveis",
  }

  const lineItem = lineItemMap[accountCode]
  if (!lineItem) return

  // Get all realizado transactions for this month and recalculate
  const monthPrefix = `${month}-01`
  const { data: txs } = await admin
    .from("transactions")
    .select("account_code, amount")
    .eq("organization_id", orgId)
    .eq("entry_type", "realizado")
    .like("month", `${month}%`)

  if (!txs) return

  // Aggregate by DRE line item
  const totals: Record<string, number> = {
    receita: 0,
    cogs: 0,
    custos_fixos: 0,
    despesas_variaveis: 0,
  }

  for (const tx of txs) {
    const li = lineItemMap[tx.account_code]
    if (li && li in totals) {
      totals[li] += Math.abs(Number(tx.amount))
    }
  }

  // Calculate derived values
  totals.resultado_bruto = totals.receita - totals.cogs
  totals.ebitda = totals.resultado_bruto - totals.custos_fixos - totals.despesas_variaveis
  totals.margem_bruta = totals.receita > 0 ? totals.resultado_bruto / totals.receita : 0
  totals.margem_ebitda = totals.receita > 0 ? totals.ebitda / totals.receita : 0
  totals.burn_rate = totals.ebitda < 0 ? Math.abs(totals.ebitda) : 0

  // Upsert each line item
  for (const [item, value] of Object.entries(totals)) {
    await admin.from("income_statement").upsert(
      {
        organization_id: orgId,
        month: monthPrefix,
        line_item: item,
        amount: value,
      },
      { onConflict: "organization_id,month,line_item" }
    )
  }

  // Check variance against estimado
  const { data: estimadoDre } = await admin
    .from("income_statement")
    .select("line_item, amount")
    .eq("organization_id", orgId)
    .eq("month", monthPrefix)

  if (estimadoDre) {
    for (const est of estimadoDre) {
      const actual = totals[est.line_item]
      if (actual !== undefined && Number(est.amount) !== 0) {
        const variance = ((actual - Number(est.amount)) / Math.abs(Number(est.amount))) * 100
        if (Math.abs(variance) > 20) {
          // Import here to avoid circular dependency
          const { runDecisionCycle } = await import("./decision-engine")
          await runDecisionCycle(orgId, {
            type: "reaction",
            event: "variance_detected",
            data: {
              accountCode: est.line_item,
              estimado: Number(est.amount),
              realizado: actual,
              variancePercent: variance,
            },
          })
        }
      }
    }
  }
}
