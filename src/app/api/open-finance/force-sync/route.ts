import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { pluggyProvider } from "@/lib/open-finance/pluggy-client"
import { PluggyClient } from "pluggy-sdk"

const CANONICAL_ORG_ID = "d6c324a8-3b33-43a4-9756-9091154387bc"

/**
 * POST /api/open-finance/force-sync
 * Body: { itemId: string }
 * Fetches accounts + transactions from a specific Pluggy item and saves to Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    const { itemId } = await request.json()

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId obrigatório" }, { status: 400 })
    }

    const clientId = process.env.PLUGGY_CLIENT_ID?.trim()
    const clientSecret = process.env.PLUGGY_CLIENT_SECRET?.trim()
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET não configurados" },
        { status: 500 }
      )
    }

    const pluggy = new PluggyClient({ clientId, clientSecret })
    const admin = createAdminClient()

    // Fetch the item to get institution name
    console.log(`[force-sync] Fetching item ${itemId}`)
    const item = await pluggy.fetchItem(itemId)
    const institutionName = item.connector?.name ?? "Banco"

    console.log(`[force-sync] Item found: ${institutionName} (status: ${item.status})`)

    // Fetch accounts for this item
    const accounts = await pluggyProvider.getAccounts(itemId)
    console.log(`[force-sync] Found ${accounts.length} account(s)`)

    const now = new Date()
    const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const to = now.toISOString().split("T")[0]

    let totalTransactions = 0
    const errors: string[] = []

    for (const acc of accounts) {
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
        console.error(`[force-sync] Upsert failed for ${acc.id}, trying insert:`, bankErr)
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

      // Fetch transactions
      let transactions
      try {
        transactions = await pluggyProvider.getTransactions(acc.id, from, to)
      } catch (err) {
        const msg = `Error fetching transactions for account ${acc.id}: ${err}`
        console.error(`[force-sync] ${msg}`)
        errors.push(msg)
        continue
      }

      console.log(`[force-sync] Account ${acc.name}: ${transactions.length} transactions`)
      totalTransactions += transactions.length

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

      for (let i = 0; i < txRecords.length; i += 500) {
        const chunk = txRecords.slice(i, i + 500)
        const { error: txErr } = await admin
          .from("transactions")
          .upsert(chunk, { onConflict: "organization_id,account_code,month,entry_type" })
        if (txErr) {
          console.error(`[force-sync] Error saving transactions:`, txErr)
          errors.push(`Error saving transactions for ${acc.id}: ${txErr.message}`)
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
          itemId,
          institution: institutionName,
          accounts: accounts.length,
          transactions: totalTransactions,
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      itemId,
      institution: institutionName,
      accounts: accounts.length,
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
