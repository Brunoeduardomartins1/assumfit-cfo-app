import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { pluggyProvider, classifyTransactions, flagDuplicates } from "@/lib/open-finance"
import { createHmac } from "crypto"

type PluggyEvent =
  | "item/created"
  | "item/updated"
  | "item/error"
  | "item/deleted"
  | "transactions/created"

interface WebhookPayload {
  id: string
  event: PluggyEvent
  itemId?: string
  accountId?: string
  transactionsCreatedAtFrom?: string
  error?: { code: string; message: string }
}

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.PLUGGY_WEBHOOK_SECRET
  if (!secret) return true // skip in dev
  if (!signature) return false
  const expected = createHmac("sha256", secret).update(body).digest("hex")
  return signature === expected
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-pluggy-signature")

  if (!verifySignature(rawBody, signature)) {
    console.warn("Pluggy webhook: invalid signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  console.log(`Pluggy webhook: ${payload.event} (itemId: ${payload.itemId})`)

  const admin = createAdminClient()

  try {
    switch (payload.event) {
      case "item/updated": {
        if (payload.itemId) {
          await admin
            .from("bank_accounts")
            .update({
              connection_status: "connected",
              last_sync: new Date().toISOString(),
            })
            .eq("pluggy_item_id", payload.itemId)
        }
        break
      }

      case "item/error": {
        if (payload.itemId) {
          await admin
            .from("bank_accounts")
            .update({ connection_status: "error" })
            .eq("pluggy_item_id", payload.itemId)

          const { data: bankAccount } = await admin
            .from("bank_accounts")
            .select("organization_id, bank_name")
            .eq("pluggy_item_id", payload.itemId)
            .single()

          if (bankAccount) {
            await admin.from("alerts").insert({
              organization_id: bankAccount.organization_id,
              type: "anomaly",
              severity: "warning",
              title: `Erro na conexao: ${bankAccount.bank_name}`,
              message:
                payload.error?.message ??
                "A conexao bancaria encontrou um erro. Reconecte para continuar sincronizando.",
            })
          }
        }
        break
      }

      case "transactions/created": {
        if (payload.itemId && payload.accountId) {
          const { data: bankAccount } = await admin
            .from("bank_accounts")
            .select("organization_id")
            .eq("pluggy_item_id", payload.itemId)
            .single()

          if (bankAccount) {
            const now = new Date()
            const from =
              payload.transactionsCreatedAtFrom ??
              new Date(now.getFullYear(), now.getMonth(), 1)
                .toISOString()
                .split("T")[0]
            const to = now.toISOString().split("T")[0]

            let txs = await pluggyProvider.getTransactions(
              payload.accountId,
              from,
              to
            )
            txs = classifyTransactions(txs)
            txs = flagDuplicates(txs)

            const orgId = bankAccount.organization_id
            const txRecords = txs
              .filter((tx) => !tx.isDuplicate && !tx.isInternalTransfer)
              .map((tx) => ({
                organization_id: orgId,
                account_code: tx.classifiedAccount ?? "unclassified",
                month: `${tx.date.substring(0, 7)}-01`,
                entry_type: "realizado",
                amount:
                  tx.type === "debit"
                    ? -Math.abs(tx.amount)
                    : Math.abs(tx.amount),
                source: "open_finance",
                notes: tx.description,
              }))

            if (txRecords.length > 0) {
              await admin.from("transactions").insert(txRecords)
            }

            await admin.from("audit_log").insert({
              organization_id: orgId,
              action: "webhook_auto_sync",
              entity_type: "transactions",
              new_value: {
                total: txRecords.length,
                event: payload.event,
                itemId: payload.itemId,
              },
            })

            console.log(
              `Auto-synced ${txRecords.length} transactions for org ${orgId}`
            )
          }
        }
        break
      }

      case "item/deleted": {
        if (payload.itemId) {
          await admin
            .from("bank_accounts")
            .update({ connection_status: "disconnected" })
            .eq("pluggy_item_id", payload.itemId)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook processing error:", error)
    return NextResponse.json({ received: true, warning: "Processing error logged" })
  }
}
