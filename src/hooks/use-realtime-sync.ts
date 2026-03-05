"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RealtimeChannel } from "@supabase/supabase-js"

/**
 * Subscribe to Supabase Realtime changes on one or more tables,
 * filtered by organization_id. Calls onUpdate when any change occurs.
 * Uses debounce to avoid excessive re-fetches.
 */
export function useRealtimeSync(
  orgId: string | null,
  tables: string[],
  onUpdate: () => void,
  debounceMs = 500
) {
  const channelsRef = useRef<RealtimeChannel[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!orgId || tables.length === 0) return

    const supabase = createClient()

    const debouncedUpdate = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(onUpdate, debounceMs)
    }

    const channels: RealtimeChannel[] = []

    for (const table of tables) {
      const channel = supabase
        .channel(`realtime_${orgId}_${table}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `organization_id=eq.${orgId}`,
          },
          debouncedUpdate
        )
        .subscribe()

      channels.push(channel)
    }

    channelsRef.current = channels

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const ch of channels) {
        supabase.removeChannel(ch)
      }
      channelsRef.current = []
    }
  }, [orgId, tables.join(","), debounceMs]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

/**
 * Non-hook version for use in Zustand stores or non-component contexts.
 * Returns an unsubscribe function.
 */
export function subscribeRealtime(
  orgId: string,
  tables: string[],
  onUpdate: () => void,
  debounceMs = 500
): () => void {
  const supabase = createClient()
  const channels: RealtimeChannel[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  const debouncedUpdate = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(onUpdate, debounceMs)
  }

  for (const table of tables) {
    const channel = supabase
      .channel(`store_${orgId}_${table}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `organization_id=eq.${orgId}`,
        },
        debouncedUpdate
      )
      .subscribe()

    channels.push(channel)
  }

  return () => {
    if (timer) clearTimeout(timer)
    for (const ch of channels) {
      supabase.removeChannel(ch)
    }
  }
}
