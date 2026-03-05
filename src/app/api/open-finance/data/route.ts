import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/supabase/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * GET /api/open-finance/data
 * Returns bank accounts and open_finance transactions for the authenticated user's org.
 * Uses admin client to bypass RLS.
 */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (auth instanceof Response) return auth

    const admin = createAdminClient()
    const orgId = auth.orgId

    const [accountsResult, txResult] = await Promise.all([
      admin
        .from("bank_accounts")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at"),
      admin
        .from("transactions")
        .select("*")
        .eq("organization_id", orgId)
        .eq("source", "open_finance")
        .order("month")
        .order("account_code"),
    ])

    if (accountsResult.error) {
      console.error("[open-finance/data] bank_accounts error:", accountsResult.error)
    }
    if (txResult.error) {
      console.error("[open-finance/data] transactions error:", txResult.error)
    }

    return NextResponse.json({
      bankAccounts: accountsResult.data ?? [],
      transactions: txResult.data ?? [],
    })
  } catch (error) {
    console.error("[open-finance/data] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 }
    )
  }
}
