// ---------------------------------------------------------------------------
// Email HTML templates — all text in Brazilian Portuguese
// ---------------------------------------------------------------------------

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.assumfit.com.br"

function fmt(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1e293b;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#22c55e;padding:20px 24px;">
    <h1 style="margin:0;color:#0f172a;font-size:20px;font-weight:700;">ASSUMFIT CFO</h1>
    <p style="margin:4px 0 0;color:#0f172a;font-size:13px;opacity:0.8;">${title}</p>
  </td></tr>
  <tr><td style="padding:24px;color:#e2e8f0;font-size:14px;line-height:1.6;">
    ${body}
  </td></tr>
  <tr><td style="padding:16px 24px;border-top:1px solid #334155;text-align:center;">
    <a href="${APP_URL}" style="color:#22c55e;font-size:12px;text-decoration:none;">Abrir Dashboard</a>
    <p style="color:#64748b;font-size:11px;margin:8px 0 0;">Enviado automaticamente pelo Agente Financeiro ASSUMFIT</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

// ---------------------------------------------------------------------------
// Daily Digest
// ---------------------------------------------------------------------------
export interface DailyDigestData {
  date: string
  kpis: {
    saldo: number
    burnRate: number
    runway: number
    receita: number
    ebitda: number
  }
  reconciliation: {
    ok: number
    warnings: number
    alerts: number
    totalEstimado: number
    totalRealizado: number
  }
  unclassifiedCount: number
  newTransactionsCount: number
  criticalAlerts: Array<{ title: string; message: string }>
  anomalies: string[]
}

export function buildDailyDigestEmail(data: DailyDigestData): string {
  const kpiRow = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px;color:#94a3b8;font-size:13px;">${label}</td><td style="padding:6px 12px;color:#f1f5f9;font-size:13px;font-weight:600;text-align:right;">${value}</td></tr>`

  const kpiSection = `
    <h2 style="color:#22c55e;font-size:15px;margin:0 0 12px;">KPIs do Dia</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;margin-bottom:20px;">
      ${kpiRow("Saldo", `R$ ${fmt(data.kpis.saldo)}`)}
      ${kpiRow("Burn Rate", `R$ ${fmt(data.kpis.burnRate)}/mes`)}
      ${kpiRow("Runway", `${data.kpis.runway.toFixed(1)} meses`)}
      ${kpiRow("Receita", `R$ ${fmt(data.kpis.receita)}`)}
      ${kpiRow("EBITDA", `R$ ${fmt(data.kpis.ebitda)}`)}
    </table>`

  const reconSection = `
    <h2 style="color:#22c55e;font-size:15px;margin:0 0 12px;">Conciliacao</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;margin-bottom:20px;">
      ${kpiRow("OK", `${data.reconciliation.ok} contas`)}
      ${kpiRow("Atencao", `${data.reconciliation.warnings} contas`)}
      ${kpiRow("Alerta", `${data.reconciliation.alerts} contas`)}
      ${kpiRow("Total Estimado", `R$ ${fmt(data.reconciliation.totalEstimado)}`)}
      ${kpiRow("Total Realizado", `R$ ${fmt(data.reconciliation.totalRealizado)}`)}
    </table>`

  const alertsSection = data.criticalAlerts.length > 0
    ? `<h2 style="color:#ef4444;font-size:15px;margin:0 0 12px;">Alertas Criticos (${data.criticalAlerts.length})</h2>
       <div style="background:#0f172a;border-radius:8px;padding:12px;margin-bottom:20px;">
         ${data.criticalAlerts.map((a) => `<p style="margin:8px 0;color:#fca5a5;font-size:13px;"><strong>${a.title}</strong><br><span style="color:#94a3b8;">${a.message}</span></p>`).join("")}
       </div>`
    : ""

  const unclassifiedSection = data.unclassifiedCount > 0
    ? `<p style="color:#fbbf24;font-size:13px;margin-bottom:16px;">&#9888; ${data.unclassifiedCount} transacoes sem classificacao</p>`
    : `<p style="color:#22c55e;font-size:13px;margin-bottom:16px;">&#10003; Todas as transacoes classificadas</p>`

  const anomalySection = data.anomalies.length > 0
    ? `<h2 style="color:#f59e0b;font-size:15px;margin:0 0 12px;">Anomalias Detectadas</h2>
       <ul style="color:#fcd34d;font-size:13px;padding-left:20px;margin-bottom:20px;">
         ${data.anomalies.map((a) => `<li style="margin:4px 0;">${a}</li>`).join("")}
       </ul>`
    : ""

  return layout(
    `Resumo Diario — ${data.date}`,
    `<p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">${data.newTransactionsCount} novas transacoes processadas</p>
     ${kpiSection}${reconSection}${unclassifiedSection}${alertsSection}${anomalySection}`
  )
}

// ---------------------------------------------------------------------------
// Monthly Close
// ---------------------------------------------------------------------------
export interface MonthlyCloseData {
  month: string
  checklist: string[]
  dreData: Record<string, number>
  boardReport: string
  budgetComparison: string
  alertsSummary: { total: number; critical: number; warning: number; info: number }
}

export function buildMonthlyCloseEmail(data: MonthlyCloseData): string {
  const checklistSection = `
    <h2 style="color:#22c55e;font-size:15px;margin:0 0 12px;">Checklist de Fechamento</h2>
    <div style="background:#0f172a;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;white-space:pre-line;color:#e2e8f0;">
${data.checklist.join("\n")}
    </div>`

  const dreLines = Object.entries(data.dreData)
    .map(([item, amount]) =>
      `<tr><td style="padding:4px 12px;color:#94a3b8;font-size:13px;">${item}</td><td style="padding:4px 12px;color:#f1f5f9;font-size:13px;text-align:right;">R$ ${fmt(amount)}</td></tr>`
    )
    .join("")

  const dreSection = dreLines
    ? `<h2 style="color:#22c55e;font-size:15px;margin:0 0 12px;">DRE — ${data.month}</h2>
       <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;margin-bottom:20px;">
         ${dreLines}
       </table>`
    : ""

  const budgetSection = data.budgetComparison
    ? `<h2 style="color:#22c55e;font-size:15px;margin:0 0 12px;">Budget vs Realizado</h2>
       <div style="background:#0f172a;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;white-space:pre-line;color:#e2e8f0;">
${data.budgetComparison}
       </div>`
    : ""

  const boardSection = data.boardReport
    ? `<h2 style="color:#22c55e;font-size:15px;margin:0 0 12px;">Board Report</h2>
       <div style="background:#0f172a;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;white-space:pre-line;color:#e2e8f0;">
${data.boardReport}
       </div>`
    : ""

  const alertsSummary = `
    <p style="color:#94a3b8;font-size:13px;margin-bottom:20px;">
      Alertas do mes: ${data.alertsSummary.total} total
      (${data.alertsSummary.critical} criticos, ${data.alertsSummary.warning} atencao, ${data.alertsSummary.info} info)
    </p>`

  return layout(
    `Fechamento Mensal — ${data.month}`,
    `${checklistSection}${dreSection}${budgetSection}${boardSection}${alertsSummary}`
  )
}

// ---------------------------------------------------------------------------
// Organization Invite
// ---------------------------------------------------------------------------
export interface InviteEmailData {
  inviterName: string
  orgName: string
  role: string
  token: string
}

export function buildInviteEmail(data: InviteEmailData): string {
  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    editor: "Editor",
    viewer: "Visualizador",
  }
  const roleLabel = roleLabels[data.role] ?? data.role
  const acceptUrl = `${APP_URL}/convite/${data.token}`

  return layout(
    `Convite para ${data.orgName}`,
    `<div style="background:#0f172a;border-radius:8px;padding:20px;margin-bottom:20px;text-align:center;">
       <p style="color:#94a3b8;font-size:14px;margin:0 0 8px;">Voce foi convidado por</p>
       <p style="color:#f1f5f9;font-size:18px;font-weight:700;margin:0 0 4px;">${data.inviterName}</p>
       <p style="color:#94a3b8;font-size:13px;margin:0;">para participar da organizacao</p>
       <p style="color:#22c55e;font-size:16px;font-weight:600;margin:8px 0;">${data.orgName}</p>
       <p style="color:#94a3b8;font-size:13px;margin:0;">como <strong style="color:#f1f5f9;">${roleLabel}</strong></p>
     </div>
     <div style="text-align:center;margin-bottom:20px;">
       <a href="${acceptUrl}" style="display:inline-block;background:#22c55e;color:#0f172a;font-weight:700;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;">
         Aceitar Convite
       </a>
     </div>
     <p style="color:#64748b;font-size:12px;text-align:center;">
       Este convite expira em 7 dias. Se voce nao esperava este email, pode ignora-lo.
     </p>`
  )
}

// ---------------------------------------------------------------------------
// Critical Alert
// ---------------------------------------------------------------------------
export interface CriticalAlertData {
  title: string
  message: string
  severity: string
  data?: Record<string, unknown>
}

export function buildCriticalAlertEmail(alert: CriticalAlertData): string {
  const contextSection = alert.data
    ? `<div style="background:#0f172a;border-radius:8px;padding:12px;margin-top:16px;font-size:12px;color:#94a3b8;">
         <strong>Contexto:</strong><br>
         <pre style="margin:8px 0 0;white-space:pre-wrap;color:#cbd5e1;">${JSON.stringify(alert.data, null, 2)}</pre>
       </div>`
    : ""

  return layout(
    `[CRITICO] ${alert.title}`,
    `<div style="background:#7f1d1d;border:1px solid #ef4444;border-radius:8px;padding:16px;margin-bottom:20px;">
       <h2 style="color:#fca5a5;font-size:16px;margin:0 0 8px;">${alert.title}</h2>
       <p style="color:#fecaca;font-size:14px;margin:0;">${alert.message}</p>
     </div>
     ${contextSection}
     <p style="color:#94a3b8;font-size:13px;margin-top:20px;">Abra o dashboard para investigar e tomar acao.</p>`
  )
}
