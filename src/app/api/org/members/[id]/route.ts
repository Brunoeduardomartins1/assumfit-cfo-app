import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/supabase/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (auth instanceof Response) return auth

  if (!["owner", "admin"].includes(auth.role)) {
    return NextResponse.json(
      { error: "Apenas owner ou admin podem remover membros" },
      { status: 403 }
    )
  }

  const { id } = await params
  const body = await request.json()
  const { type } = body as { type: "member" | "invite" }

  const admin = createAdminClient()

  if (type === "invite") {
    // Revoke invite
    const { error } = await admin
      .from("organization_invites")
      .update({ invite_status: "revoked" })
      .eq("id", id)
      .eq("organization_id", auth.orgId)

    if (error) {
      return NextResponse.json({ error: "Erro ao revogar convite" }, { status: 500 })
    }

    await admin.from("audit_log").insert({
      organization_id: auth.orgId,
      user_id: auth.userId,
      action: "invite_revoked",
      entity_type: "organization_invites",
      entity_id: id,
    })

    return NextResponse.json({ success: true })
  }

  if (type === "member") {
    // Cannot remove yourself
    if (id === auth.userId) {
      return NextResponse.json({ error: "Voce nao pode se remover" }, { status: 400 })
    }

    // Check target role — cannot remove owner
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", id)
      .eq("organization_id", auth.orgId)
      .single()

    if (!targetProfile) {
      return NextResponse.json({ error: "Membro nao encontrado" }, { status: 404 })
    }

    if (targetProfile.role === "owner") {
      return NextResponse.json({ error: "Nao e possivel remover o owner" }, { status: 403 })
    }

    // Create a new personal org for the removed member
    const { data: newOrg, error: orgErr } = await admin
      .from("organizations")
      .insert({ name: "Minha Empresa", slug: `removed-${id.slice(0, 8)}-${Date.now()}` })
      .select()
      .single()

    if (orgErr) {
      return NextResponse.json({ error: "Erro ao remover membro" }, { status: 500 })
    }

    // Move profile to new org
    await admin
      .from("profiles")
      .update({ organization_id: newOrg.id, role: "owner" })
      .eq("id", id)

    await admin.from("audit_log").insert({
      organization_id: auth.orgId,
      user_id: auth.userId,
      action: "member_removed",
      entity_type: "profiles",
      entity_id: id,
      new_value: { removedToOrg: newOrg.id },
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "type deve ser 'member' ou 'invite'" }, { status: 400 })
}
