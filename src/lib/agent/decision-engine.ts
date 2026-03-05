import { createAdminClient } from "@/lib/supabase/admin"
import { chatCompletion } from "@/lib/ai/claude-client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type AgentAction =
  | "classify"
  | "alert"
  | "report"
  | "update_dre"
  | "notify"
  | "schedule_payment"
  | "reconcile"
  | "celebrate"
  | "plan"

export type Priority = "critical" | "high" | "medium" | "low"

export interface AgentDecision {
  action: AgentAction
  priority: Priority
  context: Record<string, unknown>
  reasoning: string
  automated: boolean
}

export interface AgentTrigger {
  type: "webhook" | "cron" | "manual" | "reaction"
  event: string
  data: Record<string, unknown>
}

export interface AutonomySettings {
  autoClassify: boolean
  autoUpdateDRE: boolean
  autoBillReconcile: boolean
  runwayAlertMonths: number
  varianceAlertPercent: number
  singleTransactionLimit: number
  notifyEmail: boolean
  notifyWhatsapp: boolean
  whatsappNumber: string
}

const DEFAULT_SETTINGS: AutonomySettings = {
  autoClassify: true,
  autoUpdateDRE: true,
  autoBillReconcile: true,
  runwayAlertMonths: 3,
  varianceAlertPercent: 20,
  singleTransactionLimit: 50000,
  notifyEmail: true,
  notifyWhatsapp: false,
  whatsappNumber: "",
}

// ---------------------------------------------------------------------------
// Core decision cycle
// ---------------------------------------------------------------------------
export async function runDecisionCycle(
  orgId: string,
  trigger: AgentTrigger
): Promise<AgentDecision[]> {
  const admin = createAdminClient()
  const decisions: AgentDecision[] = []
  const settings = await getAutonomySettings(orgId)

  switch (trigger.event) {
    case "transaction_created": {
      const txs = trigger.data.transactions as Array<{
        id: string
        description: string
        amount: number
        account_code: string
        date: string
      }>

      for (const tx of txs) {
        // 1. Classify if unclassified
        if (!tx.account_code || tx.account_code === "unclassified") {
          decisions.push({
            action: "classify",
            priority: "high",
            context: { transactionId: tx.id, description: tx.description, amount: tx.amount },
            reasoning: `Transacao "${tx.description}" R$ ${Math.abs(tx.amount)} nao classificada`,
            automated: settings.autoClassify,
          })
        }

        // 2. Check for large transaction alert
        if (Math.abs(tx.amount) > settings.singleTransactionLimit) {
          decisions.push({
            action: "alert",
            priority: "high",
            context: { transactionId: tx.id, amount: tx.amount, description: tx.description },
            reasoning: `Transacao acima do limite: R$ ${Math.abs(tx.amount).toLocaleString("pt-BR")} (limite: R$ ${settings.singleTransactionLimit.toLocaleString("pt-BR")})`,
            automated: true,
          })
        }

        // 3. Update DRE if classified
        if (tx.account_code && tx.account_code !== "unclassified" && settings.autoUpdateDRE) {
          decisions.push({
            action: "update_dre",
            priority: "medium",
            context: { transactionId: tx.id, accountCode: tx.account_code, amount: tx.amount, month: tx.date.slice(0, 7) },
            reasoning: `Atualizar DRE com transacao classificada como "${tx.account_code}"`,
            automated: true,
          })
        }
      }

      // 4. Check anomalies (revenue above projected = celebrate)
      break
    }

    case "bill_due_soon": {
      const bills = trigger.data.bills as Array<{
        id: string
        description: string
        amount: number
        due_date: string
        days_until: number
      }>

      for (const bill of bills) {
        const priority: Priority = bill.days_until <= 1 ? "critical" : bill.days_until <= 3 ? "high" : "medium"
        decisions.push({
          action: "notify",
          priority,
          context: { billId: bill.id, amount: bill.amount, dueDate: bill.due_date, description: bill.description },
          reasoning: `Conta "${bill.description}" R$ ${bill.amount.toLocaleString("pt-BR")} vence em ${bill.days_until} dia(s)`,
          automated: true,
        })
      }
      break
    }

    case "credit_card_due": {
      const card = trigger.data as { accountName: string; totalDue: number; dueDate: string; daysUntil: number }
      decisions.push({
        action: "notify",
        priority: card.daysUntil <= 2 ? "critical" : "high",
        context: { ...card },
        reasoning: `Fatura cartao "${card.accountName}" R$ ${card.totalDue.toLocaleString("pt-BR")} vence em ${card.daysUntil} dia(s)`,
        automated: true,
      })
      break
    }

    case "daily_check": {
      // Run financial health check
      const { analyzeFinancialHealth } = await import("./financial-analyst")
      const health = await analyzeFinancialHealth(orgId)

      // Runway alert
      if (health.runwayMonths < settings.runwayAlertMonths) {
        decisions.push({
          action: "alert",
          priority: health.runwayMonths < 1 ? "critical" : "high",
          context: { runwayMonths: health.runwayMonths, burnRate: health.burnRate, cash: health.cashBalance },
          reasoning: `Runway ${health.runwayMonths.toFixed(1)} meses (alerta: < ${settings.runwayAlertMonths})`,
          automated: true,
        })

        // Generate action plan if critical
        if (health.runwayMonths < 1) {
          decisions.push({
            action: "plan",
            priority: "critical",
            context: { runwayMonths: health.runwayMonths, burnRate: health.burnRate },
            reasoning: "Runway critico — gerando plano de acao emergencial via Claude AI",
            automated: true,
          })
        }
      }

      // Revenue above projected
      if (health.revenueVsProjected > 0.1) {
        decisions.push({
          action: "celebrate",
          priority: "low",
          context: { revenueVsProjected: health.revenueVsProjected, revenue: health.revenue },
          reasoning: `Receita ${(health.revenueVsProjected * 100).toFixed(0)}% acima do projetado`,
          automated: true,
        })
      }

      // Check unclassified transactions > 24h
      const { data: unclassified } = await admin
        .from("transactions")
        .select("id, notes, amount")
        .eq("organization_id", orgId)
        .or("account_code.is.null,account_code.eq.unclassified")
        .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(20)

      if (unclassified && unclassified.length > 0) {
        decisions.push({
          action: "classify",
          priority: "medium",
          context: { count: unclassified.length, transactionIds: unclassified.map((t) => t.id) },
          reasoning: `${unclassified.length} transacoes sem classificacao ha mais de 24h`,
          automated: settings.autoClassify,
        })
      }

      break
    }

    case "variance_detected": {
      const variance = trigger.data as { accountCode: string; estimado: number; realizado: number; variancePercent: number }
      if (Math.abs(variance.variancePercent) > settings.varianceAlertPercent) {
        decisions.push({
          action: "alert",
          priority: Math.abs(variance.variancePercent) > 50 ? "critical" : "high",
          context: variance,
          reasoning: `Variancia ${variance.variancePercent.toFixed(1)}% em "${variance.accountCode}" (limite: ${settings.varianceAlertPercent}%)`,
          automated: true,
        })
      }
      break
    }
  }

  // Log all decisions
  for (const decision of decisions) {
    await logAgentAction(orgId, decision, trigger)
  }

  return decisions
}

// ---------------------------------------------------------------------------
// Execute decisions
// ---------------------------------------------------------------------------
export async function executeDecisions(
  orgId: string,
  decisions: AgentDecision[]
): Promise<void> {
  for (const decision of decisions) {
    if (!decision.automated) continue

    try {
      switch (decision.action) {
        case "classify": {
          const { classifyWithMemory } = await import("./classifier")
          await classifyWithMemory(orgId, decision.context)
          break
        }
        case "update_dre": {
          const { updateDREFromTransaction } = await import("./dre-updater")
          await updateDREFromTransaction(orgId, decision.context)
          break
        }
        case "alert": {
          const { createAlert } = await import("@/lib/supabase/queries")
          await createAlert(orgId, {
            type: "anomaly",
            severity: decision.priority === "critical" ? "critical" : "warning",
            title: decision.reasoning,
            message: JSON.stringify(decision.context),
          })

          // Also notify via configured channels
          const settings = await getAutonomySettings(orgId)
          if (settings.notifyWhatsapp && settings.whatsappNumber) {
            const { sendWhatsAppText } = await import("@/lib/notifications/whatsapp")
            const { buildCriticalAlertMessage } = await import("@/lib/notifications/message-templates")
            await sendWhatsAppText(settings.whatsappNumber, buildCriticalAlertMessage({
              type: decision.priority === "critical" ? "runway_low" : "variance_high",
              title: decision.action,
              details: decision.reasoning,
            }))
          }
          break
        }
        case "notify": {
          const settings = await getAutonomySettings(orgId)
          if (settings.notifyWhatsapp && settings.whatsappNumber) {
            const { sendWhatsAppText } = await import("@/lib/notifications/whatsapp")
            const { buildCriticalAlertMessage } = await import("@/lib/notifications/message-templates")
            await sendWhatsAppText(settings.whatsappNumber, buildCriticalAlertMessage({
              type: "bill_due" as "overdue_bill",
              title: "Contas a Pagar",
              details: decision.reasoning,
            }))
          }
          break
        }
        case "plan": {
          const planPrompt = `Gere um plano de acao emergencial para uma startup com runway de ${(decision.context.runwayMonths as number).toFixed(1)} meses e burn rate de R$ ${(decision.context.burnRate as number).toLocaleString("pt-BR")}/mes. Inclua: 1) Cortes imediatos, 2) Acoes de receita rapida, 3) Opcoes de captacao emergencial. Seja direto e pratico.`
          const plan = await chatCompletion(planPrompt)
          await saveAgentMemory(orgId, "decision", "emergency_plan", { plan, generatedAt: new Date().toISOString() })
          break
        }
        case "reconcile": {
          const { reconcileBillWithTransaction } = await import("./bill-manager")
          await reconcileBillWithTransaction(orgId, decision.context)
          break
        }
        case "celebrate":
        case "report":
        case "schedule_payment":
          // Logged but not auto-executed
          break
      }

      await updateActionStatus(orgId, decision, "executed")
    } catch (err) {
      console.error(`[Agent] Failed to execute ${decision.action}:`, err)
      await updateActionStatus(orgId, decision, "failed")
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getAutonomySettings(orgId: string): Promise<AutonomySettings> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("autonomy_settings")
    .select("*")
    .eq("organization_id", orgId)
    .single()

  if (!data) return DEFAULT_SETTINGS

  return {
    autoClassify: data.auto_classify ?? DEFAULT_SETTINGS.autoClassify,
    autoUpdateDRE: data.auto_update_dre ?? DEFAULT_SETTINGS.autoUpdateDRE,
    autoBillReconcile: data.auto_bill_reconcile ?? DEFAULT_SETTINGS.autoBillReconcile,
    runwayAlertMonths: data.runway_alert_months ?? DEFAULT_SETTINGS.runwayAlertMonths,
    varianceAlertPercent: data.variance_alert_percent ?? DEFAULT_SETTINGS.varianceAlertPercent,
    singleTransactionLimit: data.single_transaction_limit ?? DEFAULT_SETTINGS.singleTransactionLimit,
    notifyEmail: data.notify_email ?? DEFAULT_SETTINGS.notifyEmail,
    notifyWhatsapp: data.notify_whatsapp ?? DEFAULT_SETTINGS.notifyWhatsapp,
    whatsappNumber: data.whatsapp_number ?? DEFAULT_SETTINGS.whatsappNumber,
  }
}

export { getAutonomySettings }

async function logAgentAction(
  orgId: string,
  decision: AgentDecision,
  trigger: AgentTrigger
): Promise<void> {
  const admin = createAdminClient()
  await admin.from("agent_actions").insert({
    organization_id: orgId,
    action: decision.action,
    priority: decision.priority,
    trigger_type: trigger.type,
    trigger_id: trigger.data.id as string ?? null,
    reasoning: decision.reasoning,
    context: decision.context,
    status: decision.automated ? "pending" : "pending",
    automated: decision.automated,
    requires_approval: !decision.automated,
  })
}

async function updateActionStatus(
  orgId: string,
  decision: AgentDecision,
  status: "executed" | "failed"
): Promise<void> {
  const admin = createAdminClient()
  await admin
    .from("agent_actions")
    .update({ status, executed_at: status === "executed" ? new Date().toISOString() : null })
    .eq("organization_id", orgId)
    .eq("action", decision.action)
    .eq("reasoning", decision.reasoning)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
}

export async function saveAgentMemory(
  orgId: string,
  memoryType: "decision" | "pattern" | "context" | "learning",
  key: string,
  value: Record<string, unknown>,
  confidence = 1.0
): Promise<void> {
  const admin = createAdminClient()
  await admin.from("agent_memory").upsert(
    {
      organization_id: orgId,
      memory_type: memoryType,
      key,
      value,
      confidence,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,key" }
  )
}

export async function getAgentMemory(
  orgId: string,
  memoryType?: string,
  key?: string
): Promise<Array<{ key: string; value: Record<string, unknown>; confidence: number }>> {
  const admin = createAdminClient()
  let query = admin
    .from("agent_memory")
    .select("key, value, confidence")
    .eq("organization_id", orgId)

  if (memoryType) query = query.eq("memory_type", memoryType)
  if (key) query = query.eq("key", key)

  const { data } = await query.order("updated_at", { ascending: false }).limit(50)
  return (data ?? []) as Array<{ key: string; value: Record<string, unknown>; confidence: number }>
}
