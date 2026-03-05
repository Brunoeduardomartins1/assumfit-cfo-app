import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { requireAuth } from "@/lib/supabase/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/resend-client"
import { buildInviteEmail } from "@/lib/email/templates"

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof Response) return auth

  // Only owner/admin can invite
  if (!["owner", "admin"].includes(auth.role)) {
    return NextResponse.json(
      { error: "Apenas owner ou admin podem convidar membros" },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { email, role } = body as { email?: string; role?: string }

  if (!email || !role) {
    return NextResponse.json({ error: "email e role sao obrigatorios" }, { status: 400 })
  }

  if (!["admin", "editor", "viewer"].includes(role)) {
    return NextResponse.json({ error: "Role invalido. Use admin, editor ou viewer" }, { status: 400 })
  }

  const admin = createAdminClient()
  const normalizedEmail = email.toLowerCase().trim()

  // Check if already a member
  const { data: existingProfiles } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", auth.orgId)

  if (existingProfiles && existingProfiles.length > 0) {
    // Get user emails from auth.users
    const { data: authData } = await admin.auth.admin.listUsers()
    const orgUserIds = new Set(existingProfiles.map((p) => p.id))
    const alreadyMember = authData?.users?.find(
      (u) => orgUserIds.has(u.id) && u.email?.toLowerCase() === normalizedEmail
    )
    if (alreadyMember) {
      return NextResponse.json(
        { error: "Este email ja e membro da organizacao" },
        { status: 409 }
      )
    }
  }

  // Check for existing pending invite
  const { data: existingInvite } = await admin
    .from("organization_invites")
    .select("id")
    .eq("organization_id", auth.orgId)
    .eq("invited_email", normalizedEmail)
    .eq("invite_status", "pending")
    .single()

  if (existingInvite) {
    return NextResponse.json(
      { error: "Ja existe um convite pendente para este email" },
      { status: 409 }
    )
  }

  // Generate token and create invite
  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { error: insertErr } = await admin.from("organization_invites").insert({
    organization_id: auth.orgId,
    invited_email: normalizedEmail,
    role,
    invite_token: token,
    invited_by: auth.userId,
    expires_at: expiresAt.toISOString(),
  })

  if (insertErr) {
    console.error("Invite insert error:", insertErr)
    return NextResponse.json({ error: "Erro ao criar convite" }, { status: 500 })
  }

  // Get org name for the email
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", auth.orgId)
    .single()

  const orgName = org?.name ?? "Organizacao"
  const inviterName = auth.fullName ?? auth.email

  // Send invite email
  try {
    const html = buildInviteEmail({ inviterName, orgName, role, token })
    await sendEmail(normalizedEmail, `Convite para ${orgName} — ASSUMFIT CFO`, html)
  } catch (err) {
    console.error("Invite email error:", err)
    // Don't fail the request — the invite was created
  }

  // Audit log
  await admin.from("audit_log").insert({
    organization_id: auth.orgId,
    user_id: auth.userId,
    action: "invite_sent",
    entity_type: "organization_invites",
    new_value: { email: normalizedEmail, role, token },
  })

  return NextResponse.json({ success: true, token })
}
