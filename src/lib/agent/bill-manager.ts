import { createAdminClient } from "@/lib/supabase/admin"

interface BillDueResult {
  bills: Array<{
    id: string
    description: string
    amount: number
    due_date: string
    days_until: number
    status: string
  }>
  creditCards: Array<{
    accountName: string
    totalDue: number
    dueDate: string
    daysUntil: number
  }>
}

/**
 * Check for upcoming bills and credit card due dates.
 * Called by cron job and decision engine.
 */
export async function checkUpcomingBills(orgId: string): Promise<BillDueResult> {
  const admin = createAdminClient()
  const now = new Date()
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Check bills table
  const { data: bills } = await admin
    .from("bills")
    .select("id, description, amount, due_date, status")
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .gte("due_date", now.toISOString().slice(0, 10))
    .lte("due_date", in7Days.toISOString().slice(0, 10))
    .order("due_date", { ascending: true })

  const billsWithDays = (bills ?? []).map((b) => {
    const dueDate = new Date(b.due_date)
    const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return { ...b, days_until: Math.max(0, daysUntil) }
  })

  // Check credit cards
  const { data: creditCards } = await admin
    .from("bank_accounts")
    .select("name, credit_limit, available_limit, due_date")
    .eq("organization_id", orgId)
    .eq("type", "credit_card")
    .not("due_date", "is", null)

  const creditCardDues = (creditCards ?? []).map((cc) => {
    const dueDay = cc.due_date as number
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), dueDay)
    if (thisMonth < now) thisMonth.setMonth(thisMonth.getMonth() + 1)
    const daysUntil = Math.ceil((thisMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const totalDue = (cc.credit_limit ?? 0) - (cc.available_limit ?? 0)

    return {
      accountName: cc.name,
      totalDue,
      dueDate: thisMonth.toISOString().slice(0, 10),
      daysUntil: Math.max(0, daysUntil),
    }
  }).filter((cc) => cc.daysUntil <= 7 && cc.totalDue > 0)

  return { bills: billsWithDays, creditCards: creditCardDues }
}

/**
 * Mark overdue bills
 */
export async function markOverdueBills(orgId: string): Promise<number> {
  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await admin
    .from("bills")
    .update({ status: "overdue" })
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .lt("due_date", today)
    .select("id")

  return data?.length ?? 0
}

/**
 * Auto-reconcile: when a bank transaction matches a pending bill, link them
 */
export async function reconcileBillWithTransaction(
  orgId: string,
  context: Record<string, unknown>
): Promise<boolean> {
  const admin = createAdminClient()

  // Find pending bills that match the transaction amount (+/- 5%)
  const amount = Math.abs(context.amount as number)
  const minAmount = amount * 0.95
  const maxAmount = amount * 1.05

  const { data: matchingBills } = await admin
    .from("bills")
    .select("id, description, amount, due_date")
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .eq("type", "payable")
    .gte("amount", minAmount)
    .lte("amount", maxAmount)
    .order("due_date", { ascending: true })
    .limit(1)

  if (!matchingBills || matchingBills.length === 0) return false

  const bill = matchingBills[0]
  const transactionId = context.transactionId as string

  // Link and mark as paid
  await admin
    .from("bills")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      bank_transaction_id: transactionId,
    })
    .eq("id", bill.id)

  return true
}

/**
 * Generate recurring bills from templates
 */
export async function generateRecurringBills(orgId: string): Promise<number> {
  const admin = createAdminClient()
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  // Find monthly recurring bills that don't have an entry for this month yet
  const { data: recurring } = await admin
    .from("bills")
    .select("description, amount, category, supplier_id, recurrence, type")
    .eq("organization_id", orgId)
    .eq("recurrence", "monthly")
    .eq("status", "paid")
    .order("created_at", { ascending: false })

  if (!recurring) return 0

  // Deduplicate by description
  const seen = new Set<string>()
  const templates = recurring.filter((b) => {
    if (seen.has(b.description)) return false
    seen.add(b.description)
    return true
  })

  let created = 0
  for (const template of templates) {
    // Check if already exists for this month
    const { data: existing } = await admin
      .from("bills")
      .select("id")
      .eq("organization_id", orgId)
      .eq("description", template.description)
      .gte("due_date", `${currentMonth}-01`)
      .lte("due_date", `${currentMonth}-31`)
      .limit(1)

    if (existing && existing.length > 0) continue

    // Create new bill for this month
    const dueDay = 15 // default due date mid-month
    await admin.from("bills").insert({
      organization_id: orgId,
      type: template.type,
      description: template.description,
      amount: template.amount,
      due_date: `${currentMonth}-${String(dueDay).padStart(2, "0")}`,
      status: "pending",
      category: template.category,
      supplier_id: template.supplier_id,
      recurrence: "monthly",
    })
    created++
  }

  return created
}
