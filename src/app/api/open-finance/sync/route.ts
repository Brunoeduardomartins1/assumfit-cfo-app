import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/supabase/auth-helpers"
import {
  upsertTransactions,
  upsertBankAccount,
  getClassificationRules,
  upsertClassificationRule,
  createAuditEntry,
} from "@/lib/supabase/queries"

/**
 * POST /api/open-finance/sync
 * Receives bank transactions (from Pluggy or manual) and persists them.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
    }

    const { transactions, bankAccount } = await request.json()

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json({ error: "transactions obrigatorio" }, { status: 400 })
    }

    const orgId = auth.orgId

    // Save bank account if provided
    if (bankAccount) {
      await upsertBankAccount(orgId, {
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
    }

    // Load classification rules for auto-classifying
    const rules = await getClassificationRules(orgId)

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
            await upsertClassificationRule(orgId, {
              pattern: keyword,
              account_code: accountCode,
              confidence: tx.categoryConfidence === "high" ? 0.9 : 0.7,
              source: "auto_learn",
            })
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

    if (txRecords.length > 0) {
      await upsertTransactions(orgId, txRecords)
    }

    // Audit log
    await createAuditEntry(orgId, {
      user_id: auth.userId,
      action: "sync_open_finance",
      entity_type: "transactions",
      new_value: {
        total: txRecords.length,
        classified,
        source: bankAccount?.bankName ?? "Open Finance",
      },
    })

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
