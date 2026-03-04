export const APP_NAME = "ASSUMFIT CFO"
export const APP_DESCRIPTION = "Financial Command Center"
export const COMPANY_NAME = "ASSUMFIT"
export const BRAND_NAME = "MUVX"

export const LOCALE = "pt-BR"
export const CURRENCY = "BRL"
export const TIMEZONE = "America/Sao_Paulo"

export const MONTHS_PT_BR = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const

export const BUSINESS_PHASES = {
  PROJETO: {
    label: "Projeto",
    color: "fase-projeto",
    dateRange: { start: "2025-07", end: "2025-10" },
  },
  GO_LIVE: {
    label: "Go-Live e Hypercare",
    color: "fase-golive",
    dateRange: { start: "2025-11", end: "2025-12" },
  },
  TRACAO: {
    label: "Tracao",
    color: "fase-tracao",
    dateRange: { start: "2026-01", end: "2026-04" },
  },
  PRE_ESCALA: {
    label: "Pre-Escala",
    color: "fase-escala",
    dateRange: { start: "2026-05", end: "2026-12" },
  },
} as const

export type BusinessPhase = keyof typeof BUSINESS_PHASES
