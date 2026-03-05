import { createClient } from "./client"
import type {
  Organization,
  Profile,
  ChartOfAccount,
  Transaction,
  ModelAssumption,
  Scenario,
  Alert,
  AuditLogEntry,
} from "@/types/database"

// ---------------------------------------------------------------------------
// Helper: get supabase browser client (for client components / hooks)
// ---------------------------------------------------------------------------
function sb() {
  return createClient()
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------
export async function getOrganization(orgId: string) {
  const { data, error } = await sb()
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single()
  if (error) throw error
  return data as Organization
}

export async function updateOrganization(
  orgId: string,
  updates: Partial<Pick<Organization, "name" | "slug">>
) {
  const { data, error } = await sb()
    .from("organizations")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", orgId)
    .select()
    .single()
  if (error) throw error
  return data as Organization
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
export async function getProfile(userId: string) {
  const { data, error } = await sb()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()
  if (error && error.code !== "PGRST116") throw error
  return (data as Profile) ?? null
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, "full_name" | "avatar_url" | "role">>
) {
  const { data, error } = await sb()
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single()
  if (error) throw error
  return data as Profile
}

// ---------------------------------------------------------------------------
// Chart of Accounts
// ---------------------------------------------------------------------------
export async function getChartOfAccounts(orgId: string) {
  const { data, error } = await sb()
    .from("chart_of_accounts")
    .select("*")
    .eq("organization_id", orgId)
    .order("display_order")
  if (error) throw error
  return (data ?? []) as ChartOfAccount[]
}

export async function upsertChartOfAccounts(
  orgId: string,
  rows: Omit<ChartOfAccount, "id" | "organization_id" | "created_at">[]
) {
  const records = rows.map((r) => ({ ...r, organization_id: orgId }))
  const { error } = await sb()
    .from("chart_of_accounts")
    .upsert(records, { onConflict: "organization_id,code" })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------
export async function getTransactions(
  orgId: string,
  filters?: {
    month?: string
    accountCode?: string
    entryType?: "estimado" | "realizado"
    source?: string
  }
) {
  let q = sb()
    .from("transactions")
    .select("*")
    .eq("organization_id", orgId)

  if (filters?.month) q = q.eq("month", filters.month)
  if (filters?.accountCode) q = q.eq("account_code", filters.accountCode)
  if (filters?.entryType) q = q.eq("entry_type", filters.entryType)
  if (filters?.source) q = q.eq("source", filters.source)

  const { data, error } = await q.order("month").order("account_code")
  if (error) throw error
  return (data ?? []) as Transaction[]
}

export async function upsertTransactions(
  orgId: string,
  rows: Omit<Transaction, "id" | "organization_id" | "created_at" | "updated_at">[]
) {
  const records = rows.map((r) => ({
    ...r,
    organization_id: orgId,
    updated_at: new Date().toISOString(),
  }))
  // Batch in chunks of 500 to avoid payload limits
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500)
    const { error } = await sb()
      .from("transactions")
      .upsert(chunk, { onConflict: "organization_id,account_code,month,entry_type" })
    if (error) throw error
  }
}

// ---------------------------------------------------------------------------
// Transaction Helpers
// ---------------------------------------------------------------------------
export async function getTransactionsByDateRange(
  orgId: string,
  startMonth: string, // "YYYY-MM-01"
  endMonth: string,   // "YYYY-MM-01"
  entryType?: "estimado" | "realizado"
) {
  let q = sb()
    .from("transactions")
    .select("*")
    .eq("organization_id", orgId)
    .gte("month", startMonth)
    .lte("month", endMonth)
  if (entryType) q = q.eq("entry_type", entryType)
  const { data, error } = await q.order("month").order("account_code")
  if (error) throw error
  return (data ?? []) as Transaction[]
}

export async function getTransactionAggregateByAccount(
  orgId: string,
  month: string, // "YYYY-MM"
  entryType: "estimado" | "realizado"
): Promise<Array<{ account_code: string; total: number; count: number }>> {
  const txs = await getTransactions(orgId, {
    month: `${month}-01`,
    entryType,
  })
  const map = new Map<string, { total: number; count: number }>()
  for (const tx of txs) {
    const entry = map.get(tx.account_code) ?? { total: 0, count: 0 }
    entry.total += Number(tx.amount)
    entry.count += 1
    map.set(tx.account_code, entry)
  }
  return Array.from(map.entries()).map(([account_code, agg]) => ({
    account_code,
    ...agg,
  }))
}

// ---------------------------------------------------------------------------
// Income Statement (DRE)
// ---------------------------------------------------------------------------
export async function getIncomeStatementForMonth(
  orgId: string,
  month: string // "YYYY-MM"
) {
  const { data, error } = await sb()
    .from("income_statement")
    .select("*")
    .eq("organization_id", orgId)
    .is("scenario_id", null)
    .like("month", `${month}%`)
    .order("line_item")
  if (error) throw error
  return (data ?? []) as Array<{
    id: string; organization_id: string; scenario_id: string | null;
    month: string; line_item: string; amount: number; created_at: string;
  }>
}

export async function getIncomeStatement(
  orgId: string,
  scenarioId?: string | null
) {
  let q = sb()
    .from("income_statement")
    .select("*")
    .eq("organization_id", orgId)

  if (scenarioId) {
    q = q.eq("scenario_id", scenarioId)
  } else {
    q = q.is("scenario_id", null)
  }

  const { data, error } = await q.order("month").order("line_item")
  if (error) throw error
  return (data ?? []) as Array<{
    id: string
    organization_id: string
    scenario_id: string | null
    month: string
    line_item: string
    amount: number
    created_at: string
  }>
}

export async function upsertIncomeStatement(
  orgId: string,
  rows: Array<{
    scenario_id?: string | null
    month: string
    line_item: string
    amount: number
  }>
) {
  const records = rows.map((r) => ({
    organization_id: orgId,
    scenario_id: r.scenario_id ?? null,
    month: r.month,
    line_item: r.line_item,
    amount: r.amount,
  }))
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500)
    const { error } = await sb()
      .from("income_statement")
      .upsert(chunk, {
        onConflict: "organization_id,scenario_id,month,line_item",
      })
    if (error) throw error
  }
}

// ---------------------------------------------------------------------------
// Model Assumptions (Premissas)
// ---------------------------------------------------------------------------
export async function getAssumptions(
  orgId: string,
  scenarioId?: string | null
) {
  let q = sb()
    .from("model_assumptions")
    .select("*")
    .eq("organization_id", orgId)

  if (scenarioId) {
    q = q.eq("scenario_id", scenarioId)
  } else {
    q = q.is("scenario_id", null)
  }

  const { data, error } = await q.order("key")
  if (error) throw error
  return (data ?? []) as ModelAssumption[]
}

export async function upsertAssumptions(
  orgId: string,
  rows: Array<{
    scenario_id?: string | null
    key: string
    label: string
    value: number
    unit?: "percent" | "currency" | "number"
  }>
) {
  const records = rows.map((r) => ({
    organization_id: orgId,
    scenario_id: r.scenario_id ?? null,
    key: r.key,
    label: r.label,
    value: r.value,
    unit: r.unit ?? "number",
    updated_at: new Date().toISOString(),
  }))
  const { error } = await sb()
    .from("model_assumptions")
    .upsert(records, { onConflict: "organization_id,scenario_id,key" })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Sales Projections
// ---------------------------------------------------------------------------
export async function getSalesProjections(
  orgId: string,
  product?: string,
  scenarioId?: string | null
) {
  let q = sb()
    .from("sales_projections")
    .select("*")
    .eq("organization_id", orgId)

  if (product) q = q.eq("product", product)
  if (scenarioId) {
    q = q.eq("scenario_id", scenarioId)
  } else {
    q = q.is("scenario_id", null)
  }

  const { data, error } = await q.order("month").order("funnel_stage")
  if (error) throw error
  return (data ?? []) as Array<{
    id: string
    organization_id: string
    product: string
    scenario_id: string | null
    month: string
    funnel_stage: string
    value: number
    created_at: string
  }>
}

export async function upsertSalesProjections(
  orgId: string,
  rows: Array<{
    product: string
    scenario_id?: string | null
    month: string
    funnel_stage: string
    value: number
  }>
) {
  const records = rows.map((r) => ({
    organization_id: orgId,
    product: r.product,
    scenario_id: r.scenario_id ?? null,
    month: r.month,
    funnel_stage: r.funnel_stage,
    value: r.value,
  }))
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500)
    const { error } = await sb()
      .from("sales_projections")
      .upsert(chunk, {
        onConflict: "organization_id,product,scenario_id,month,funnel_stage",
      })
    if (error) throw error
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
export async function getScenarios(orgId: string) {
  const { data, error } = await sb()
    .from("scenarios")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at")
  if (error) throw error
  return (data ?? []) as Scenario[]
}

export async function createScenario(
  orgId: string,
  scenario: Pick<Scenario, "name" | "description" | "is_base" | "growth_rate"> & {
    created_by?: string | null
  }
) {
  const { data, error } = await sb()
    .from("scenarios")
    .insert({ ...scenario, organization_id: orgId })
    .select()
    .single()
  if (error) throw error
  return data as Scenario
}

export async function updateScenario(
  id: string,
  updates: Partial<Pick<Scenario, "name" | "description" | "is_base" | "growth_rate">>
) {
  const { data, error } = await sb()
    .from("scenarios")
    .update(updates)
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  return data as Scenario
}

export async function deleteScenario(id: string) {
  const { error } = await sb().from("scenarios").delete().eq("id", id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Bank Accounts
// ---------------------------------------------------------------------------
export async function getBankAccounts(orgId: string) {
  const { data, error } = await sb()
    .from("bank_accounts")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at")
  if (error) throw error
  return (data ?? []) as Array<{
    id: string
    organization_id: string
    provider: string
    provider_account_id: string
    bank_name: string
    account_type: string | null
    account_number: string | null
    balance: number | null
    last_sync: string | null
    connection_status: string
    created_at: string
  }>
}

export async function upsertBankAccount(
  orgId: string,
  account: {
    provider: string
    provider_account_id: string
    bank_name: string
    account_type?: string
    account_number?: string
    balance?: number
    last_sync?: string
    connection_status?: string
    pluggy_item_id?: string | null
  }
) {
  const { data, error } = await sb()
    .from("bank_accounts")
    .upsert(
      { ...account, organization_id: orgId },
      { onConflict: "id" }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Classification Rules
// ---------------------------------------------------------------------------
export async function getClassificationRules(orgId: string) {
  const { data, error } = await sb()
    .from("classification_rules")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at")
  if (error) throw error
  return (data ?? []) as Array<{
    id: string
    organization_id: string
    pattern: string
    account_code: string
    confidence: number
    source: string
    created_at: string
  }>
}

export async function upsertClassificationRule(
  orgId: string,
  rule: { pattern: string; account_code: string; confidence?: number; source?: string }
) {
  const { error } = await sb()
    .from("classification_rules")
    .upsert({ ...rule, organization_id: orgId }, { onConflict: "id" })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Budget Entries
// ---------------------------------------------------------------------------
export async function getBudgetEntries(
  orgId: string,
  scenarioId?: string | null
) {
  let q = sb()
    .from("budget_entries")
    .select("*")
    .eq("organization_id", orgId)

  if (scenarioId) q = q.eq("scenario_id", scenarioId)

  const { data, error } = await q.order("month").order("account_code")
  if (error) throw error
  return (data ?? []) as Array<{
    id: string
    organization_id: string
    account_code: string
    month: string
    amount: number
    scenario_id: string | null
    created_at: string
  }>
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
export async function getAlerts(orgId: string, unreadOnly = false) {
  let q = sb()
    .from("alerts")
    .select("*")
    .eq("organization_id", orgId)

  if (unreadOnly) q = q.eq("is_read", false)

  const { data, error } = await q.order("created_at", { ascending: false }).limit(50)
  if (error) throw error
  return (data ?? []) as Alert[]
}

export async function createAlert(
  orgId: string,
  alert: Pick<Alert, "type" | "severity" | "title" | "message"> & {
    data?: Record<string, unknown>
  }
) {
  const { data, error } = await sb()
    .from("alerts")
    .insert({ ...alert, organization_id: orgId })
    .select()
    .single()
  if (error) throw error
  return data as Alert
}

export async function markAlertRead(id: string) {
  const { error } = await sb()
    .from("alerts")
    .update({ is_read: true })
    .eq("id", id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------
export async function getAuditLog(orgId: string, limit = 50) {
  const { data, error } = await sb()
    .from("audit_log")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as AuditLogEntry[]
}

export async function createAuditEntry(
  orgId: string,
  entry: {
    user_id?: string | null
    action: string
    entity_type?: string
    entity_id?: string
    old_value?: Record<string, unknown>
    new_value?: Record<string, unknown>
  }
) {
  const { error } = await sb()
    .from("audit_log")
    .insert({ ...entry, organization_id: orgId })
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Dashboard Aggregation — builds MonthlyData-compatible shape from DB
// ---------------------------------------------------------------------------
export async function getDashboardSnapshot(orgId: string) {
  // Fetch transactions and income statement in parallel
  const [txResult, dreResult] = await Promise.all([
    sb()
      .from("transactions")
      .select("account_code, month, entry_type, amount")
      .eq("organization_id", orgId)
      .order("month"),
    sb()
      .from("income_statement")
      .select("month, line_item, amount")
      .eq("organization_id", orgId)
      .is("scenario_id", null)
      .order("month"),
  ])

  if (txResult.error) throw txResult.error
  if (dreResult.error) throw dreResult.error

  return {
    transactions: (txResult.data ?? []) as Array<{
      account_code: string
      month: string
      entry_type: string
      amount: number
    }>,
    incomeStatement: (dreResult.data ?? []) as Array<{
      month: string
      line_item: string
      amount: number
    }>,
  }
}
