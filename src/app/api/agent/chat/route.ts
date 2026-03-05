import { NextRequest, NextResponse } from "next/server"
import { chatCompletion } from "@/lib/ai/claude-client"
import { analyzeFinancialHealth } from "@/lib/agent/financial-analyst"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * POST /api/agent/chat
 * Called by N8N when user sends a WhatsApp message that needs AI response.
 * Returns a concise text reply suitable for WhatsApp.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { message } = await req.json()
  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get org
  const orgId = process.env.DEFAULT_ORG_ID
  let health = null
  try {
    if (orgId) {
      health = await analyzeFinancialHealth(orgId)
    }
  } catch {
    // Continue without health data
  }

  const contextLines = health
    ? [
        `Score de saúde: ${health.score}/100`,
        `Receita: R$ ${health.revenue.toLocaleString("pt-BR")}`,
        `Burn Rate: R$ ${health.burnRate.toLocaleString("pt-BR")}/mês`,
        `Saldo: R$ ${health.cashBalance.toLocaleString("pt-BR")}`,
        `Runway: ${health.runwayMonths.toFixed(1)} meses`,
        `CAC: R$ ${health.cac.toLocaleString("pt-BR")}`,
        `LTV: R$ ${health.ltv.toLocaleString("pt-BR")}`,
        `Riscos: ${health.topRisks.join("; ") || "Nenhum"}`,
      ]
    : []

  const prompt = `Voce e o CFO AI da ASSUMFIT/MUVX. Responda de forma concisa e direta, em portugues, adequado para WhatsApp (sem markdown pesado, use * para negrito).

${contextLines.length > 0 ? `Contexto financeiro atual:\n${contextLines.join("\n")}\n` : ""}
Pergunta do usuario: ${message}

Responda em no maximo 500 caracteres. Seja pratico e direto.`

  try {
    const reply = await chatCompletion(prompt)
    return NextResponse.json({ reply, phone: null })
  } catch (error) {
    console.error("[Agent/Chat] Error:", error)
    return NextResponse.json({
      reply: "Desculpe, nao consegui processar sua pergunta no momento. Tente novamente em alguns minutos.",
    })
  }
}
