import { createAdminClient } from "@/lib/supabase/admin"
import type { MonthlyCloseData } from "@/lib/email/templates"

export interface MonthlyCloseResult extends MonthlyCloseData {
  orgId: string
}

export async function runMonthlyClose(orgId: string): Promise<MonthlyCloseResult> {
  const admin = createAdminClient()

  // Determine previous month
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`

  // Fetch all data in parallel
  const [dreResult, estResult, realResult, budgetResult, alertsResult, dreAllResult] =
    await Promise.all([
      admin
        .from("income_statement")
        .select("*")
        .eq("organization_id", orgId)
        .is("scenario_id", null)
        .like("month", `${prevMonth}%`)
        .order("line_item"),
      admin
        .from("transactions")
        .select("*")
        .eq("organization_id", orgId)
        .eq("month", `${prevMonth}-01`)
        .eq("entry_type", "estimado"),
      admin
        .from("transactions")
        .select("*")
        .eq("organization_id", orgId)
        .eq("month", `${prevMonth}-01`)
        .eq("entry_type", "realizado"),
      admin
        .from("budget_entries")
        .select("*")
        .eq("organization_id", orgId)
        .like("month", `${prevMonth}%`),
      admin
        .from("alerts")
        .select("severity")
        .eq("organization_id", orgId)
        .gte("created_at", `${prevMonth}-01T00:00:00Z`)
        .lt(
          "created_at",
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01T00:00:00Z`
        ),
      // Also fetch all DRE for MoM comparison
      admin
        .from("income_statement")
        .select("*")
        .eq("organization_id", orgId)
        .is("scenario_id", null)
        .order("month")
        .order("line_item"),
    ])

  const dreData = dreResult.data ?? []
  const estTxs = estResult.data ?? []
  const realTxs = realResult.data ?? []
  const budgetForMonth = (budgetResult.data ?? [])
  const alerts = alertsResult.data ?? []
  const allDre = dreAllResult.data ?? []

  // --- Monthly Close Checklist ---
  const checks: string[] = []
  const expectedItems = ["receita", "cogs", "resultado_bruto", "custos_fixos", "despesas_variaveis", "ebitda"]
  const foundItems = dreData.map((d) => d.line_item)
  const missingItems = expectedItems.filter((i) => !foundItems.includes(i))
  checks.push(
    missingItems.length === 0
      ? "DRE completa — todos os line items presentes"
      : `DRE incompleta — faltam: ${missingItems.join(", ")}`
  )

  // Consistency check
  const dreMap: Record<string, number> = {}
  for (const d of dreData) dreMap[d.line_item] = Number(d.amount)
  if (dreMap.receita != null && dreMap.cogs != null && dreMap.resultado_bruto != null) {
    const expected = dreMap.receita - dreMap.cogs
    const diff = Math.abs(expected - dreMap.resultado_bruto)
    checks.push(
      diff < 1
        ? "Consistencia — receita - COGS = resultado bruto"
        : `Inconsistencia — receita - COGS = R$ ${expected.toLocaleString("pt-BR")}, mas resultado_bruto = R$ ${dreMap.resultado_bruto.toLocaleString("pt-BR")}`
    )
  }

  // Coverage
  const estAccounts = new Set(estTxs.map((t) => t.account_code))
  const realAccounts = new Set(realTxs.map((t) => t.account_code))
  const coverage = estAccounts.size > 0 ? (realAccounts.size / estAccounts.size) * 100 : 0
  checks.push(
    coverage >= 80
      ? `Cobertura — ${coverage.toFixed(0)}% das contas estimadas tem realizado`
      : `Cobertura baixa — apenas ${coverage.toFixed(0)}% das contas estimadas tem realizado (${realAccounts.size}/${estAccounts.size})`
  )

  // Unclassified
  const unclassified = realTxs.filter(
    (t) => !t.account_code || t.account_code === "unclassified"
  ).length
  checks.push(
    unclassified === 0
      ? "Classificacao — todas as transacoes classificadas"
      : `${unclassified} transacoes sem classificacao`
  )

  // Budget check
  if (budgetForMonth.length > 0) {
    const overBudget = budgetForMonth.filter((b) => {
      const actual = realTxs
        .filter((t) => t.account_code === b.account_code)
        .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
      return actual > Math.abs(b.amount) * 1.1
    })
    checks.push(
      overBudget.length === 0
        ? "Orcamento — nenhuma conta acima de 10% do budget"
        : `${overBudget.length} contas acima do orcamento em >10%`
    )
  } else {
    checks.push("Sem dados de budget para comparacao")
  }

  // --- Budget vs Actual ---
  const budgetLines: string[] = []
  for (const b of budgetForMonth) {
    const actual = realTxs
      .filter((t) => t.account_code === b.account_code)
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
    const budgetAmt = Math.abs(Number(b.amount))
    const variance = budgetAmt > 0 ? ((actual - budgetAmt) / budgetAmt) * 100 : 0
    const status = variance > 15 ? "ACIMA" : variance < -15 ? "ABAIXO" : "OK"
    budgetLines.push(
      `${b.account_code}: Budget R$ ${budgetAmt.toLocaleString("pt-BR")} | Real R$ ${actual.toLocaleString("pt-BR")} | ${variance.toFixed(0)}% [${status}]`
    )
  }

  // --- Board Report (simplified, no Claude API) ---
  const monthMap = new Map<string, Record<string, number>>()
  for (const row of allDre) {
    const mk = row.month.slice(0, 7)
    if (!monthMap.has(mk)) monthMap.set(mk, {})
    monthMap.get(mk)![row.line_item] = Number(row.amount)
  }
  const months = Array.from(monthMap.keys()).sort()
  const latestDre = monthMap.get(prevMonth) ?? {}
  const prevPrevMonth = months[months.indexOf(prevMonth) - 1]
  const prevDre = prevPrevMonth ? monthMap.get(prevPrevMonth) ?? {} : {}

  const boardLines: string[] = []
  boardLines.push(`BOARD REPORT — ${prevMonth}`)
  boardLines.push(`Receita: R$ ${(latestDre.receita ?? 0).toLocaleString("pt-BR")}`)
  boardLines.push(`EBITDA: R$ ${(latestDre.ebitda ?? 0).toLocaleString("pt-BR")}`)

  if (prevDre.receita) {
    const recGrowth = ((latestDre.receita ?? 0) - prevDre.receita) / prevDre.receita * 100
    boardLines.push(`Crescimento receita MoM: ${recGrowth.toFixed(1)}%`)
  }
  if (latestDre.receita && latestDre.receita !== 0) {
    const margin = ((latestDre.ebitda ?? 0) / latestDre.receita) * 100
    boardLines.push(`Margem EBITDA: ${margin.toFixed(1)}%`)
  }

  const totalExpenses = realTxs
    .filter((t) => Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  boardLines.push(`Despesas totais: R$ ${totalExpenses.toLocaleString("pt-BR")}`)
  boardLines.push(`Transacoes realizadas: ${realTxs.length}`)

  // --- Alerts Summary ---
  const alertsSummary = {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  }

  // --- Audit log ---
  await admin.from("audit_log").insert({
    organization_id: orgId,
    action: "cron_monthly_close",
    entity_type: "automation",
    new_value: {
      month: prevMonth,
      checks: checks.length,
      budgetEntries: budgetForMonth.length,
      alerts: alertsSummary.total,
    },
  })

  await admin.from("automation_runs").insert({
    organization_id: orgId,
    run_type: "monthly_close",
    status: "completed",
    completed_at: new Date().toISOString(),
    result: { month: prevMonth, checks, alertsSummary },
  })

  return {
    orgId,
    month: prevMonth,
    checklist: checks,
    dreData: dreMap,
    boardReport: boardLines.join("\n"),
    budgetComparison: budgetLines.join("\n"),
    alertsSummary,
  }
}
