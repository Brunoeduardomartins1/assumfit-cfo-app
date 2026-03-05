import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { pluggyProvider } from "@/lib/open-finance/pluggy-client"

const CANONICAL_ORG_ID = "d6c324a8-3b33-43a4-9756-9091154387bc"

/**
 * Authenticate with Pluggy REST API and return an API key.
 */
async function getPluggyApiKey(): Promise<string> {
  const clientId = process.env.PLUGGY_CLIENT_ID?.trim()
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET?.trim()

  console.log(`[force-sync] Authenticating with Pluggy (clientId: ${clientId?.slice(0, 8)}...)`)

  const res = await fetch("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
    cache: "no-store",
  })

  const responseText = await res.text()

  if (!res.ok) {
    console.error(`[force-sync] Pluggy auth failed: ${res.status}`, responseText)
    throw new Error(`Pluggy auth failed: ${res.status} ${responseText}`)
  }

  const data = JSON.parse(responseText)
  console.log(`[force-sync] Pluggy auth success, apiKey starts with: ${data.apiKey?.slice(0, 8)}...`)
  return data.apiKey
}

/**
 * List all items from Pluggy REST API.
 */
async function listPluggyItems(apiKey: string) {
  const res = await fetch("https://api.pluggy.ai/items", {
    headers: { "X-API-KEY": apiKey },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Pluggy list items failed: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  return data.results ?? []
}

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

    const apiKey = await getPluggyApiKey()
    const admin = createAdminClient()

    // List all connected items via REST API
    const items = await listPluggyItems(apiKey)

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
      const itemId = item.id as string
      const institutionName = (item.connector?.name ?? item.institutionName ?? "Banco") as string

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
