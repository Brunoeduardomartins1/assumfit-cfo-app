import { NextRequest, NextResponse } from "next/server"
import { setupUserOrg } from "@/lib/supabase/auth-helpers"
import { acceptPendingInvite } from "@/lib/supabase/invite-helpers"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const { userId, fullName, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ error: "userId and email required" }, { status: 400 })
    }

    // Check for pending invites first
    const inviteResult = await acceptPendingInvite(userId, email)

    // ALWAYS run setupUserOrg — it consolidates all orgs into one
    // Even if invite was accepted, consolidation must run
    const result = await setupUserOrg(userId, fullName ?? "", email)

    // Fetch the user's profile to return full context (bypasses RLS)
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, role")
      .eq("id", userId)
      .single()

    return NextResponse.json({
      ...result,
      fullName: profile?.full_name ?? fullName ?? null,
      role: profile?.role ?? "owner",
      inviteAccepted: !!inviteResult,
    })
  } catch (error) {
    console.error("Auth setup error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao configurar conta" },
      { status: 500 }
    )
  }
}
