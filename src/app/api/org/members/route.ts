import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/supabase/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof Response) return auth

  const admin = createAdminClient()

  // Get profiles in the org
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("organization_id", auth.orgId)
    .order("created_at", { ascending: true })

  // Get email for each profile from auth.users
  const members: Array<{
    id: string
    fullName: string | null
    email: string
    role: string
    createdAt: string
  }> = []

  if (profiles && profiles.length > 0) {
    const { data: authData } = await admin.auth.admin.listUsers()
    const userMap = new Map<string, string>()
    if (authData?.users) {
      for (const u of authData.users) {
        userMap.set(u.id, u.email ?? "")
      }
    }

    for (const p of profiles) {
      members.push({
        id: p.id,
        fullName: p.full_name,
        email: userMap.get(p.id) ?? "",
        role: p.role,
        createdAt: p.created_at,
      })
    }
  }

  // Get pending invites
  const { data: invites } = await admin
    .from("organization_invites")
    .select("id, invited_email, role, invite_status, created_at, expires_at")
    .eq("organization_id", auth.orgId)
    .eq("invite_status", "pending")
    .order("created_at", { ascending: false })

  return NextResponse.json({
    members,
    invites: invites ?? [],
    currentUserId: auth.userId,
    currentRole: auth.role,
  })
}
