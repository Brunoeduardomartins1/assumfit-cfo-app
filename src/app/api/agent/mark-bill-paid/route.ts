import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/agent/mark-bill-paid
 * Called by N8N when user marks a bill as paid via WhatsApp.
 * Accepts either billId or description to find the bill.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { billId, description } = await req.json()

  if (!billId && !description) {
    return NextResponse.json({ error: "billId or description required" }, { status: 400 })
  }

  const admin = createAdminClient()

  let bill
  if (billId) {
    const { data } = await admin
      .from("bills")
      .select("id, description, amount, status")
      .eq("id", billId)
      .single()
    bill = data
  } else {
    // Search by description (fuzzy match)
    const { data } = await admin
      .from("bills")
      .select("id, description, amount, status")
      .eq("status", "pending")
      .ilike("description", `%${description}%`)
      .order("due_date", { ascending: true })
      .limit(1)
      .single()
    bill = data
  }

  if (!bill) {
    return NextResponse.json({
      success: false,
      message: "Conta não encontrada. Verifique o nome ou ID.",
    })
  }

  if (bill.status === "paid") {
    return NextResponse.json({
      success: false,
      message: `Conta "${bill.description}" já está paga.`,
    })
  }

  // Mark as paid
  await admin
    .from("bills")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", bill.id)

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })

  return NextResponse.json({
    success: true,
    billId: bill.id,
    message: `Conta "${bill.description}" (R$ ${fmt(bill.amount)}) marcada como paga.`,
    reply: `✅ Conta "${bill.description}" (R$ ${fmt(bill.amount)}) marcada como *paga*.`,
  })
}
