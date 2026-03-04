export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string
  full_name: string | null
  role: "owner" | "admin" | "editor" | "viewer"
  avatar_url: string | null
  created_at: string
}

export interface ChartOfAccount {
  id: string
  organization_id: string
  code: string
  name: string
  level: number
  parent_code: string | null
  type: "revenue" | "expense" | "capital" | "financial" | "adjustment"
  phase: string | null
  is_summary: boolean
  display_order: number
  created_at: string
}

export interface Transaction {
  id: string
  organization_id: string
  account_code: string
  month: string
  entry_type: "estimado" | "realizado"
  amount: number
  source: "import" | "manual" | "open_finance" | "formula"
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ModelAssumption {
  id: string
  organization_id: string
  scenario_id: string | null
  key: string
  label: string
  value: number
  unit: "percent" | "currency" | "number"
  created_at: string
  updated_at: string
}

export interface Scenario {
  id: string
  organization_id: string
  name: string
  description: string | null
  is_base: boolean
  growth_rate: number | null
  created_by: string | null
  created_at: string
}

export interface Alert {
  id: string
  organization_id: string
  type: "burn_rate" | "runway" | "budget_exceeded" | "anomaly" | "recommendation"
  severity: "info" | "warning" | "critical"
  title: string
  message: string
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

export interface AuditLogEntry {
  id: string
  organization_id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}
