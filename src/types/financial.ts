export interface Premissa {
  key: string
  label: string
  value: number
  unit: "percent" | "currency" | "count"
}

export interface DREEntry {
  month: string
  receita_operacional: number
  cogs: number
  resultado_bruto: number
  custos_fixos: number
  despesas_variaveis: number
  resultado_operacional: number
  depreciacao: number
  amortizacao: number
  ebitda: number
  margem_bruta: number
  margem_operacional: number
  margem_ebitda: number
  burn_rate: number
  runway_medio: number | null
  runway_mensal: number | null
  tx_crescimento: number | null
  phase: string
}

export interface FluxoCaixaRow {
  code: string
  name: string
  level: number
  parentCode: string | null
  type: "revenue" | "expense" | "capital" | "financial" | "adjustment" | "consolidation"
  isCategory: boolean
  isSummary: boolean
  isEstimado: boolean
  values: Record<string, number | null>
}

export interface SalesProjection {
  product: string
  month: string
  scenario: string
  investimento: number
  cpl: number
  cadastros: number
  install_rate: number
  installs: number
  ativacao_rate: number
  ativados: number
  conversao_rate: number
  churn_rate: number
  ativos: number
  totais: number
  receita: number
  cac: number
}

export interface KPIData {
  label: string
  value: number
  previousValue?: number
  format: "currency" | "percentage" | "months" | "number"
  invertColors?: boolean
}

export interface CashFlowConsolidation {
  month: string
  saldo_inicial: number
  caixa_liquido: number
  reserva: number
  saldo_reserva: number
  saldo_final: number
  caixa_disponivel: number
}

export type BusinessPhaseKey = "PROJETO" | "GO_LIVE" | "TRACAO" | "PRE_ESCALA"
