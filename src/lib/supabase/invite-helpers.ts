import { createAdminClient } from "./admin"

/**
 * Accept the most recent pending invite for a given email.
 * Called from /api/auth/setup BEFORE creating a new org.
 * Returns { orgId, role } if an invite was found and accepted, or null.
 */
export async function acceptPendingInvite(
  userId: string,
  email: string
): Promise<{ orgId: string; role: string } | null> {
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from("organization_invites")
    .select("id, organization_id, role")
    .eq("invited_email", email.toLowerCase())
    .eq("invite_status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!invite) return null

  // Update profile to join the org
  const { error: profErr } = await admin.from("profiles").upsert({
    id: userId,
    organization_id: invite.organization_id,
    role: invite.role,
  })
  if (profErr) {
    console.error("acceptPendingInvite profile upsert error:", profErr)
    return null
  }

  // Mark invite as accepted
  await admin
    .from("organization_invites")
    .update({ invite_status: "accepted", user_id: userId })
    .eq("id", invite.id)

  // Audit log
  await admin.from("audit_log").insert({
    organization_id: invite.organization_id,
    user_id: userId,
    action: "invite_accepted",
    entity_type: "organization_invites",
    entity_id: invite.id,
    new_value: { email, role: invite.role },
  })

  return { orgId: invite.organization_id, role: invite.role }
}

/**
 * Accept a specific invite by token.
 * Called from /convite/[token] page after user is authenticated.
 * Validates that the email matches the invite.
 */
export async function acceptInviteByToken(
  userId: string,
  email: string,
  token: string
): Promise<
  | { success: true; orgId: string; role: string }
  | { success: false; reason: "not_found" | "expired" | "already_used" | "email_mismatch" }
> {
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from("organization_invites")
    .select("id, organization_id, role, invited_email, invite_status, expires_at")
    .eq("invite_token", token)
    .single()

  if (!invite) {
    return { success: false, reason: "not_found" }
  }

  if (invite.invite_status === "accepted") {
    return { success: false, reason: "already_used" }
  }

  if (invite.invite_status === "revoked" || invite.invite_status === "expired") {
    return { success: false, reason: "expired" }
  }

  if (new Date(invite.expires_at) < new Date()) {
    await admin
      .from("organization_invites")
      .update({ invite_status: "expired" })
      .eq("id", invite.id)
    return { success: false, reason: "expired" }
  }

  if (invite.invited_email.toLowerCase() !== email.toLowerCase()) {
    return { success: false, reason: "email_mismatch" }
  }

  // Update profile to join the org
  const { error: profErr } = await admin.from("profiles").upsert({
    id: userId,
    organization_id: invite.organization_id,
    role: invite.role,
  })
  if (profErr) {
    console.error("acceptInviteByToken profile upsert error:", profErr)
    return { success: false, reason: "not_found" }
  }

  // Mark invite as accepted
  await admin
    .from("organization_invites")
    .update({ invite_status: "accepted", user_id: userId })
    .eq("id", invite.id)

  // Audit log
  await admin.from("audit_log").insert({
    organization_id: invite.organization_id,
    user_id: userId,
    action: "invite_accepted",
    entity_type: "organization_invites",
    entity_id: invite.id,
    new_value: { email, role: invite.role, token },
  })

  return { success: true, orgId: invite.organization_id, role: invite.role }
}
