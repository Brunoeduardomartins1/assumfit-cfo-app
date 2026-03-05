import { createAdminClient } from "@/lib/supabase/admin"
import { chatCompletion } from "@/lib/ai/claude-client"
import { analyzeFinancialHealth } from "./financial-analyst"

export interface GeneratedReport {
  id: string
  title: string
  period: string
  narrative: string
  kpiSnapshot: Record<string, unknown>
}

/**
 * Generate a board report with AI narrative.
 */
export async function generateBoardReport(
  orgId: string,
  period?: string
): Promise<GeneratedReport> {
  const admin = createAdminClient()
  const now = new Date()
  const targetPeriod = period ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  // Get financial health data
  const health = await analyzeFinancialHealth(orgId)

  // Get DRE for the period
  const { data: dreData } = await admin
    .from("income_statement")
    .select("line_item, amount")
    .eq("organization_id", orgId)
    .like("month", `${targetPeriod}%`)

  const dreMap: Record<string, number> = {}
  for (const d of dreData ?? []) {
    dreMap[d.line_item] = Number(d.amount)
  }

  // Generate AI narrative
  const narrativePrompt = `Gere uma narrativa executiva em portugues para o board report mensal da ASSUMFIT/MUVX.

Periodo: ${targetPeriod}
Score de Saude Financeira: ${health.score}/100

KPIs:
- Receita: R$ ${health.revenue.toLocaleString("pt-BR")} (${(health.revenueMoM * 100).toFixed(1)}% MoM)
- EBITDA: R$ ${health.ebitda.toLocaleString("pt-BR")}
- Burn Rate: R$ ${health.burnRate.toLocaleString("pt-BR")}/mes (${(health.burnRateMoM * 100).toFixed(1)}% MoM)
- Saldo: R$ ${health.cashBalance.toLocaleString("pt-BR")}
- Runway: ${health.runwayMonths.toFixed(1)} meses
- CAC: R$ ${health.cac.toLocaleString("pt-BR")}
- LTV: R$ ${health.ltv.toLocaleString("pt-BR")}
- LTV/CAC: ${health.cac > 0 ? (health.ltv / health.cac).toFixed(1) : "N/A"}x

Top Riscos: ${health.topRisks.join("; ") || "Nenhum identificado"}
Oportunidades: ${health.topOpportunities.join("; ") || "Nenhuma identificada"}

Escreva 4 secoes:
1. Executive Summary (2-3 frases)
2. Performance do Periodo (metricas com comparacao MoM)
3. Riscos e Atencao
4. Proximos Passos (acoes concretas)

Tom: profissional, direto, para investidores. Formato markdown.`

  let narrative = ""
  try {
    narrative = await chatCompletion(narrativePrompt)
  } catch (err) {
    console.error("[ReportGen] AI narrative failed:", err)
    narrative = `## Board Report — ${targetPeriod}\n\nNarrativa nao disponivel. Verifique a chave da API.`
  }

  // Save report
  const kpiSnapshot = {
    score: health.score,
    revenue: health.revenue,
    revenueMoM: health.revenueMoM,
    ebitda: health.ebitda,
    burnRate: health.burnRate,
    burnRateMoM: health.burnRateMoM,
    cashBalance: health.cashBalance,
    runwayMonths: health.runwayMonths,
    cac: health.cac,
    ltv: health.ltv,
    topRisks: health.topRisks,
    topOpportunities: health.topOpportunities,
    dre: dreMap,
  }

  const { data: report } = await admin
    .from("reports")
    .insert({
      organization_id: orgId,
      type: "board_report",
      title: `Board Report — ${targetPeriod}`,
      period: targetPeriod,
      content_markdown: narrative,
      narrative,
      kpi_snapshot: kpiSnapshot,
      generated_by: "agent",
    })
    .select("id")
    .single()

  return {
    id: report?.id ?? "",
    title: `Board Report — ${targetPeriod}`,
    period: targetPeriod,
    narrative,
    kpiSnapshot,
  }
}

/**
 * Send report via email.
 */
export async function sendReportByEmail(
  orgId: string,
  reportId: string,
  emails: string[]
): Promise<boolean> {
  const admin = createAdminClient()
  const { data: report } = await admin
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .single()

  if (!report) return false

  try {
    const { sendEmail } = await import("@/lib/email/resend-client")

    // Use a simplified email template
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1e293b;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#22c55e;padding:20px 24px;">
    <h1 style="margin:0;color:#0f172a;font-size:20px;">ASSUMFIT CFO</h1>
    <p style="margin:4px 0 0;color:#0f172a;font-size:13px;">${report.title}</p>
  </td></tr>
  <tr><td style="padding:24px;color:#e2e8f0;font-size:14px;line-height:1.6;white-space:pre-wrap;">
    ${report.narrative}
  </td></tr>
</table>
</td></tr></table>
</body></html>`

    for (const email of emails) {
      await sendEmail(email, report.title, html)
    }

    // Update report sent status
    await admin
      .from("reports")
      .update({ sent_at: new Date().toISOString(), sent_to: emails })
      .eq("id", reportId)

    return true
  } catch (err) {
    console.error("[ReportGen] Email send failed:", err)
    return false
  }
}
