export interface Scenario {
  id: string
  name: string
  description: string
  type: "base" | "optimistic" | "pessimistic" | "custom"
  createdAt: string
  modifiers: ScenarioModifier[]
}

export interface ScenarioModifier {
  id: string
  target: "receita" | "custos_fixos" | "despesas_variaveis" | "cogs" | "capital"
  operation: "multiply" | "add" | "set"
  value: number
  label: string
}

export interface ScenarioProjection {
  month: string
  base: number
  scenario: number
  delta: number
  deltaPercent: number
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  user: string
  action: "create" | "update" | "delete" | "import" | "export" | "connect" | "classify"
  entity: string
  entityId?: string
  details: string
  before?: string
  after?: string
}
