import { createAdminClient } from "@/lib/supabase/admin"

export interface Anomaly {
  type:
    | "budget_overage"
    | "burn_rate_spike"
    | "unclassified_spike"
    | "duplicate_detected"
    | "large_transaction"
    | "connection_error"
  severity: "info" | "warning" | "critical"
  title: string
  message: string
  data?: Record<string, unknown>
}

export async function detectAnomalies(
  orgId: string,
  month: string // "YYYY-MM"
): Promise<Anomaly[]> {
  const admin = createAdminClient()
  const anomalies: Anomaly[] = []

  // 1. Fetch realized transactions for the month
  const { data: realTxs } = await admin
    .from("transactions")
    .select("*")
    .eq("organization_id", orgId)
    .eq("month", `${month}-01`)
    .eq("entry_type", "realizado")

  const txs = realTxs ?? []

  // 2. Fetch budget entries for the month
  const { data: budgetEntries } = await admin
    .from("budget_entries")
    .select("*")
    .eq("organization_id", orgId)
    .like("month", `${month}%`)

  const budgets = budgetEntries ?? []

  // 3. Check budget overages
  for (const budget of budgets) {
    const actual = txs
      .filter((t) => t.account_code === budget.account_code)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
    const budgetAmt = Math.abs(Number(budget.amount))

    if (budgetAmt > 0) {
      const overage = ((actual - budgetAmt) / budgetAmt) * 100

      if (overage > 30) {
        anomalies.push({
          type: "budget_overage",
          severity: "critical",
          title: `Orcamento excedido: ${budget.account_code}`,
          message: `Conta "${budget.account_code}" excedeu o orcamento em ${overage.toFixed(0)}%. Budget: R$ ${budgetAmt.toLocaleString("pt-BR")}, Realizado: R$ ${actual.toLocaleString("pt-BR")}`,
          data: { account: budget.account_code, budget: budgetAmt, actual, overage },
        })
      } else if (overage > 15) {
        anomalies.push({
          type: "budget_overage",
          severity: "warning",
          title: `Orcamento em risco: ${budget.account_code}`,
          message: `Conta "${budget.account_code}" esta ${overage.toFixed(0)}% acima do orcamento.`,
          data: { account: budget.account_code, budget: budgetAmt, actual, overage },
        })
      }

      // 6. Large single transaction (>50% of budget)
      const largeTx = txs.find(
        (t) =>
          t.account_code === budget.account_code &&
          Math.abs(Number(t.amount)) > budgetAmt * 0.5
      )
      if (largeTx) {
        anomalies.push({
          type: "large_transaction",
          severity: "warning",
          title: `Transacao grande: ${budget.account_code}`,
          message: `Transacao de R$ ${Math.abs(Number(largeTx.amount)).toLocaleString("pt-BR")} representa mais de 50% do budget mensal dessa conta.`,
          data: { account: budget.account_code, amount: Math.abs(Number(largeTx.amount)), notes: largeTx.notes },
        })
      }
    }
  }

  // 4. Burn rate comparison (current month vs previous month)
  const prevDate = new Date(`${month}-15`)
  prevDate.setMonth(prevDate.getMonth() - 1)
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`

  const { data: prevTxs } = await admin
    .from("transactions")
    .select("amount")
    .eq("organization_id", orgId)
    .eq("month", `${prevMonth}-01`)
    .eq("entry_type", "realizado")

  if (prevTxs && prevTxs.length > 0) {
    const currentBurn = txs
      .filter((t) => Number(t.amount) < 0)
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
    const prevBurn = prevTxs
      .filter((t) => Number(t.amount) < 0)
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

    if (prevBurn > 0) {
      const burnChange = ((currentBurn - prevBurn) / prevBurn) * 100
      if (burnChange > 20) {
        anomalies.push({
          type: "burn_rate_spike",
          severity: "warning",
          title: "Burn rate subiu significativamente",
          message: `Burn rate subiu ${burnChange.toFixed(0)}% em relacao ao mes anterior. Atual: R$ ${currentBurn.toLocaleString("pt-BR")}, Anterior: R$ ${prevBurn.toLocaleString("pt-BR")}`,
          data: { currentBurn, prevBurn, changePercent: burnChange },
        })
      }
    }
  }

  // 5. Unclassified transactions
  const unclassified = txs.filter(
    (t) => !t.account_code || t.account_code === "unclassified"
  ).length
  if (txs.length > 0 && unclassified / txs.length > 0.1) {
    anomalies.push({
      type: "unclassified_spike",
      severity: "warning",
      title: "Muitas transacoes sem classificacao",
      message: `${unclassified} de ${txs.length} transacoes (${((unclassified / txs.length) * 100).toFixed(0)}%) nao estao classificadas.`,
      data: { unclassified, total: txs.length },
    })
  }

  // 7. Connection errors
  const { data: bankAccounts } = await admin
    .from("bank_accounts")
    .select("bank_name, connection_status")
    .eq("organization_id", orgId)
    .eq("connection_status", "error")

  if (bankAccounts && bankAccounts.length > 0) {
    for (const acc of bankAccounts) {
      anomalies.push({
        type: "connection_error",
        severity: "critical",
        title: `Conexao bancaria com erro: ${acc.bank_name}`,
        message: `A conexao com ${acc.bank_name} esta com erro. Reconecte para continuar sincronizando.`,
      })
    }
  }

  // Persist anomalies as alerts in DB
  for (const anomaly of anomalies) {
    await admin.from("alerts").insert({
      organization_id: orgId,
      type: anomaly.type === "budget_overage" ? "budget_exceeded" : "anomaly",
      severity: anomaly.severity,
      title: anomaly.title,
      message: anomaly.message,
      data: anomaly.data ?? null,
    })
  }

  return anomalies
}
