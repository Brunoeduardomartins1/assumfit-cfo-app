"use client"

import { create } from "zustand"
import type { AuditLogEntry } from "@/types/scenarios"

// Demo audit log entries
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
  {
    id: "a4",
    timestamp: "2026-01-28T15:05:00Z",
    user: "Leonardo Silva",
    action: "connect",
    entity: "Open Finance",
    details: "Conectou Conta Simples via Pluggy",
  },
  {
    id: "a5",
    timestamp: "2026-01-28T15:10:00Z",
    user: "Leonardo Silva",
    action: "create",
    entity: "Cenario",
    entityId: "optimistic",
    details: 'Criou cenario "Otimista (+30% receita)"',
  },
  {
    id: "a6",
    timestamp: "2026-01-28T16:00:00Z",
    user: "Leonardo Silva",
    action: "export",
    entity: "Relatorio Board",
    details: "Exportou relatorio executivo Jan/26 em PDF",
  },
]

interface AuditState {
  entries: AuditLogEntry[]
  addEntry: (entry: Omit<AuditLogEntry, "id" | "timestamp">) => void
}

export const useAuditStore = create<AuditState>((set) => ({
  entries: DEMO_ENTRIES,
  addEntry: (entry) =>
    set((state) => ({
      entries: [
        {
          ...entry,
          id: `a${state.entries.length + 1}`,
          timestamp: new Date().toISOString(),
        },
        ...state.entries,
      ],
    })),
}))
