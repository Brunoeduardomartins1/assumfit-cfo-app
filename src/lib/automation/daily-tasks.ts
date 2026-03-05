import { createAdminClient } from "@/lib/supabase/admin"
import { classifyTransactions, flagDuplicates } from "@/lib/open-finance"
import { reconcile, getReconciliationSummary } from "@/lib/open-finance/reconciler"
import { detectAnomalies, type Anomaly } from "./anomaly-detector"
import type { DailyDigestData } from "@/lib/email/templates"
import type { BankTransaction } from "@/types/open-finance"

export interface DailyDigestResult extends DailyDigestData {
  orgId: string
}

export async function runDailyDigest(orgId: string): Promise<DailyDigestResult> {
  const admin = createAdminClient()
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const dateStr = now.toLocaleDateString("pt-BR")

  // 1. Fetch realized transactions for current month
  const { data: realTxs } = await admin
    .from("transactions")
    .select("*")
    .eq("organization_id", orgId)
    .eq("month", `${currentMonth}-01`)
    .eq("entry_type", "realizado")

  const txs = realTxs ?? []

  // 2. Re-classify unclassified transactions
  const unclassifiedTxs = txs.filter(
    (t) => !t.account_code || t.account_code === "unclassified"
  )

  let reclassifiedCount = 0
  if (unclassifiedTxs.length > 0) {
    const bankTxs: BankTransaction[] = unclassifiedTxs.map((t) => ({
      id: t.id,
      accountId: "",
      date: t.month.slice(0, 10),
      description: t.notes ?? "",
      amount: Math.abs(Number(t.amount)),
      type: (Number(t.amount) < 0 ? "debit" : "credit") as "debit" | "credit",
    }))

    const classified = classifyTransactions(bankTxs)
    const newlyClassified = classified.filter((t) => t.classifiedAccount)

    // Update in DB
    for (const tx of newlyClassified) {
      await admin
        .from("transactions")
        .update({ account_code: tx.classifiedAccount })
        .eq("id", tx.id)
      reclassifiedCount++
    }
  }

  // 3. Run reconciliation (estimado vs realizado)
  const { data: estTxs } = await admin
    .from("transactions")
    .select("*")
    .eq("organization_id", orgId)
    .eq("month", `${currentMonth}-01`)
    .eq("entry_type", "estimado")

  const estimadoMap = new Map<string, Map<string, number>>()
  for (const t of estTxs ?? []) {
    const mk = t.month.slice(0, 7)
    if (!estimadoMap.has(mk)) estimadoMap.set(mk, new Map())
    const acctMap = estimadoMap.get(mk)!
    acctMap.set(t.account_code, (acctMap.get(t.account_code) ?? 0) + Math.abs(Number(t.amount)))
  }

  // Build BankTransaction[] from all realized for reconciliation
  const allBankTxs: BankTransaction[] = txs.map((t) => ({
    id: t.id,
    accountId: "",
    date: t.month.slice(0, 10),
    description: t.notes ?? t.account_code,
    amount: Math.abs(Number(t.amount)),
    type: (Number(t.amount) < 0 ? "debit" : "credit") as "debit" | "credit",
    classifiedAccount: t.account_code,
  }))
  const withDuplicates = flagDuplicates(allBankTxs)
  const reconEntries = reconcile(withDuplicates, [], [currentMonth], estimadoMap)
  const summary = getReconciliationSummary(reconEntries)

  // 4. Detect anomalies
  const anomalies = await detectAnomalies(orgId, currentMonth)

  // 5. Compute KPIs from income statement
  const { data: dreData } = await admin
    .from("income_statement")
    .select("line_item, amount")
    .eq("organization_id", orgId)
    .is("scenario_id", null)
    .like("month", `${currentMonth}%`)

  const dreMap: Record<string, number> = {}
  for (const row of dreData ?? []) {
    dreMap[row.line_item] = Number(row.amount)
  }

  // Get bank balance for saldo
  const { data: bankAccounts } = await admin
    .from("bank_accounts")
    .select("balance")
    .eq("organization_id", orgId)
    .eq("connection_status", "connected")

  const saldo = (bankAccounts ?? []).reduce((s, a) => s + (Number(a.balance) || 0), 0)
  const receita = dreMap.receita ?? 0
  const ebitda = dreMap.ebitda ?? 0
  const burnRate = Math.abs(
    txs
      .filter((t) => Number(t.amount) < 0)
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  )
  const runway = burnRate > 0 ? saldo / burnRate : 99

  // 6. Get unread critical alerts
  const { data: alertsData } = await admin
    .from("alerts")
    .select("title, message")
    .eq("organization_id", orgId)
    .eq("is_read", false)
    .eq("severity", "critical")
    .order("created_at", { ascending: false })
    .limit(10)

  // 7. Audit log
  await admin.from("audit_log").insert({
    organization_id: orgId,
    action: "cron_daily_digest",
    entity_type: "automation",
    new_value: {
      transactions: txs.length,
      reclassified: reclassifiedCount,
      anomalies: anomalies.length,
      reconciliation: { ok: summary.ok, warnings: summary.warnings, alerts: summary.alerts },
    },
  })

  // 8. Agent: check upcoming bills and mark overdue
  try {
    const { checkUpcomingBills, markOverdueBills, generateRecurringBills } = await import("@/lib/agent/bill-manager")
    const overdueMarked = await markOverdueBills(orgId)
    const recurringCreated = await generateRecurringBills(orgId)
    const bills = await checkUpcomingBills(orgId)

    if (bills.bills.length > 0 || bills.creditCards.length > 0) {
      const { runDecisionCycle } = await import("@/lib/agent/decision-engine")
      await runDecisionCycle(orgId, {
        type: "cron",
        event: "daily_check",
        data: {
          upcomingBills: bills.bills.length,
          creditCardsDue: bills.creditCards.length,
          overdueMarked,
          recurringCreated,
        },
      })
    }
  } catch (err) {
    console.error("[DailyDigest] Bill check error:", err)
  }

  // 9. Log automation run
  await admin.from("automation_runs").insert({
    organization_id: orgId,
    run_type: "daily_digest",
    status: "completed",
    completed_at: new Date().toISOString(),
    result: {
      transactions: txs.length,
      reclassified: reclassifiedCount,
      anomalies: anomalies.length,
    },
  })

  const unclassifiedCount = txs.filter(
    (t) => !t.account_code || t.account_code === "unclassified"
  ).length

  return {
    orgId,
    date: dateStr,
    kpis: { saldo, burnRate, runway, receita, ebitda },
    reconciliation: {
      ok: summary.ok,
      warnings: summary.warnings,
      alerts: summary.alerts,
      totalEstimado: summary.totalEstimado,
      totalRealizado: summary.totalRealizado,
    },
    unclassifiedCount,
    newTransactionsCount: txs.length,
    criticalAlerts: (alertsData ?? []).map((a) => ({ title: a.title, message: a.message })),
    anomalies: anomalies.map((a) => a.message),
  }
}

export async function getActiveOrganizations(): Promise<Array<{ id: string; name: string }>> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("bank_accounts")
    .select("organization_id, organizations!inner(id, name)")
    .eq("connection_status", "connected")

  if (!data || data.length === 0) return []

  const orgMap = new Map<string, string>()
  for (const row of data) {
    const org = (row as Record<string, unknown>).organizations as { id: string; name: string } | null
    if (org) orgMap.set(org.id, org.name)
  }
  return Array.from(orgMap.entries()).map(([id, name]) => ({ id, name }))
}
