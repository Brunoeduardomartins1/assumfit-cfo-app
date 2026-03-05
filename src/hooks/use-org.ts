"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface OrgContext {
  orgId: string | null
  userId: string | null
  fullName: string | null
  role: string
  loading: boolean
}

let cachedContext: OrgContext | null = null

// Ensures org consolidation runs once per page load (not on every re-render)
let orgConsolidated = false

// Listeners for force refresh (used by forceRefreshOrg)
const refreshListeners = new Set<() => void>()
let refreshCounter = 0

export function useOrg(): OrgContext {
  const [ctx, setCtx] = useState<OrgContext>(
    cachedContext ?? { orgId: null, userId: null, fullName: null, role: "viewer", loading: true }
  )
  const [, setRefresh] = useState(0)

  useEffect(() => {
    // Register for force refresh
    const listener = () => setRefresh((n) => n + 1)
    refreshListeners.add(listener)

    if (cachedContext && !cachedContext.loading && refreshCounter === 0) {
      setCtx(cachedContext)
      refreshListeners.delete(listener)
      return () => { refreshListeners.delete(listener) }
    }

    // Reset counter after consuming
    refreshCounter = 0

    let cancelled = false
    async function load() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          const result = { orgId: null, userId: null, fullName: null, role: "viewer" as const, loading: false }
          cachedContext = result
          if (!cancelled) setCtx(result)
          return
        }

        // Always ensure user is in the canonical org (consolidates orgs on every page load)
        if (!orgConsolidated) {
          try {
            await fetch("/api/auth/setup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: user.id,
                fullName: user.user_metadata?.full_name ?? "",
                email: user.email,
              }),
            })
            orgConsolidated = true
          } catch {
            // Non-blocking
          }
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id, full_name, role")
          .eq("id", user.id)
          .single()

        const result: OrgContext = {
          orgId: profile?.organization_id ?? null,
          userId: user.id,
          fullName: profile?.full_name ?? null,
          role: (profile?.role as string) ?? "viewer",
          loading: false,
        }
        cachedContext = result
        if (!cancelled) setCtx(result)
      } catch {
        const result = { orgId: null, userId: null, fullName: null, role: "viewer" as const, loading: false }
        cachedContext = result
        if (!cancelled) setCtx(result)
      }
    }

    load()
    return () => {
      cancelled = true
      refreshListeners.delete(listener)
    }
  }, [])

  // Re-fetch when forceRefreshOrg is called
  useEffect(() => {
    const listener = () => {
      cachedContext = null
      refreshCounter++
      // Re-fetch from DB
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase
          .from("profiles")
          .select("organization_id, full_name, role")
          .eq("id", user.id)
          .single()
          .then(({ data: profile }) => {
            const result: OrgContext = {
              orgId: profile?.organization_id ?? null,
              userId: user.id,
              fullName: profile?.full_name ?? null,
              role: (profile?.role as string) ?? "viewer",
              loading: false,
            }
            cachedContext = result
            setCtx(result)
          })
      })
    }
    refreshListeners.add(listener)
    return () => { refreshListeners.delete(listener) }
  }, [])

  return ctx
}

/** Invalidate cached org context (call after login/signup) */
export function invalidateOrgCache() {
  cachedContext = null
}

/** Force all useOrg hooks to re-fetch from DB (call after joining/leaving org) */
export function forceRefreshOrg() {
  cachedContext = null
  orgConsolidated = false
  for (const listener of refreshListeners) {
    listener()
  }
}
