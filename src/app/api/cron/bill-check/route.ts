import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkUpcomingBills, markOverdueBills } from "@/lib/agent/bill-manager"
import { runDecisionCycle } from "@/lib/agent/decision-engine"
import { isWhatsAppConfigured, sendWhatsAppText } from "@/lib/notifications/whatsapp"
import { buildBillDueMessage } from "@/lib/notifications/message-templates"

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // Get all active orgs
  const { data: orgs } = await admin
    .from("organizations")
    .select("id")

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ message: "No organizations found" })
  }

  const results = []

  for (const org of orgs) {
    try {
      const overdueMarked = await markOverdueBills(org.id)
      const bills = await checkUpcomingBills(org.id)

      // Send WhatsApp notification for upcoming bills
      if (bills.bills.length > 0 || bills.creditCards.length > 0) {
        // Get autonomy settings for WhatsApp
        const { data: settings } = await admin
          .from("autonomy_settings")
          .select("notify_whatsapp, whatsapp_number")
          .eq("organization_id", org.id)
          .single()

        if (settings?.notify_whatsapp && settings.whatsapp_number && isWhatsAppConfigured()) {
          const billData = bills.bills.map((b) => ({
            description: b.description,
            amount: b.amount,
            dueDate: b.due_date,
            daysUntil: b.days_until,
          }))
          const msg = buildBillDueMessage(billData)
          if (msg) {
            await sendWhatsAppText(settings.whatsapp_number, msg)
          }
        }

        // Run decision engine for bill alerts
        await runDecisionCycle(org.id, {
          type: "cron",
          event: "daily_check",
          data: {
            upcomingBills: bills.bills.length,
            creditCardsDue: bills.creditCards.length,
            overdueMarked,
          },
        })
      }

      results.push({
        orgId: org.id,
        overdueMarked,
        upcomingBills: bills.bills.length,
        creditCardsDue: bills.creditCards.length,
      })
    } catch (err) {
      console.error(`[BillCheck] Error for org ${org.id}:`, err)
      results.push({ orgId: org.id, error: String(err) })
    }
  }

  return NextResponse.json({ results })
}
