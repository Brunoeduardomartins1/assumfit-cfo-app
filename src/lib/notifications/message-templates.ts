/**
 * Message templates for WhatsApp and email notifications.
 */

interface DailySummaryData {
  date: string
  score: number
  revenue: number
  burnRate: number
  runwayMonths: number
  cashBalance: number
  pendingBills: number
  overdueCount: number
  newTransactions: number
}

interface CriticalAlertData {
  type: "runway_low" | "variance_high" | "overdue_bill" | "large_transaction"
  title: string
  details: string
  actionRequired?: string
}

interface BillDueData {
  description: string
  amount: number
  dueDate: string
  daysUntil: number
  supplier?: string
}

/**
 * Daily financial summary for WhatsApp.
 */
export function buildDailySummaryMessage(data: DailySummaryData): string {
  const scoreEmoji = data.score >= 70 ? "🟢" : data.score >= 40 ? "🟡" : "🔴"
  const lines = [
    `📊 *ASSUMFIT CFO — Resumo Diário*`,
    `📅 ${data.date}`,
    ``,
    `${scoreEmoji} Saúde Financeira: *${data.score}/100*`,
    ``,
    `💰 Receita: R$ ${formatCurrency(data.revenue)}`,
    `🔥 Burn Rate: R$ ${formatCurrency(data.burnRate)}/mês`,
    `🏦 Saldo: R$ ${formatCurrency(data.cashBalance)}`,
    `⏳ Runway: *${data.runwayMonths.toFixed(1)} meses*`,
    ``,
  ]

  if (data.pendingBills > 0) {
    lines.push(`📋 ${data.pendingBills} conta(s) a pagar nos próximos 7 dias`)
  }
  if (data.overdueCount > 0) {
    lines.push(`⚠️ ${data.overdueCount} conta(s) em atraso!`)
  }
  if (data.newTransactions > 0) {
    lines.push(`🔄 ${data.newTransactions} transações novas classificadas`)
  }

  lines.push(``, `_Enviado automaticamente pelo ASSUMFIT CFO_`)
  return lines.join("\n")
}

/**
 * Critical alert for WhatsApp.
 */
export function buildCriticalAlertMessage(data: CriticalAlertData): string {
  const typeEmoji: Record<string, string> = {
    runway_low: "🚨",
    variance_high: "⚠️",
    overdue_bill: "💸",
    large_transaction: "💳",
  }

  const lines = [
    `${typeEmoji[data.type] ?? "⚠️"} *ALERTA — ASSUMFIT CFO*`,
    ``,
    `*${data.title}*`,
    ``,
    data.details,
  ]

  if (data.actionRequired) {
    lines.push(``, `📌 *Ação necessária:* ${data.actionRequired}`)
  }

  lines.push(``, `_Responda "OK" para confirmar recebimento_`)
  return lines.join("\n")
}

/**
 * Bill due reminder for WhatsApp.
 */
export function buildBillDueMessage(bills: BillDueData[]): string {
  if (bills.length === 0) return ""

  const lines = [
    `📋 *Contas a Pagar — Próximos 7 dias*`,
    ``,
  ]

  for (const bill of bills) {
    const urgency = bill.daysUntil <= 1 ? "🔴" : bill.daysUntil <= 3 ? "🟡" : "🟢"
    lines.push(
      `${urgency} *${bill.description}*`,
      `   R$ ${formatCurrency(bill.amount)} — vence em ${bill.daysUntil} dia(s) (${bill.dueDate})`,
      ``
    )
  }

  const total = bills.reduce((s, b) => s + b.amount, 0)
  lines.push(`💰 *Total:* R$ ${formatCurrency(total)}`)
  lines.push(``, `_Enviado automaticamente pelo ASSUMFIT CFO_`)
  return lines.join("\n")
}

/**
 * Weekly celebration / milestone message.
 */
export function buildCelebrationMessage(
  milestone: string,
  details: string
): string {
  return [
    `🎉 *ASSUMFIT CFO — Marco Atingido!*`,
    ``,
    `*${milestone}*`,
    ``,
    details,
    ``,
    `_Continue assim! 🚀_`,
  ].join("\n")
}

/**
 * Board report ready notification.
 */
export function buildReportReadyMessage(
  period: string,
  score: number,
  reportUrl?: string
): string {
  const lines = [
    `📄 *Board Report — ${period}*`,
    ``,
    `O relatório mensal foi gerado automaticamente.`,
    `Score de saúde: *${score}/100*`,
  ]

  if (reportUrl) {
    lines.push(``, `🔗 Ver relatório: ${reportUrl}`)
  }

  lines.push(``, `_Deseja que eu envie por email também? Responda "SIM"_`)
  return lines.join("\n")
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
