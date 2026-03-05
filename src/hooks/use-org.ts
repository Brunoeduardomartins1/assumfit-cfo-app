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

        // Use /api/auth/setup (admin client, bypasses RLS) to get org context
        // This also runs org consolidation
        const setupRes = await fetch("/api/auth/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            fullName: user.user_metadata?.full_name ?? "",
            email: user.email,
          }),
        })

        let orgId: string | null = null
        let fullName: string | null = user.user_metadata?.full_name ?? null
        let role = "viewer"

        if (setupRes.ok) {
          const data = await setupRes.json()
          orgId = data.orgId ?? null
          fullName = data.fullName ?? fullName
          role = data.role ?? "viewer"
        } else {
          console.error("[useOrg] /api/auth/setup failed:", setupRes.status)
        }

        const result: OrgContext = {
          orgId,
          userId: user.id,
          fullName,
          role,
          loading: false,
        }
        cachedContext = result
        if (!cancelled) setCtx(result)
      } catch (err) {
        console.error("[useOrg] Error:", err)
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

      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return

        fetch("/api/auth/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            fullName: user.user_metadata?.full_name ?? "",
            email: user.email,
          }),
        })
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (!data) return
            const result: OrgContext = {
              orgId: data.orgId ?? null,
              userId: user.id,
              fullName: data.fullName ?? user.user_metadata?.full_name ?? null,
              role: data.role ?? "viewer",
              loading: false,
            }
            cachedContext = result
            setCtx(result)
          })
          .catch(() => {
            // fallback
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
  for (const listener of refreshListeners) {
    listener()
  }
}
