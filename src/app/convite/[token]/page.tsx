import { createAdminClient } from "@/lib/supabase/admin"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { acceptInviteByToken } from "@/lib/supabase/invite-helpers"
import AcceptInviteClient from "./accept-invite-client"

interface Props {
  params: Promise<{ token: string }>
}

export default async function ConvitePage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  // Fetch the invite
  const { data: invite } = await admin
    .from("organization_invites")
    .select("id, organization_id, invited_email, role, invite_status, expires_at, organizations!inner(name)")
    .eq("invite_token", token)
    .single()

  if (!invite) {
    return <AcceptInviteClient status="not_found" token={token} />
  }

  if (invite.invite_status === "accepted") {
    return <AcceptInviteClient status="already_used" token={token} />
  }

  if (invite.invite_status === "revoked") {
    return <AcceptInviteClient status="revoked" token={token} />
  }

  if (invite.invite_status === "expired" || new Date(invite.expires_at) < new Date()) {
    return <AcceptInviteClient status="expired" token={token} />
  }

  const org = (invite as Record<string, unknown>).organizations as { name: string } | null
  const orgName = org?.name ?? "Organizacao"

  // Check if user is logged in
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Not logged in — show login/signup buttons
    return (
      <AcceptInviteClient
        status="needs_auth"
        token={token}
        orgName={orgName}
        role={invite.role}
        invitedEmail={invite.invited_email}
      />
    )
  }

  // User is logged in — check email match
  if (user.email?.toLowerCase() !== invite.invited_email.toLowerCase()) {
    return (
      <AcceptInviteClient
        status="email_mismatch"
        token={token}
        orgName={orgName}
        invitedEmail={invite.invited_email}
        currentEmail={user.email ?? ""}
      />
    )
  }

  // Accept the invite
  const result = await acceptInviteByToken(user.id, user.email!, token)

  if (result.success) {
    return <AcceptInviteClient status="accepted" token={token} orgName={orgName} />
  }

  // Fallback for unexpected errors
  return <AcceptInviteClient status="not_found" token={token} />
}
