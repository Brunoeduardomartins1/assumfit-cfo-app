import { createServerSupabaseClient } from "./server"
import { createAdminClient } from "./admin"

/**
 * Server-side: get the authenticated user and their orgId.
 * Use in API routes and server components.
 */
export async function getAuthContext() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, full_name, role")
    .eq("id", user.id)
    .single()

  return {
    userId: user.id,
    email: user.email ?? "",
    orgId: profile?.organization_id ?? null,
    fullName: profile?.full_name ?? null,
    role: (profile?.role as string) ?? "viewer",
  }
}

/**
 * For API routes: get auth context or return 401 Response.
 * Usage: const auth = await requireAuth(); if (auth instanceof Response) return auth;
 */
export async function requireAuth(): Promise<
  | { userId: string; orgId: string; email: string; fullName: string | null; role: string }
  | Response
> {
  const ctx = await getAuthContext()
  if (!ctx || !ctx.orgId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }
  return ctx as { userId: string; orgId: string; email: string; fullName: string | null; role: string }
}

/**
 * Create organization + profile for a new user (uses admin client to bypass RLS).
 */
export async function setupUserOrg(
  userId: string,
  fullName: string,
  email: string
) {
  const admin = createAdminClient()

  // Check if profile already exists
  const { data: existing } = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("id", userId)
    .single()

  if (existing?.organization_id) {
    return { orgId: existing.organization_id, created: false }
  }

  // Create organization
  const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-")
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: fullName ? `${fullName}'s Org` : "Minha Empresa", slug: `${slug}-${Date.now()}` })
    .select()
    .single()
  if (orgErr) throw orgErr

  // Upsert profile
  const { error: profErr } = await admin.from("profiles").upsert({
    id: userId,
    organization_id: org.id,
    full_name: fullName,
    role: "owner",
  })
  if (profErr) throw profErr

  return { orgId: org.id as string, created: true }
}
