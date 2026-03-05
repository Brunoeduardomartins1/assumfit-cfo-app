import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const admin = createAdminClient()

  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name, created_at")
    .order("created_at", { ascending: true })

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, organization_id, full_name, role")

  const { data: bankAccounts } = await admin
    .from("bank_accounts")
    .select("id, organization_id, bank_name, connection_status, balance")

  const { data: txCount } = await admin
    .from("transactions")
    .select("organization_id")

  const txByOrg: Record<string, number> = {}
  for (const tx of txCount ?? []) {
    txByOrg[tx.organization_id] = (txByOrg[tx.organization_id] ?? 0) + 1
  }

  return NextResponse.json({
    organizations: orgs,
    profiles: profiles?.map((p) => ({
      id: p.id?.slice(0, 8),
      org: p.organization_id?.slice(0, 8),
      name: p.full_name,
      role: p.role,
    })),
    bankAccounts: bankAccounts?.map((b) => ({
      id: b.id?.slice(0, 8),
      org: b.organization_id?.slice(0, 8),
      bank: b.bank_name,
      status: b.connection_status,
      balance: b.balance,
    })),
    transactionsByOrg: Object.fromEntries(
      Object.entries(txByOrg).map(([k, v]) => [k.slice(0, 8), v])
    ),
    canonicalOrg: orgs?.[0]?.id?.slice(0, 8),
    totalOrgs: orgs?.length,
  })
}
