"use client"

import { create } from "zustand"
import type { AuditLogEntry } from "@/types/scenarios"

// Demo entries used as fallback when DB is empty
const DEMO_ENTRIES: AuditLogEntry[] = [
  {
    id: "a1",
    timestamp: "2026-01-28T14:30:00Z",
    user: "Leonardo Silva",
    action: "import",
    entity: "Planilha XLSX",
    details: "Importou FLUXO DE CAIXA.xlsx (168 linhas, 18 meses)",
  },
  {
    id: "a2",
    timestamp: "2026-01-28T14:32:00Z",
    user: "Sistema",
    action: "classify",
    entity: "Transacoes",
    details: "Classificou automaticamente 11/13 transacoes de Jan/26",
  },
  {
    id: "a3",
    timestamp: "2026-01-28T15:00:00Z",
    user: "Leonardo Silva",
    action: "update",
    entity: "Fluxo de Caixa",
    entityId: "salarios_r28",
    details: "Atualizou Salarios Jan/26",
    before: "R$ 140.295,88",
    after: "R$ 142.000,00",
  },
]

interface AuditState {
  entries: AuditLogEntry[]
  loaded: boolean
  addEntry: (entry: Omit<AuditLogEntry, "id" | "timestamp">) => void
  loadFromDb: (orgId: string) => Promise<void>
}

export const useAuditStore = create<AuditState>((set, get) => ({
  entries: DEMO_ENTRIES,
  loaded: false,

  addEntry: (entry) => {
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `a${Date.now()}`,
      timestamp: new Date().toISOString(),
    }
    set((state) => ({
      entries: [newEntry, ...state.entries],
    }))
  },

  loadFromDb: async (orgId: string) => {
    if (get().loaded) return
    try {
      const { getAuditLog } = await import("@/lib/supabase/queries")
      const dbEntries = await getAuditLog(orgId, 100)
      if (dbEntries.length > 0) {
        const mapped: AuditLogEntry[] = dbEntries.map((e) => ({
          id: e.id,
          timestamp: e.created_at,
          user: e.user_id ?? "Sistema",
          action: e.action as AuditLogEntry["action"],
          entity: e.entity_type ?? "",
          entityId: e.entity_id ?? undefined,
          details: e.new_value
            ? JSON.stringify(e.new_value).slice(0, 100)
            : e.action,
          before: e.old_value ? JSON.stringify(e.old_value).slice(0, 50) : undefined,
          after: e.new_value ? JSON.stringify(e.new_value).slice(0, 50) : undefined,
        }))
        set({ entries: mapped, loaded: true })
      } else {
        set({ loaded: true })
      }
    } catch {
      set({ loaded: true })
    }
  },
}))
