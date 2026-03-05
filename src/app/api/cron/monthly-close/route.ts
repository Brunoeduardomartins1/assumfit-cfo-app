import { NextRequest, NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/automation/cron-auth"
import { getActiveOrganizations } from "@/lib/automation/daily-tasks"
import { runMonthlyClose } from "@/lib/automation/monthly-tasks"
import { sendCFONotification } from "@/lib/email/resend-client"
import { buildMonthlyCloseEmail } from "@/lib/email/templates"

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
        const result = await runMonthlyClose(org.id)

        const html = buildMonthlyCloseEmail(result)
        await sendCFONotification(
          `Fechamento Mensal — ${result.month}`,
          html
        )

        results.push({
          orgId: org.id,
          orgName: org.name,
          month: result.month,
          checklist: result.checklist.length,
          alerts: result.alertsSummary.total,
        })

        console.log(
          `Monthly close sent for ${org.name}: month ${result.month}, ${result.alertsSummary.total} alerts`
        )
      } catch (err) {
        console.error(`Monthly close error for org ${org.id}:`, err)
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
    console.error("Monthly close cron error:", error)
    return NextResponse.json(
      { error: "Internal error", details: String(error) },
      { status: 500 }
    )
  }
}
