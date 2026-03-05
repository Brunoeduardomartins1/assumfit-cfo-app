"use client"

import { create } from "zustand"
import type {
  SheetTab,
  SpreadsheetRow,
  SpreadsheetMonth,
  PhaseHeader,
  ParsedDRE,
  ParsedPremissas,
  ParsedVendas,
  FluxoSection,
} from "@/types/spreadsheet"
import { updateCellAndRecalculate } from "@/lib/formulas/engine"
import { getDescendantIds } from "@/lib/formulas/hierarchy"

interface UndoEntry {
  rowId: string
  monthKey: string
  oldValue: number | null
  newValue: number | null
}

interface SpreadsheetState {
  // Active tab
  activeTab: SheetTab
  setActiveTab: (tab: SheetTab) => void

  // Fluxo de Caixa data
  fluxoRows: SpreadsheetRow[]
  fluxoMonths: SpreadsheetMonth[]
  fluxoPhases: PhaseHeader[]
  setFluxoData: (rows: SpreadsheetRow[], months: SpreadsheetMonth[], phases: PhaseHeader[]) => void

  // DRE data
  dreData: ParsedDRE | null
  setDreData: (data: ParsedDRE) => void

  // Premissas data
  premissasData: ParsedPremissas | null
  setPremissasData: (data: ParsedPremissas) => void

  // Vendas data
  vendasCoreNew: ParsedVendas | null
  vendasDigital: ParsedVendas | null
  vendasInfluencia: ParsedVendas | null
  vendasCore: ParsedVendas | null
  setVendasData: (key: string, data: ParsedVendas) => void

  // Collapsed groups (set of row IDs)
  collapsedGroups: Set<string>
  toggleGroup: (rowId: string) => void
  expandAll: () => void
  collapseAll: () => void

  // Cell editing
  updateFluxoCell: (rowId: string, monthKey: string, value: number | null) => void

  // Dirty tracking
  dirtyCells: Map<string, { rowId: string; monthKey: string; value: number | null }>
  clearDirty: () => void

  // Undo/Redo
  undoStack: UndoEntry[]
  redoStack: UndoEntry[]
  undo: () => void
  redo: () => void

  // Data loaded flag
  isLoaded: boolean
  isLoading: boolean
  setLoading: (loading: boolean) => void

  // Import from parsed workbook
  importWorkbook: (data: {
    fluxoRows: SpreadsheetRow[]
    fluxoMonths: SpreadsheetMonth[]
    fluxoPhases: PhaseHeader[]
    dre: ParsedDRE
    premissas: ParsedPremissas
    vendasCoreNew: ParsedVendas
    vendasDigital: ParsedVendas
    vendasInfluencia: ParsedVendas
    vendasCore: ParsedVendas
  }) => void

  // DB persistence
  loadFromDb: (orgId: string) => Promise<boolean>
  persistDirtyToDb: (orgId: string) => Promise<void>
}

export const useSpreadsheetStore = create<SpreadsheetState>((set, get) => ({
  activeTab: "fluxo_caixa",
  setActiveTab: (tab) => set({ activeTab: tab }),

  fluxoRows: [],
  fluxoMonths: [],
  fluxoPhases: [],
  setFluxoData: (rows, months, phases) =>
    set({ fluxoRows: rows, fluxoMonths: months, fluxoPhases: phases, isLoaded: true }),

  dreData: null,
  setDreData: (data) => set({ dreData: data }),

  premissasData: null,
  setPremissasData: (data) => set({ premissasData: data }),

  vendasCoreNew: null,
  vendasDigital: null,
  vendasInfluencia: null,
  vendasCore: null,
  setVendasData: (key, data) => {
    switch (key) {
      case "core_new":
        set({ vendasCoreNew: data })
        break
      case "digital":
        set({ vendasDigital: data })
        break
      case "influencia":
        set({ vendasInfluencia: data })
        break
      case "core":
        set({ vendasCore: data })
        break
    }
  },

  collapsedGroups: new Set(),
  toggleGroup: (rowId) =>
    set((state) => {
      const next = new Set(state.collapsedGroups)
      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }
      return { collapsedGroups: next }
    }),
  expandAll: () => set({ collapsedGroups: new Set() }),
  collapseAll: () =>
    set((state) => {
      const groups = state.fluxoRows.filter((r) => r.isGroup).map((r) => r.id)
      return { collapsedGroups: new Set(groups) }
    }),

  updateFluxoCell: (rowId, monthKey, value) =>
    set((state) => {
      const oldRow = state.fluxoRows.find((r) => r.id === rowId)
      const oldValue = oldRow?.values[monthKey] ?? null
      const monthKeys = state.fluxoMonths.map((m) => m.key)
      const newRows = updateCellAndRecalculate(state.fluxoRows, rowId, monthKey, value, monthKeys)

      const dirty = new Map(state.dirtyCells)
      dirty.set(`${rowId}:${monthKey}`, { rowId, monthKey, value })

      return {
        fluxoRows: newRows,
        dirtyCells: dirty,
        undoStack: [...state.undoStack, { rowId, monthKey, oldValue, newValue: value }],
        redoStack: [],
      }
    }),

  dirtyCells: new Map(),
  clearDirty: () => set({ dirtyCells: new Map() }),

  undoStack: [],
  redoStack: [],
  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) return state
      const entry = state.undoStack[state.undoStack.length - 1]
      const monthKeys = state.fluxoMonths.map((m) => m.key)
      const newRows = updateCellAndRecalculate(
        state.fluxoRows,
        entry.rowId,
        entry.monthKey,
        entry.oldValue,
        monthKeys
      )
      return {
        fluxoRows: newRows,
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [...state.redoStack, entry],
      }
    }),
  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) return state
      const entry = state.redoStack[state.redoStack.length - 1]
      const monthKeys = state.fluxoMonths.map((m) => m.key)
      const newRows = updateCellAndRecalculate(
        state.fluxoRows,
        entry.rowId,
        entry.monthKey,
        entry.newValue,
        monthKeys
      )
      return {
        fluxoRows: newRows,
        redoStack: state.redoStack.slice(0, -1),
        undoStack: [...state.undoStack, entry],
      }
    }),

  isLoaded: false,
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  importWorkbook: (data) =>
    set({
      fluxoRows: data.fluxoRows,
      fluxoMonths: data.fluxoMonths,
      fluxoPhases: data.fluxoPhases,
      dreData: data.dre,
      premissasData: data.premissas,
      vendasCoreNew: data.vendasCoreNew,
      vendasDigital: data.vendasDigital,
      vendasInfluencia: data.vendasInfluencia,
      vendasCore: data.vendasCore,
      isLoaded: true,
      isLoading: false,
      collapsedGroups: new Set(),
      dirtyCells: new Map(),
      undoStack: [],
      redoStack: [],
    }),

  loadFromDb: async (orgId: string) => {
    set({ isLoading: true })
    try {
      const { getChartOfAccounts, getTransactions } = await import("@/lib/supabase/queries")
      const [accounts, transactions] = await Promise.all([
        getChartOfAccounts(orgId),
        getTransactions(orgId),
      ])

      if (accounts.length === 0) {
        set({ isLoading: false })
        return false
      }

      // Reconstruct spreadsheet rows from DB
      const monthKeys = new Set<string>()
      for (const tx of transactions) {
        monthKeys.add(tx.month.slice(0, 7))
      }
      const sortedMonths = Array.from(monthKeys).sort()

      // Build month metadata
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const months: SpreadsheetMonth[] = sortedMonths.map((key, i) => {
        const [y, m] = key.split("-")
        const d = new Date(parseInt(y), parseInt(m) - 1, 1)
        const serial = Math.floor((d.getTime() - new Date(1900, 0, 1).getTime()) / 86400000) + 2
        return {
          key,
          label: `${monthNames[parseInt(m) - 1]}-${y.slice(2)}`,
          colIndex: i + 1,
          serialDate: serial,
        }
      })

      // Build rows from chart_of_accounts + transactions
      const rows: SpreadsheetRow[] = accounts.map((acc) => {
        const values: Record<string, number> = {}
        for (const tx of transactions) {
          if (tx.account_code === acc.code) {
            const mk = tx.month.slice(0, 7)
            values[mk] = Number(tx.amount)
          }
        }
        return {
          id: acc.code,
          category: acc.name,
          level: acc.level,
          isGroup: acc.is_summary,
          isEstimado: false,
          isRealizado: false,
          parentId: acc.parent_code,
          rowIndex: acc.display_order,
          section: mapTypeToSection(acc.type),
          values,
        }
      })

      set({
        fluxoRows: rows,
        fluxoMonths: months,
        fluxoPhases: [],
        isLoaded: true,
        isLoading: false,
        dirtyCells: new Map(),
        undoStack: [],
        redoStack: [],
      })
      return true
    } catch (err) {
      console.error("Failed to load from DB:", err)
      set({ isLoading: false })
      return false
    }
  },

  persistDirtyToDb: async (orgId: string) => {
    const state = get()
    if (state.dirtyCells.size === 0) return

    try {
      const { upsertTransactions } = await import("@/lib/supabase/queries")
      const rows = Array.from(state.dirtyCells.values()).map((cell) => {
        const row = state.fluxoRows.find((r) => r.id === cell.rowId)
        return {
          account_code: cell.rowId,
          month: `${cell.monthKey}-01`,
          entry_type: (row?.isRealizado ? "realizado" : "estimado") as "estimado" | "realizado",
          amount: cell.value ?? 0,
          source: "manual" as const,
          notes: null,
          created_by: null,
        }
      })

      await upsertTransactions(orgId, rows)
      set({ dirtyCells: new Map() })
    } catch (err) {
      console.error("Failed to persist dirty cells:", err)
    }
  },
}))

function mapTypeToSection(type: string): FluxoSection {
  switch (type) {
    case "revenue": return "entradas"
    case "expense": return "saidas"
    case "capital": return "capital"
    case "financial": return "saidas_financeiras"
    case "adjustment": return "consolidacao"
    default: return "saidas"
  }
}

/**
 * Get visible rows (respecting collapsed groups)
 */
export function getVisibleRows(rows: SpreadsheetRow[], collapsed: Set<string>): SpreadsheetRow[] {
  const hiddenIds = new Set<string>()

  for (const groupId of collapsed) {
    const descendants = getDescendantIds(rows, groupId)
    for (const id of descendants) {
      hiddenIds.add(id)
    }
  }

  return rows.filter((r) => !hiddenIds.has(r.id))
}
