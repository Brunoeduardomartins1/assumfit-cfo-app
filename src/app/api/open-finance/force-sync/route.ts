import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { pluggyProvider } from "@/lib/open-finance/pluggy-client"
import { PluggyClient } from "pluggy-sdk"

const CANONICAL_ORG_ID = "d6c324a8-3b33-43a4-9756-9091154387bc"

/**
 * GET /api/open-finance/force-sync
 * Re-syncs ALL Pluggy items directly from the Pluggy API into Supabase.
 */
export async function GET() {
  try {
    const clientId = process.env.PLUGGY_CLIENT_ID
    const clientSecret = process.env.PLUGGY_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET não configurados" },
        { status: 500 }
      )
    }

    const pluggy = new PluggyClient({ clientId, clientSecret })
    const admin = createAdminClient()

    // List all connected items
    const itemsResponse = await pluggy.fetchItems()
    const items = itemsResponse.results ?? []

    if (items.length === 0) {
      return NextResponse.json({ message: "Nenhum item conectado na Pluggy", items: 0, accounts: 0, transactions: 0 })
    }

    const now = new Date()
    const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const to = now.toISOString().split("T")[0]

    let totalAccounts = 0
    let totalTransactions = 0
    const errors: string[] = []

    for (const item of items) {
      const itemId = item.id
      const institutionName = item.connector?.name ?? "Banco"

      console.log(`[force-sync] Processing item ${itemId} (${institutionName})`)

      // Fetch accounts for this item
      let accounts
      try {
        accounts = await pluggyProvider.getAccounts(itemId)
      } catch (err) {
        const msg = `Error fetching accounts for item ${itemId}: ${err}`
        console.error(`[force-sync] ${msg}`)
        errors.push(msg)
        continue
      }

      for (const acc of accounts) {
        totalAccounts++

        // Save bank account
        const { error: bankErr } = await admin
          .from("bank_accounts")
          .upsert(
            {
              organization_id: CANONICAL_ORG_ID,
              provider: "pluggy",
              provider_account_id: acc.id,
              bank_name: institutionName,
              account_type: acc.type,
              account_number: acc.number ?? null,
              balance: acc.balance,
              last_sync: new Date().toISOString(),
              connection_status: "connected",
              pluggy_item_id: itemId,
            },
            { onConflict: "organization_id,provider_account_id" }
          )

        if (bankErr) {
          console.error(`[force-sync] Error saving account ${acc.id}:`, bankErr)
          // Fallback insert
          await admin.from("bank_accounts").insert({
            organization_id: CANONICAL_ORG_ID,
            provider: "pluggy",
            provider_account_id: acc.id,
            bank_name: institutionName,
            account_type: acc.type,
            account_number: acc.number ?? null,
            balance: acc.balance,
            last_sync: new Date().toISOString(),
            connection_status: "connected",
            pluggy_item_id: itemId,
          })
        }

        // Fetch transactions for this account
        let transactions
        try {
          transactions = await pluggyProvider.getTransactions(acc.id, from, to)
        } catch (err) {
          const msg = `Error fetching transactions for account ${acc.id}: ${err}`
          console.error(`[force-sync] ${msg}`)
          errors.push(msg)
          continue
        }

        totalTransactions += transactions.length

        // Convert and save transactions
        const txRecords = transactions
          .map((tx) => {
            const monthKey = tx.date?.substring(0, 7)
            if (!monthKey) return null
            return {
              organization_id: CANONICAL_ORG_ID,
              account_code: tx.classifiedAccount ?? "unclassified",
              month: `${monthKey}-01`,
              entry_type: "realizado" as const,
              amount: tx.type === "debit" ? -Math.abs(tx.amount) : Math.abs(tx.amount),
              source: "open_finance" as const,
              notes: tx.description ?? null,
              created_by: null,
              updated_at: new Date().toISOString(),
            }
          })
          .filter(Boolean)

        // Save in chunks of 500
        for (let i = 0; i < txRecords.length; i += 500) {
          const chunk = txRecords.slice(i, i + 500)
          const { error: txErr } = await admin
            .from("transactions")
            .upsert(chunk, { onConflict: "organization_id,account_code,month,entry_type" })
          if (txErr) {
            console.error(`[force-sync] Error saving transactions chunk:`, txErr)
            errors.push(`Error saving transactions for account ${acc.id}: ${txErr.message}`)
          }
        }
      }
    }

    // Audit log
    try {
      await admin.from("audit_log").insert({
        organization_id: CANONICAL_ORG_ID,
        user_id: null,
        action: "force_sync_open_finance",
        entity_type: "transactions",
        new_value: {
          items: items.length,
          accounts: totalAccounts,
          transactions: totalTransactions,
          errors: errors.length,
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      items: items.length,
      accounts: totalAccounts,
      transactions: totalTransactions,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("[force-sync] Fatal error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 }
    )
  }
}
