import { BUSINESS_PHASES, type BusinessPhase } from "./constants"

export function getCurrentPhase(date: Date = new Date()): BusinessPhase {
  const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

  for (const [key, phase] of Object.entries(BUSINESS_PHASES)) {
    if (yearMonth >= phase.dateRange.start && yearMonth <= phase.dateRange.end) {
      return key as BusinessPhase
    }
  }

  // Default: if after all phases, return last phase
  return "PRE_ESCALA"
}

export function getPhaseConfig(phase: BusinessPhase) {
  return BUSINESS_PHASES[phase]
}

export function getAllPhases() {
  return Object.entries(BUSINESS_PHASES).map(([key, config]) => ({
    key: key as BusinessPhase,
    ...config,
  }))
}
