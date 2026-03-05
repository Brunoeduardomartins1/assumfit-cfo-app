import { NextRequest, NextResponse } from "next/server"
import { getAuthContext } from "@/lib/supabase/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgCode } = (await request.json()) as { orgCode?: string }
  if (!orgCode || orgCode.trim().length < 4) {
    return NextResponse.json({ error: "Codigo da org invalido" }, { status: 400 })
  }

  const admin = createAdminClient()
  const code = orgCode.trim().toLowerCase()

  // Find org by slug prefix or id prefix
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name")

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ error: "Organizacao nao encontrada" }, { status: 404 })
  }

  // Match by first 8 chars of UUID or slug
  const target = orgs.find(
    (o) => o.id.slice(0, 8).toLowerCase() === code || o.id.toLowerCase() === code
  )

  if (!target) {
    return NextResponse.json({ error: "Organizacao nao encontrada" }, { status: 404 })
  }

  if (ctx.orgId === target.id) {
    return NextResponse.json({ error: "Voce ja esta nesta organizacao" }, { status: 409 })
  }

  // Update profile to join the target org
  const { error: profErr } = await admin
    .from("profiles")
    .update({ organization_id: target.id, role: "owner" })
    .eq("id", ctx.userId)

  if (profErr) {
    console.error("Join org error:", profErr)
    return NextResponse.json({ error: "Erro ao entrar na org" }, { status: 500 })
  }

  // Audit log
  await admin.from("audit_log").insert({
    organization_id: target.id,
    user_id: ctx.userId,
    action: "org_joined",
    entity_type: "organizations",
    entity_id: target.id,
    new_value: { from_org: ctx.orgId, to_org: target.id },
  })

  return NextResponse.json({ success: true, orgId: target.id, orgName: target.name })
}
