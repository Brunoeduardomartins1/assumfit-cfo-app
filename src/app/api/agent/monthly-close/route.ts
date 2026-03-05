import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { analyzeFinancialHealth } from "@/lib/agent/financial-analyst"
import { generateBoardReport } from "@/lib/agent/report-generator"

/**
 * POST /api/agent/monthly-close
 * Called by N8N monthly close workflow.
 * Runs full monthly close: DRE finalization, board report, email.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (
    authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}` &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  const orgId = process.env.DEFAULT_ORG_ID
  if (!orgId) {
    const { data: firstOrg } = await admin.from("organizations").select("id").limit(1).single()
    if (!firstOrg) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 })
    }
    return await runMonthlyClose(firstOrg.id)
  }

  return await runMonthlyClose(orgId)
}

async function runMonthlyClose(orgId: string) {
  const admin = createAdminClient()
  const now = new Date()
  // Close previous month
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const period = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`

  try {
    // 1. Financial health analysis
    const health = await analyzeFinancialHealth(orgId)

    // 2. Generate board report with AI narrative
    const report = await generateBoardReport(orgId, period)

    // 3. Build email HTML
    const emailData = {
      period,
      revenue: health.revenue,
      ebitda: health.ebitda,
      burnRate: health.burnRate,
      runway: health.runwayMonths,
      score: health.score,
    }

    const reportHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1e293b;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#22c55e;padding:20px 24px;">
    <h1 style="margin:0;color:#0f172a;font-size:20px;">ASSUMFIT CFO</h1>
    <p style="margin:4px 0 0;color:#0f172a;font-size:13px;">Board Report — ${period}</p>
  </td></tr>
  <tr><td style="padding:24px;color:#e2e8f0;font-size:14px;line-height:1.6;">
    <table width="100%" style="margin-bottom:20px;">
      <tr>
        <td style="padding:8px;text-align:center;background:#0f172a;border-radius:8px;">
          <div style="color:#94a3b8;font-size:11px;">Score</div>
          <div style="color:#22c55e;font-size:24px;font-weight:bold;">${health.score}/100</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:8px;text-align:center;background:#0f172a;border-radius:8px;">
          <div style="color:#94a3b8;font-size:11px;">Runway</div>
          <div style="color:#60a5fa;font-size:24px;font-weight:bold;">${health.runwayMonths.toFixed(1)}m</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:8px;text-align:center;background:#0f172a;border-radius:8px;">
          <div style="color:#94a3b8;font-size:11px;">Burn Rate</div>
          <div style="color:#f59e0b;font-size:24px;font-weight:bold;">R$${(health.burnRate / 1000).toFixed(0)}k</div>
        </td>
      </tr>
    </table>
    <div style="white-space:pre-wrap;">${report.narrative}</div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`

    // Log
    await admin.from("audit_log").insert({
      organization_id: orgId,
      action: "n8n_monthly_close",
      entity_type: "reports",
      new_value: {
        period,
        reportId: report.id,
        score: health.score,
      },
    })

    return NextResponse.json({
      period,
      reportId: report.id,
      score: health.score,
      revenue: health.revenue,
      ebitda: health.ebitda,
      burnRate: health.burnRate,
      runwayMonths: health.runwayMonths,
      narrative: report.narrative,
      reportHtml,
    })
  } catch (error) {
    console.error("[Agent/MonthlyClose] Error:", error)
    return NextResponse.json({ error: "Monthly close failed" }, { status: 500 })
  }
}
