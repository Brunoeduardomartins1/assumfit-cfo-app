import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Z-API WhatsApp webhook — receives incoming messages.
 * Used for confirmation replies (e.g., "OK", "SIM", "APROVAR").
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Z-API webhook payload
    const phone = body.phone ?? body.from
    const text = (body.text?.message ?? body.body ?? "").trim().toUpperCase()
    const isFromMe = body.fromMe === true

    // Ignore messages sent by us
    if (isFromMe || !phone || !text) {
      return NextResponse.json({ ok: true })
    }

    console.log(`[WhatsApp] Received from ${phone}: ${text}`)

    const admin = createAdminClient()

    // Find org by WhatsApp number
    const { data: settings } = await admin
      .from("autonomy_settings")
      .select("organization_id")
      .eq("whatsapp_number", normalizePhone(phone))
      .single()

    if (!settings) {
      console.warn("[WhatsApp] No org found for phone:", phone)
      return NextResponse.json({ ok: true })
    }

    const orgId = settings.organization_id

    // Handle confirmation commands
    if (["OK", "SIM", "CONFIRMAR", "APROVAR"].includes(text)) {
      // Approve most recent pending action
      const { data: pendingAction } = await admin
        .from("agent_actions")
        .select("id, action, context")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .eq("requires_approval", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (pendingAction) {
        await admin
          .from("agent_actions")
          .update({ status: "approved" })
          .eq("id", pendingAction.id)

        // Execute the approved action
        const { executeDecisions } = await import("@/lib/agent/decision-engine")
        await executeDecisions(orgId, [
          {
            action: pendingAction.action,
            priority: "high" as const,
            reasoning: `Aprovado via WhatsApp por ${phone}`,
            context: pendingAction.context as Record<string, unknown>,
            automated: true,
          },
        ])

        const { sendWhatsAppText } = await import("@/lib/notifications/whatsapp")
        await sendWhatsAppText(phone, `✅ Ação "${pendingAction.action}" aprovada e executada.`)
      } else {
        const { sendWhatsAppText } = await import("@/lib/notifications/whatsapp")
        await sendWhatsAppText(phone, `ℹ️ Nenhuma ação pendente de aprovação.`)
      }
    } else if (["NAO", "NÃO", "REJEITAR", "CANCELAR"].includes(text)) {
      // Reject most recent pending action
      const { data: pendingAction } = await admin
        .from("agent_actions")
        .select("id, action")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .eq("requires_approval", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (pendingAction) {
        await admin
          .from("agent_actions")
          .update({ status: "rejected" })
          .eq("id", pendingAction.id)

        const { sendWhatsAppText } = await import("@/lib/notifications/whatsapp")
        await sendWhatsAppText(phone, `❌ Ação "${pendingAction.action}" rejeitada.`)
      }
    } else if (text === "STATUS" || text === "RESUMO") {
      // Send current financial status
      const { analyzeFinancialHealth } = await import("@/lib/agent/financial-analyst")
      const health = await analyzeFinancialHealth(orgId)

      const { buildDailySummaryMessage } = await import("@/lib/notifications/message-templates")
      const msg = buildDailySummaryMessage({
        date: new Date().toLocaleDateString("pt-BR"),
        score: health.score,
        revenue: health.revenue,
        burnRate: health.burnRate,
        runwayMonths: health.runwayMonths,
        cashBalance: health.cashBalance,
        pendingBills: 0,
        overdueCount: 0,
        newTransactions: 0,
      })

      const { sendWhatsAppText } = await import("@/lib/notifications/whatsapp")
      await sendWhatsAppText(phone, msg)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[WhatsApp Webhook] Error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("55")) return digits
  return `55${digits}`
}
