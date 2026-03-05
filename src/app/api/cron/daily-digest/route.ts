import { NextRequest, NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/automation/cron-auth"
import { runDailyDigest, getActiveOrganizations } from "@/lib/automation/daily-tasks"
import { sendCFONotification } from "@/lib/email/resend-client"
import { buildDailyDigestEmail, buildCriticalAlertEmail } from "@/lib/email/templates"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const orgs = await getActiveOrganizations()

    if (orgs.length === 0) {
      return NextResponse.json({ success: true, message: "No active organizations" })
    }

    const results = []

    for (const org of orgs) {
      try {
        const result = await runDailyDigest(org.id)

        // Send daily digest email
        const html = buildDailyDigestEmail(result)
        await sendCFONotification(`Resumo Diario — ${result.date}`, html)

        // Send separate critical alert emails (max 5)
        const criticals = result.criticalAlerts.slice(0, 5)
        for (const alert of criticals) {
          const alertHtml = buildCriticalAlertEmail({
            title: alert.title,
            message: alert.message,
            severity: "critical",
          })
          await sendCFONotification(`[CRITICO] ${alert.title}`, alertHtml)
        }

        results.push({
          orgId: org.id,
          orgName: org.name,
          transactions: result.newTransactionsCount,
          anomalies: result.anomalies.length,
          criticalAlerts: criticals.length,
        })

        console.log(
          `Daily digest sent for ${org.name}: ${result.newTransactionsCount} txs, ${result.anomalies.length} anomalies`
        )
      } catch (err) {
        console.error(`Daily digest error for org ${org.id}:`, err)
        results.push({ orgId: org.id, error: String(err) })
      }
    }

    return NextResponse.json({
      success: true,
      processed: orgs.length,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Daily digest cron error:", error)
    return NextResponse.json(
      { error: "Internal error", details: String(error) },
      { status: 500 }
    )
  }
}
