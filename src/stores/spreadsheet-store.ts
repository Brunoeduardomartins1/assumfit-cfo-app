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
}))

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
