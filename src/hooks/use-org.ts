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

export function useOrg(): OrgContext {
  const [ctx, setCtx] = useState<OrgContext>(
    cachedContext ?? { orgId: null, userId: null, fullName: null, role: "viewer", loading: true }
  )

  useEffect(() => {
    if (cachedContext && !cachedContext.loading) {
      setCtx(cachedContext)
      return
    }

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
    return () => { cancelled = true }
  }, [])

  return ctx
}

/** Invalidate cached org context (call after login/signup) */
export function invalidateOrgCache() {
  cachedContext = null
}
