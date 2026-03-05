import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/supabase/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/open-finance/sync
 * Receives bank transactions (from Pluggy or manual) and persists them.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth

    const { transactions, bankAccount } = await request.json()

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json({ error: "transactions obrigatorio" }, { status: 400 })
    }

    const orgId = auth.orgId

    // Save bank account using admin client (bypasses RLS)
    if (bankAccount) {
      const admin = createAdminClient()
      const { error: bankErr } = await admin
        .from("bank_accounts")
        .upsert(
          {
            organization_id: orgId,
            provider: bankAccount.provider ?? "pluggy",
            provider_account_id: bankAccount.providerAccountId ?? bankAccount.id,
            bank_name: bankAccount.bankName ?? bankAccount.institutionName ?? "Banco",
            account_type: bankAccount.type ?? "checking",
            account_number: bankAccount.number ?? null,
            balance: bankAccount.balance ?? null,
            last_sync: new Date().toISOString(),
            connection_status: "connected",
            pluggy_item_id: bankAccount.pluggyItemId ?? null,
          },
          { onConflict: "organization_id,provider_account_id" }
        )
      if (bankErr) {
        console.error("[sync] Error saving bank account:", bankErr)
        // Try insert as fallback (no unique constraint may exist)
        const { error: insertErr } = await admin
          .from("bank_accounts")
          .insert({
            organization_id: orgId,
            provider: bankAccount.provider ?? "pluggy",
            provider_account_id: bankAccount.providerAccountId ?? bankAccount.id,
            bank_name: bankAccount.bankName ?? bankAccount.institutionName ?? "Banco",
            account_type: bankAccount.type ?? "checking",
            account_number: bankAccount.number ?? null,
            balance: bankAccount.balance ?? null,
            last_sync: new Date().toISOString(),
            connection_status: "connected",
            pluggy_item_id: bankAccount.pluggyItemId ?? null,
          })
        if (insertErr) {
          console.error("[sync] Error inserting bank account:", insertErr)
        }
      }
    }

    // Load classification rules for auto-classifying (using admin client)
    const adminForRules = createAdminClient()
    const { data: rulesData } = await adminForRules
      .from("classification_rules")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at")
    const rules = (rulesData ?? []) as Array<{ pattern: string; account_code: string }>

    // Classify and convert to transaction records
    const txRecords: Array<{
      account_code: string
      month: string
      entry_type: "estimado" | "realizado"
      amount: number
      source: "open_finance"
      notes: string | null
      created_by: string | null
    }> = []

    let classified = 0

    for (const tx of transactions) {
      let accountCode = tx.classifiedAccount ?? tx.account_code ?? "unclassified"

      // Try to classify using rules
      if (accountCode === "unclassified" && tx.description) {
        for (const rule of rules) {
          if (tx.description.toLowerCase().includes(rule.pattern.toLowerCase())) {
            accountCode = rule.account_code
            classified++
            break
          }
        }
      } else if (accountCode !== "unclassified") {
        classified++
      }

      // Learn new classification rules from classified transactions
      if (accountCode !== "unclassified" && tx.description) {
        const keyword = tx.description.split(" ").slice(0, 3).join(" ").toUpperCase()
        const existingRule = rules.find((r) => r.pattern === keyword)
        if (!existingRule) {
          try {
            await adminForRules
              .from("classification_rules")
              .upsert({
                organization_id: orgId,
                pattern: keyword,
                account_code: accountCode,
                confidence: tx.categoryConfidence === "high" ? 0.9 : 0.7,
                source: "auto_learn",
              }, { onConflict: "organization_id,pattern" })
          } catch {
            // Non-blocking
          }
        }
      }

      const monthKey = (tx.date ?? tx.month ?? "").substring(0, 7)
      if (!monthKey) continue

      txRecords.push({
        account_code: accountCode,
        month: `${monthKey}-01`,
        entry_type: "realizado",
        amount: tx.type === "debit" ? -Math.abs(tx.amount) : Math.abs(tx.amount),
        source: "open_finance",
        notes: tx.description ?? null,
        created_by: auth.userId,
      })
    }

    // Save transactions using admin client (bypasses RLS)
    if (txRecords.length > 0) {
      const admin = createAdminClient()
      const records = txRecords.map((r) => ({
        ...r,
        organization_id: orgId,
        updated_at: new Date().toISOString(),
      }))
      for (let i = 0; i < records.length; i += 500) {
        const chunk = records.slice(i, i + 500)
        const { error: txErr } = await admin
          .from("transactions")
          .upsert(chunk, { onConflict: "organization_id,account_code,month,entry_type" })
        if (txErr) {
          console.error("[sync] Error saving transactions:", txErr)
        }
      }
    }

    // Audit log using admin client
    try {
      const admin = createAdminClient()
      await admin.from("audit_log").insert({
        organization_id: orgId,
        user_id: auth.userId,
        action: "sync_open_finance",
        entity_type: "transactions",
        new_value: {
          total: txRecords.length,
          classified,
          source: bankAccount?.bankName ?? "Open Finance",
        },
      })
    } catch {
      // Non-blocking
    }

    return NextResponse.json({
      synced: txRecords.length,
      classified,
      total: transactions.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 }
    )
  }
}
