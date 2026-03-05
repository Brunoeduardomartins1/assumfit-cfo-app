import { MONTHLY_DATA, CURRENT_SNAPSHOT, TOP_EXPENSES, type MonthlyData } from "@/config/seed-data"

export interface FinancialInsight {
  type: "risk" | "opportunity" | "info" | "alert"
  title: string
  description: string
  metric?: string
}

interface LiveData {
  monthlyData?: MonthlyData[]
  snapshot?: typeof CURRENT_SNAPSHOT
  topExpenses?: Array<{ name: string; value: number }>
}

/**
 * Generate automatic financial insights from current data.
 * Accepts optional live data from DB; falls back to seed-data.
 */
export function generateInsights(liveData?: LiveData): FinancialInsight[] {
  const insights: FinancialInsight[] = []
  const snap = liveData?.snapshot ?? CURRENT_SNAPSHOT
  const allMonths = liveData?.monthlyData ?? MONTHLY_DATA
  const expenses = liveData?.topExpenses ?? TOP_EXPENSES
  const months = allMonths.filter((d) => d.ebitda !== null)

  // 1. Runway alert
  if (snap.runway_meses < 3) {
    insights.push({
      type: "alert",
      title: "Runway critico",
      description: `Runway atual de ${snap.runway_meses.toFixed(1)} meses. Com o burn rate de R$ ${snap.burn_rate.toLocaleString("pt-BR")}/mes, o caixa se esgota rapidamente. Priorize captacao ou reducao de custos.`,
      metric: `${snap.runway_meses.toFixed(1)} meses`,
    })
  }

  // 2. Cash position
  if (snap.saldo_caixa < 10000) {
    insights.push({
      type: "alert",
      title: "Saldo de caixa baixo",
      description: `Saldo atual de R$ ${snap.saldo_caixa.toLocaleString("pt-BR")}. Considere antecipar recebimentos ou renegociar prazos com fornecedores.`,
      metric: `R$ ${snap.saldo_caixa.toLocaleString("pt-BR")}`,
    })
  }

  // 3. Break-even timing
  const breakEvenMonth = months.find((d) => (d.ebitda ?? 0) > 0)
  if (breakEvenMonth) {
    insights.push({
      type: "opportunity",
      title: "Break-even projetado",
      description: `EBITDA positivo projetado para ${breakEvenMonth.month} (R$ ${breakEvenMonth.ebitda?.toLocaleString("pt-BR")}). A partir deste mes, a operacao gera caixa.`,
      metric: breakEvenMonth.month,
    })
  }

  // 4. Revenue growth
  const revenueMonths = months.filter((d) => (d.receita ?? 0) > 0)
  if (revenueMonths.length >= 2) {
    const last = revenueMonths[revenueMonths.length - 1]
    const prev = revenueMonths[revenueMonths.length - 2]
    const growth = prev.receita && last.receita
      ? ((last.receita - prev.receita) / prev.receita) * 100
      : 0
    if (growth > 50) {
      insights.push({
        type: "opportunity",
        title: "Crescimento acelerado de receita",
        description: `Receita cresceu ${growth.toFixed(0)}% de ${prev.month} para ${last.month}. Tendencia de hockey stick confirmada na fase Pre-Escala.`,
        metric: `+${growth.toFixed(0)}%`,
      })
    }
  }

  // 5. Cost concentration risk
  const totalCosts = snap.custos_fixos + snap.despesas_variaveis
  const topCost = expenses[0]
  if (topCost && totalCosts > 0) {
    const concentration = (topCost.value / totalCosts) * 100
    if (concentration > 50) {
      insights.push({
        type: "risk",
        title: "Concentracao de custos",
        description: `${topCost.name} representa ${concentration.toFixed(0)}% dos custos totais. Alta dependencia de uma unica linha de custo.`,
        metric: `${concentration.toFixed(0)}%`,
      })
    }
  }

  // 6. Valuation trajectory
  const valuationMonths = allMonths.filter((d) => d.valuation > 0)
  if (valuationMonths.length >= 2) {
    const latest = valuationMonths[valuationMonths.length - 1]
    insights.push({
      type: "info",
      title: "Valuation ARR-Based",
      description: `Valuation estimado de R$ ${(latest.valuation / 1e6).toFixed(1)}M em ${latest.month}, baseado no ARR projetado.`,
      metric: `R$ ${(latest.valuation / 1e6).toFixed(1)}M`,
    })
  }

  // 7. EBITDA margin improvement
  const ebitdaPositive = months.filter((d) => (d.margemEbitda ?? 0) > 0)
  if (ebitdaPositive.length > 0) {
    const latest = ebitdaPositive[ebitdaPositive.length - 1]
    insights.push({
      type: "info",
      title: "Margem EBITDA",
      description: `Margem EBITDA de ${((latest.margemEbitda ?? 0) * 100).toFixed(1)}% em ${latest.month}. Tendencia de melhoria conforme receita escala.`,
      metric: `${((latest.margemEbitda ?? 0) * 100).toFixed(1)}%`,
    })
  }

  // 8. Reconciliation health (BPO insight)
  // Checks if estimated vs actual variance is high in recent months
  if (months.length >= 2) {
    const recent = months[months.length - 1]
    const prev = months[months.length - 2]
    if (recent.receita && prev.receita) {
      const variance = Math.abs(recent.receita - prev.receita) / Math.max(prev.receita, 1)
      if (variance > 0.15) {
        insights.push({
          type: "risk",
          title: "Variancia alta entre periodos",
          description: `Variacao de ${(variance * 100).toFixed(0)}% na receita entre ${prev.month} e ${recent.month}. Verifique se estimativas estao alinhadas com o realizado. Use a conciliacao para identificar desvios.`,
          metric: `${(variance * 100).toFixed(0)}% variancia`,
        })
      }
    }
  }

  // 9. Monthly close status
  // Flags when recent DRE data seems incomplete
  const expectedLineItems = 6 // receita, cogs, resultado_bruto, custos_fixos, despesas_variaveis, ebitda
  if (months.length > 0) {
    const latest = months[months.length - 1]
    const filledItems = [latest.receita, latest.cogs, latest.resultadoBruto, latest.custosFixos, latest.despesasVariaveis, latest.ebitda]
      .filter((v) => v != null && v !== 0).length
    if (filledItems < expectedLineItems * 0.8) {
      insights.push({
        type: "alert",
        title: "Fechamento incompleto",
        description: `O mes ${latest.month} tem apenas ${filledItems}/${expectedLineItems} itens do DRE preenchidos. Execute o checklist de fechamento para validar pendencias.`,
        metric: `${filledItems}/${expectedLineItems} itens`,
      })
    }
  }

  // 10. Fundraising window (CFO insight)
  // Runway < 6 months + revenue growing > 20% MoM = opportunity
  if (snap.runway_meses > 0 && snap.runway_meses < 6 && revenueMonths.length >= 2) {
    const lastRev = revenueMonths[revenueMonths.length - 1]
    const prevRev = revenueMonths[revenueMonths.length - 2]
    const revGrowth = prevRev.receita && lastRev.receita
      ? ((lastRev.receita - prevRev.receita) / prevRev.receita) * 100
      : 0
    if (revGrowth > 20) {
      insights.push({
        type: "opportunity",
        title: "Janela de captacao",
        description: `Runway de ${snap.runway_meses.toFixed(1)} meses com receita crescendo ${revGrowth.toFixed(0)}% MoM. Momento ideal para iniciar conversas com investidores — metricas de crescimento sao atrativas e ha tempo para negociar.`,
        metric: `${snap.runway_meses.toFixed(1)}m runway + ${revGrowth.toFixed(0)}% growth`,
      })
    }
  }

  return insights
}
