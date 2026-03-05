import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { analyzeFinancialHealth } from "@/lib/agent/financial-analyst"
import { checkUpcomingBills, markOverdueBills } from "@/lib/agent/bill-manager"
import { buildDailyDigestEmail } from "@/lib/email/templates"

/**
 * GET /api/agent/daily-summary
 * Called by N8N daily digest workflow.
 * Returns formatted daily financial summary.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (
    authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}` &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // Get the default org (first org or configured one)
  const orgId = process.env.DEFAULT_ORG_ID
  if (!orgId) {
    const { data: firstOrg } = await admin.from("organizations").select("id").limit(1).single()
    if (!firstOrg) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 })
    }
    return await buildSummary(firstOrg.id)
  }

  return await buildSummary(orgId)
}

async function buildSummary(orgId: string) {
  const admin = createAdminClient()
  const now = new Date()
  const dateStr = now.toLocaleDateString("pt-BR")

  try {
    // Financial health
    const health = await analyzeFinancialHealth(orgId)

    // Bills
    const overdueMarked = await markOverdueBills(orgId)
    const bills = await checkUpcomingBills(orgId)

    // Today's transactions
    const today = now.toISOString().split("T")[0]
    const { count: newTxCount } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("entry_type", "realizado")
      .gte("created_at", `${today}T00:00:00`)

    // Unread alerts
    const { count: alertCount } = await admin
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("is_read", false)

    // Build email HTML
    const emailData = {
      date: dateStr,
      kpis: {
        saldo: health.cashBalance,
        burnRate: health.burnRate,
        runway: health.runwayMonths,
        receita: health.revenue,
        ebitda: health.ebitda,
      },
      reconciliation: { ok: 0, warnings: 0, alerts: 0, totalEstimado: 0, totalRealizado: 0 },
      unclassifiedCount: 0,
      newTransactionsCount: newTxCount ?? 0,
      criticalAlerts: [],
      anomalies: [],
    }
    const emailHtml = buildDailyDigestEmail(emailData)

    return NextResponse.json({
      date: dateStr,
      score: health.score,
      revenue: health.revenue,
      ebitda: health.ebitda,
      burnRate: health.burnRate,
      cashBalance: health.cashBalance,
      runwayMonths: health.runwayMonths,
      cac: health.cac,
      ltv: health.ltv,
      pendingBills: bills.bills.length,
      creditCardsDue: bills.creditCards.length,
      overdueCount: overdueMarked,
      newTransactions: newTxCount ?? 0,
      unreadAlerts: alertCount ?? 0,
      topRisks: health.topRisks,
      topOpportunities: health.topOpportunities,
      emailHtml,
    })
  } catch (error) {
    console.error("[Agent/DailySummary] Error:", error)
    return NextResponse.json({ error: "Failed to build summary" }, { status: 500 })
  }
}
