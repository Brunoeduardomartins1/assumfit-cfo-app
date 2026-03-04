import { MONTHLY_DATA } from "@/config/seed-data"
import type { Scenario, ScenarioModifier, ScenarioProjection } from "@/types/scenarios"

/**
 * Apply scenario modifiers to base data and return projections
 */
export function applyScenario(
  scenario: Scenario,
  metric: "ebitda" | "receita" | "saldoFinal" | "burnRate"
): ScenarioProjection[] {
  const dreMonths = MONTHLY_DATA.filter((d) => d.receita !== null)

  return dreMonths.map((d) => {
    let baseValue: number
    switch (metric) {
      case "ebitda":
        baseValue = d.ebitda ?? 0
        break
      case "receita":
        baseValue = d.receita ?? 0
        break
      case "saldoFinal":
        baseValue = d.saldoFinal
        break
      case "burnRate":
        baseValue = d.burnRate ?? 0
        break
    }

    let scenarioValue = baseValue

    for (const mod of scenario.modifiers) {
      const affects = modifierAffectsMetric(mod, metric)
      if (!affects) continue

      switch (mod.operation) {
        case "multiply":
          scenarioValue = scenarioValue * mod.value
          break
        case "add":
          scenarioValue = scenarioValue + mod.value
          break
        case "set":
          scenarioValue = mod.value
          break
      }
    }

    const delta = scenarioValue - baseValue
    const deltaPercent = baseValue !== 0 ? (delta / Math.abs(baseValue)) * 100 : 0

    return {
      month: d.month,
      base: baseValue,
      scenario: scenarioValue,
      delta,
      deltaPercent,
    }
  })
}

function modifierAffectsMetric(
  mod: ScenarioModifier,
  metric: "ebitda" | "receita" | "saldoFinal" | "burnRate"
): boolean {
  switch (metric) {
    case "receita":
      return mod.target === "receita"
    case "ebitda":
      return true // all modifiers affect EBITDA
    case "saldoFinal":
      return true
    case "burnRate":
      return mod.target !== "receita"
  }
}

/**
 * Pre-built scenario templates
 */
export const SCENARIO_TEMPLATES: Scenario[] = [
  {
    id: "base",
    name: "Cenario Base",
    description: "Projecao atual sem alteracoes",
    type: "base",
    createdAt: new Date().toISOString(),
    modifiers: [],
  },
  {
    id: "optimistic",
    name: "Otimista (+30% receita)",
    description: "Crescimento acelerado com 30% mais receita e custos controlados",
    type: "optimistic",
    createdAt: new Date().toISOString(),
    modifiers: [
      { id: "m1", target: "receita", operation: "multiply", value: 1.3, label: "Receita +30%" },
      { id: "m2", target: "custos_fixos", operation: "multiply", value: 1.1, label: "Custos fixos +10%" },
    ],
  },
  {
    id: "pessimistic",
    name: "Pessimista (-20% receita)",
    description: "Crescimento mais lento com 20% menos receita",
    type: "pessimistic",
    createdAt: new Date().toISOString(),
    modifiers: [
      { id: "m3", target: "receita", operation: "multiply", value: 0.8, label: "Receita -20%" },
      { id: "m4", target: "despesas_variaveis", operation: "multiply", value: 1.15, label: "Desp. var. +15%" },
    ],
  },
  {
    id: "aggressive",
    name: "Agressivo (+50% receita, +25% custos)",
    description: "Investimento pesado em growth com retorno proporcional",
    type: "custom",
    createdAt: new Date().toISOString(),
    modifiers: [
      { id: "m5", target: "receita", operation: "multiply", value: 1.5, label: "Receita +50%" },
      { id: "m6", target: "despesas_variaveis", operation: "multiply", value: 1.25, label: "Desp. var. +25%" },
      { id: "m7", target: "custos_fixos", operation: "multiply", value: 1.15, label: "Custos fixos +15%" },
    ],
  },
]
