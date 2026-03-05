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

  // Use admin client to query profiles (bypasses RLS, avoids recursion)
  const admin = createAdminClient()
  const { data: profile } = await admin
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
 * Always consolidates all users into the oldest org (the one that has the data).
 */
export async function setupUserOrg(
  userId: string,
  fullName: string,
  email: string
) {
  const admin = createAdminClient()

  // Find the canonical org — the oldest one (has the data)
  const { data: canonicalOrg } = await admin
    .from("organizations")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .single()

  // Check if profile already exists
  const { data: existing } = await admin
    .from("profiles")
    .select("id, organization_id")
    .eq("id", userId)
    .single()

  if (canonicalOrg) {
    const targetOrgId = canonicalOrg.id as string

    // Always consolidate ALL other orgs into the canonical one
    await consolidateAllOrgs(admin, targetOrgId)

    // User exists but is in a DIFFERENT org — reassign
    if (!existing?.organization_id || existing.organization_id !== targetOrgId) {
      const { error: profErr } = await admin.from("profiles").upsert({
        id: userId,
        organization_id: targetOrgId,
        full_name: fullName || undefined,
        role: "owner",
      })
      if (profErr) throw profErr
    }

    return { orgId: targetOrgId, created: false, autoJoined: true }
  }

  // No org exists yet — create one
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

/**
 * Consolidate ALL orgs into the canonical one.
 * Migrates data from every non-canonical org so all users see all data.
 */
async function consolidateAllOrgs(
  admin: ReturnType<typeof createAdminClient>,
  targetOrgId: string
) {
  // Find all orgs that are NOT the canonical one
  const { data: otherOrgs, error: findErr } = await admin
    .from("organizations")
    .select("id")
    .neq("id", targetOrgId)

  if (findErr) {
    console.error("[consolidateAllOrgs] Error finding orgs:", findErr)
    return
  }

  if (!otherOrgs || otherOrgs.length === 0) return

  console.log(`[consolidateAllOrgs] Migrating ${otherOrgs.length} org(s) into ${targetOrgId}`)

  const tables = [
    "bank_accounts",
    "transactions",
    "income_statement",
    "chart_of_accounts",
    "scenarios",
    "audit_log",
    "alerts",
  ]

  for (const org of otherOrgs) {
    const oldOrgId = org.id as string
    console.log(`[consolidateAllOrgs] Migrating org ${oldOrgId} → ${targetOrgId}`)

    for (const table of tables) {
      const { error, count } = await admin
        .from(table)
        .update({ organization_id: targetOrgId })
        .eq("organization_id", oldOrgId)

      if (error) {
        console.error(`[consolidateAllOrgs] Error migrating ${table}:`, error)
      } else if (count && count > 0) {
        console.log(`[consolidateAllOrgs] Migrated ${count} rows in ${table}`)
      }
    }

    // Move profiles from old org
    const { error: profErr } = await admin
      .from("profiles")
      .update({ organization_id: targetOrgId })
      .eq("organization_id", oldOrgId)

    if (profErr) {
      console.error("[consolidateAllOrgs] Error migrating profiles:", profErr)
    }
  }
}
