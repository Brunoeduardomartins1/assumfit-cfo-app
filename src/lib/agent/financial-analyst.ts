import { createAdminClient } from "@/lib/supabase/admin"

export interface FinancialHealthReport {
  score: number // 0-100
  runwayMonths: number
  burnRate: number
  burnRateMoM: number // % change
  cashBalance: number
  revenue: number
  revenueMoM: number
  ebitda: number
  revenueVsProjected: number // % diff
  cac: number
  ltv: number
  topRisks: string[]
  topOpportunities: string[]
}

export async function analyzeFinancialHealth(
  orgId: string
): Promise<FinancialHealthReport> {
  const admin = createAdminClient()

  // Fetch latest income statement data
  const { data: dreData } = await admin
    .from("income_statement")
    .select("month, line_item, amount")
    .eq("organization_id", orgId)
    .order("month", { ascending: false })
    .limit(200)

  // Group by month
  const monthMap = new Map<string, Record<string, number>>()
  for (const row of dreData ?? []) {
    const mk = row.month.slice(0, 7)
    if (!monthMap.has(mk)) monthMap.set(mk, {})
    monthMap.get(mk)![row.line_item] = Number(row.amount)
  }

  const sortedMonths = Array.from(monthMap.keys()).sort()
  const latest = sortedMonths.length > 0 ? monthMap.get(sortedMonths[sortedMonths.length - 1])! : {}
  const previous = sortedMonths.length > 1 ? monthMap.get(sortedMonths[sortedMonths.length - 2])! : {}

  const burnRate = Math.abs(latest.burn_rate ?? latest.ebitda ?? 0)
  const prevBurnRate = Math.abs(previous.burn_rate ?? previous.ebitda ?? 0)
  const burnRateMoM = prevBurnRate > 0 ? ((burnRate - prevBurnRate) / prevBurnRate) : 0
  const cashBalance = latest.saldo_final ?? 0
  const runwayMonths = burnRate > 0 ? cashBalance / burnRate : 0
  const revenue = latest.receita ?? 0
  const prevRevenue = previous.receita ?? 0
  const revenueMoM = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) : 0
  const ebitda = latest.ebitda ?? 0

  // Revenue vs projected (use estimado transactions)
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const { data: estimadoTxs } = await admin
    .from("transactions")
    .select("amount")
    .eq("organization_id", orgId)
    .eq("entry_type", "estimado")
    .like("month", `${currentMonth}%`)
    .gt("amount", 0)

  const projectedRevenue = (estimadoTxs ?? []).reduce((s, t) => s + Number(t.amount), 0)
  const revenueVsProjected = projectedRevenue > 0 ? ((revenue - projectedRevenue) / projectedRevenue) : 0

  // Simplified CAC / LTV
  const despVar = latest.despesas_variaveis ?? 0
  const marketingCost = despVar * 0.3
  const estCustomers = revenue > 0 ? Math.max(Math.ceil(revenue / 2000), 1) : 1
  const cac = marketingCost / estCustomers
  const churn = 0.05
  const ltv = revenue > 0 ? (revenue / estCustomers) / churn : 0

  // Score calculation (0-100)
  let score = 50
  if (runwayMonths >= 12) score += 15
  else if (runwayMonths >= 6) score += 8
  else if (runwayMonths < 3) score -= 20

  if (revenueMoM > 0.2) score += 15
  else if (revenueMoM > 0) score += 5
  else if (revenueMoM < -0.1) score -= 10

  if (ebitda > 0) score += 10
  if (burnRateMoM < 0) score += 5 // burn decreasing
  if (burnRateMoM > 0.2) score -= 10 // burn increasing fast

  if (ltv / cac > 3) score += 5
  score = Math.max(0, Math.min(100, score))

  // Identify risks and opportunities
  const topRisks: string[] = []
  const topOpportunities: string[] = []

  if (runwayMonths < 3) topRisks.push(`Runway critico: ${runwayMonths.toFixed(1)} meses`)
  if (burnRateMoM > 0.2) topRisks.push(`Burn rate crescendo ${(burnRateMoM * 100).toFixed(0)}% MoM`)
  if (revenueMoM < -0.05) topRisks.push(`Receita caiu ${(revenueMoM * 100).toFixed(0)}% MoM`)
  if (ebitda < 0 && Math.abs(ebitda) > revenue * 0.5) topRisks.push("EBITDA negativo e significativo vs receita")

  if (revenueMoM > 0.3) topOpportunities.push(`Receita crescendo ${(revenueMoM * 100).toFixed(0)}% MoM — momento para escalar`)
  if (ebitda > 0) topOpportunities.push("EBITDA positivo — possivel break-even sustentavel")
  if (burnRateMoM < -0.1) topOpportunities.push("Burn rate caindo — eficiencia melhorando")
  if (ltv / cac > 5) topOpportunities.push("LTV/CAC excelente — unit economics saudavel")

  return {
    score,
    runwayMonths,
    burnRate,
    burnRateMoM,
    cashBalance,
    revenue,
    revenueMoM,
    ebitda,
    revenueVsProjected,
    cac,
    ltv,
    topRisks: topRisks.slice(0, 3),
    topOpportunities: topOpportunities.slice(0, 3),
  }
}
