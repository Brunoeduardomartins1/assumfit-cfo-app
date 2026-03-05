import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { learnFromManualClassification } from "@/lib/agent/classifier"
import { updateDREFromTransaction } from "@/lib/agent/dre-updater"

/**
 * POST /api/agent/classify-transaction
 * Called by N8N when user classifies a transaction via WhatsApp.
 * Updates the transaction and teaches the agent.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { transactionId, category, orgId: providedOrgId } = await req.json()

  if (!transactionId || !category) {
    return NextResponse.json({ error: "transactionId and category required" }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get orgId from transaction if not provided
  let orgId = providedOrgId
  if (!orgId) {
    const { data: tx } = await admin
      .from("transactions")
      .select("organization_id")
      .eq("id", transactionId)
      .single()
    orgId = tx?.organization_id
  }

  if (!orgId) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
  }

  // Update classification
  await admin
    .from("transactions")
    .update({ account_code: category })
    .eq("id", transactionId)

  // Learn from manual classification
  await learnFromManualClassification(orgId, transactionId, category)

  // Get transaction details for DRE update
  const { data: updatedTx } = await admin
    .from("transactions")
    .select("month, amount, account_code")
    .eq("id", transactionId)
    .single()

  if (updatedTx) {
    await updateDREFromTransaction(orgId, {
      month: updatedTx.month?.slice(0, 7),
      accountCode: updatedTx.account_code,
      amount: Number(updatedTx.amount),
    })
  }

  return NextResponse.json({
    success: true,
    transactionId,
    category,
    message: `Transação classificada como "${category}" e agente aprendeu o padrão.`,
  })
}
