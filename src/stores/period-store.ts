import { create } from "zustand"

export type PeriodMode = "month" | "quarter" | "year" | "custom"

interface PeriodState {
  mode: PeriodMode
  selectedMonth: string
  selectedQuarter: string
  selectedYear: string
  customRange: { from: string; to: string } | null

  getDateRange: () => { from: string; to: string }

  setMonth: (month: string) => void
  setQuarter: (quarter: string) => void
  setYear: (year: string) => void
  setCustomRange: (from: string, to: string) => void
}

function quarterToRange(q: string): { from: string; to: string } {
  // "2026-Q1" → { from: "2026-01", to: "2026-03" }
  const [year, qNum] = q.split("-Q")
  const quarter = parseInt(qNum)
  const startMonth = String((quarter - 1) * 3 + 1).padStart(2, "0")
  const endMonth = String(quarter * 3).padStart(2, "0")
  return { from: `${year}-${startMonth}`, to: `${year}-${endMonth}` }
}

export const usePeriodStore = create<PeriodState>((set, get) => ({
  mode: "year",
  selectedMonth: "2026-01",
  selectedQuarter: "2026-Q1",
  selectedYear: "2026",
  customRange: null,

  getDateRange: () => {
    const state = get()
    switch (state.mode) {
      case "month":
        return { from: state.selectedMonth, to: state.selectedMonth }
      case "quarter":
        return quarterToRange(state.selectedQuarter)
      case "year":
        return { from: `${state.selectedYear}-01`, to: `${state.selectedYear}-12` }
      case "custom":
        return state.customRange ?? { from: "2025-07", to: "2026-12" }
    }
  },

  setMonth: (month) => set({ mode: "month", selectedMonth: month }),
  setQuarter: (quarter) => set({ mode: "quarter", selectedQuarter: quarter }),
  setYear: (year) => set({ mode: "year", selectedYear: year }),
  setCustomRange: (from, to) => set({ mode: "custom", customRange: { from, to } }),
}))
