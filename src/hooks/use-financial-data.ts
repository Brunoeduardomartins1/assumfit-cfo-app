"use client"

import { useEffect, useState } from "react"
import type { MonthlyData } from "@/config/seed-data"
import {
  MONTHLY_DATA,
  CURRENT_SNAPSHOT,
  TOP_EXPENSES,
  REVENUE_SOURCES,
} from "@/config/seed-data"
import { getDashboardSnapshot } from "@/lib/supabase/queries"
import { BUSINESS_PHASES } from "@/config/constants"

interface FinancialData {
  monthlyData: MonthlyData[]
  snapshot: typeof CURRENT_SNAPSHOT
  topExpenses: typeof TOP_EXPENSES
  revenueSources: typeof REVENUE_SOURCES
  loading: boolean
  fromDb: boolean
}

/**
 * Fetches financial data from Supabase. Falls back to seed-data if DB is empty.
 */
export function useFinancialData(orgId: string | null): FinancialData {
  const [data, setData] = useState<FinancialData>({
    monthlyData: MONTHLY_DATA,
    snapshot: CURRENT_SNAPSHOT,
    topExpenses: TOP_EXPENSES,
    revenueSources: REVENUE_SOURCES,
    loading: !!orgId,
    fromDb: false,
  })

  useEffect(() => {
    if (!orgId) {
      setData((d) => ({ ...d, loading: false }))
      return
    }

    let cancelled = false

    async function load() {
      try {
        const raw = await getDashboardSnapshot(orgId!)

        // If no transactions in DB, use seed-data
        if (raw.transactions.length === 0) {
          if (!cancelled) setData((d) => ({ ...d, loading: false, fromDb: false }))
          return
        }

        // Build MonthlyData from DB transactions
        const monthMap = new Map<string, Partial<MonthlyData>>()

        // Group transactions by month
        for (const tx of raw.transactions) {
          const monthKey = tx.month.slice(0, 7) // "2026-01" from "2026-01-01"
          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { monthKey, entradas: 0, saidas: 0 })
          }
          const m = monthMap.get(monthKey)!
          const amt = Number(tx.amount)

          // Classify based on account_code section
          if (tx.entry_type === "estimado" || tx.entry_type === "realizado") {
            if (amt > 0) {
              m.entradas = (m.entradas ?? 0) + amt
            } else {
              m.saidas = (m.saidas ?? 0) + Math.abs(amt)
            }
          }
        }

        // Build income statement by month
        const dreMap = new Map<string, Record<string, number>>()
        for (const row of raw.incomeStatement) {
          const monthKey = row.month.slice(0, 7)
          if (!dreMap.has(monthKey)) dreMap.set(monthKey, {})
          dreMap.get(monthKey)![row.line_item] = Number(row.amount)
        }

        // Merge into MonthlyData array
        const allMonthKeys = new Set([
          ...monthMap.keys(),
          ...dreMap.keys(),
        ])

        const monthlyData: MonthlyData[] = Array.from(allMonthKeys)
          .sort()
          .map((monthKey) => {
            const txData = monthMap.get(monthKey) ?? {}
            const dre = dreMap.get(monthKey) ?? {}
            const entradas = txData.entradas ?? 0
            const saidas = txData.saidas ?? 0
            const geracaoCaixa = entradas - saidas

            // Determine phase from month
            const phase = getPhaseForMonth(monthKey)

            // Format month label: "Jan-26"
            const [y, mStr] = monthKey.split("-")
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            const monthLabel = `${monthNames[parseInt(mStr) - 1]}-${y.slice(2)}`

            return {
              month: monthLabel,
              monthKey,
              phase,
              entradas,
              saidas,
              geracaoCaixa,
              capital: 0,
              saldoFinal: dre.saldo_final ?? 0,
              caixaDisponivel: dre.caixa_disponivel ?? 0,
              valuation: dre.valuation ?? 0,
              receita: dre.receita ?? null,
              cogs: dre.cogs ?? null,
              resultadoBruto: dre.resultado_bruto ?? null,
              custosFixos: dre.custos_fixos ?? null,
              despesasVariaveis: dre.despesas_variaveis ?? null,
              ebitda: dre.ebitda ?? null,
              margemBruta: dre.margem_bruta ?? null,
              margemEbitda: dre.margem_ebitda ?? null,
              burnRate: dre.burn_rate ?? null,
            }
          })

        // Build snapshot from latest month with data
        const latestWithReceita = [...monthlyData].reverse().find((m) => m.receita !== null)
        const prevMonth = latestWithReceita
          ? monthlyData[monthlyData.indexOf(latestWithReceita) - 1]
          : null

        const snapshot = latestWithReceita
          ? {
              month: latestWithReceita.month,
              saldo_caixa: latestWithReceita.saldoFinal,
              saldo_anterior: prevMonth?.saldoFinal ?? 0,
              burn_rate: Math.abs(latestWithReceita.burnRate ?? 0),
              burn_rate_anterior: Math.abs(prevMonth?.burnRate ?? 0),
              runway_meses:
                latestWithReceita.burnRate && latestWithReceita.burnRate > 0
                  ? latestWithReceita.saldoFinal / latestWithReceita.burnRate
                  : 0,
              receita_total: latestWithReceita.receita ?? 0,
              receita_anterior: prevMonth?.receita ?? 0,
              ebitda: latestWithReceita.ebitda ?? 0,
              custos_fixos: latestWithReceita.custosFixos ?? 0,
              despesas_variaveis: latestWithReceita.despesasVariaveis ?? 0,
              valuation: latestWithReceita.valuation,
            }
          : CURRENT_SNAPSHOT

        // Build top expenses from transactions (negative amounts grouped by account_code)
        const expenseMap = new Map<string, number>()
        const latestMonth = latestWithReceita?.monthKey
        if (latestMonth) {
          for (const tx of raw.transactions) {
            if (
              tx.month.startsWith(latestMonth) &&
              Number(tx.amount) < 0
            ) {
              const code = tx.account_code
              expenseMap.set(code, (expenseMap.get(code) ?? 0) + Math.abs(Number(tx.amount)))
            }
          }
        }
        const topExpenses =
          expenseMap.size > 0
            ? Array.from(expenseMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 7)
                .map(([name, value]) => ({ name, value }))
            : TOP_EXPENSES

        if (!cancelled) {
          setData({
            monthlyData: monthlyData.length > 0 ? monthlyData : MONTHLY_DATA,
            snapshot,
            topExpenses,
            revenueSources: REVENUE_SOURCES, // keep seed for now
            loading: false,
            fromDb: true,
          })
        }
      } catch (err) {
        console.error("Failed to load financial data from DB, using seed-data:", err)
        if (!cancelled) setData((d) => ({ ...d, loading: false, fromDb: false }))
      }
    }

    load()
    return () => { cancelled = true }
  }, [orgId])

  return data
}

function getPhaseForMonth(monthKey: string): string {
  for (const [, phase] of Object.entries(BUSINESS_PHASES)) {
    if (monthKey >= phase.dateRange.start && monthKey <= phase.dateRange.end) {
      return phase.label
    }
  }
  return "PRE-ESCALA"
}
