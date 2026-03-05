import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { pluggyProvider, classifyTransactions, flagDuplicates } from "@/lib/open-finance"
import { runDecisionCycle } from "@/lib/agent/decision-engine"
import { detectAnomalies } from "@/lib/automation/anomaly-detector"

/**
 * POST /api/agent/process-transaction
 * Called by N8N when Pluggy sends a webhook event.
 * Processes transactions, runs decision engine, returns anomaly status.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { event, itemId, accountId, transactionsCreatedAtFrom } = body

  const admin = createAdminClient()

  try {
    switch (event) {
      case "item/updated": {
        if (itemId) {
          await admin
            .from("bank_accounts")
            .update({ connection_status: "connected", last_sync: new Date().toISOString() })
            .eq("pluggy_item_id", itemId)
        }
        return NextResponse.json({ processed: true, event })
      }

      case "item/error": {
        if (itemId) {
          await admin
            .from("bank_accounts")
            .update({ connection_status: "error" })
            .eq("pluggy_item_id", itemId)

          const { data: bankAccount } = await admin
            .from("bank_accounts")
            .select("organization_id, bank_name")
            .eq("pluggy_item_id", itemId)
            .single()

          if (bankAccount) {
            await admin.from("alerts").insert({
              organization_id: bankAccount.organization_id,
              type: "anomaly",
              severity: "critical",
              title: `Erro na conexão: ${bankAccount.bank_name}`,
              message: body.error?.message ?? "Erro na conexão bancária",
            })
          }
        }
        return NextResponse.json({
          processed: true,
          event,
          hasCriticalAnomaly: true,
          alertMessage: `Erro na conexão bancária (item ${itemId})`,
          alertTitle: "Erro Open Finance",
        })
      }

      case "transactions/created": {
        if (!itemId || !accountId) {
          return NextResponse.json({ error: "Missing itemId or accountId" }, { status: 400 })
        }

        const { data: bankAccount } = await admin
          .from("bank_accounts")
          .select("organization_id")
          .eq("pluggy_item_id", itemId)
          .single()

        if (!bankAccount) {
          return NextResponse.json({ error: "Bank account not found" }, { status: 404 })
        }

        const orgId = bankAccount.organization_id
        const now = new Date()
        const from = transactionsCreatedAtFrom ??
          new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
        const to = now.toISOString().split("T")[0]

        // Fetch and classify transactions
        let txs = await pluggyProvider.getTransactions(accountId, from, to)
        txs = classifyTransactions(txs)
        txs = flagDuplicates(txs)

        const txRecords = txs
          .filter((tx) => !tx.isDuplicate && !tx.isInternalTransfer)
          .map((tx) => ({
            organization_id: orgId,
            account_code: tx.classifiedAccount ?? "unclassified",
            month: `${tx.date.substring(0, 7)}-01`,
            entry_type: "realizado",
            amount: tx.type === "debit" ? -Math.abs(tx.amount) : Math.abs(tx.amount),
            source: "open_finance",
            notes: tx.description,
          }))

        if (txRecords.length > 0) {
          await admin.from("transactions").insert(txRecords)
        }

        // Run decision engine for each transaction
        for (const tx of txRecords) {
          await runDecisionCycle(orgId, {
            type: "webhook",
            event: "transaction_created",
            data: {
              description: tx.notes,
              amount: tx.amount,
              accountCode: tx.account_code,
              month: tx.month.slice(0, 7),
            },
          })
        }

        // Detect anomalies
        const currentMonth = now.toISOString().slice(0, 7)
        const anomalies = await detectAnomalies(orgId, currentMonth)
        const criticals = anomalies.filter((a) => a.severity === "critical")
        const hasCriticalAnomaly = criticals.length > 0

        await admin.from("audit_log").insert({
          organization_id: orgId,
          action: "n8n_process_transaction",
          entity_type: "transactions",
          new_value: {
            total: txRecords.length,
            anomalies: anomalies.length,
            criticals: criticals.length,
          },
        })

        return NextResponse.json({
          processed: true,
          event,
          transactionsCount: txRecords.length,
          anomaliesCount: anomalies.length,
          hasCriticalAnomaly,
          alertMessage: hasCriticalAnomaly ? criticals[0].message : null,
          alertTitle: hasCriticalAnomaly ? criticals[0].title : null,
          alertHtml: hasCriticalAnomaly
            ? `<h2>${criticals[0].title}</h2><p>${criticals[0].message}</p>`
            : null,
        })
      }

      default:
        return NextResponse.json({ processed: false, event, reason: "Unknown event" })
    }
  } catch (error) {
    console.error("[Agent/ProcessTransaction] Error:", error)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}
