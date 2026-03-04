import Anthropic from "@anthropic-ai/sdk"
import { MONTHLY_DATA, CURRENT_SNAPSHOT, TOP_EXPENSES } from "@/config/seed-data"
import { BUSINESS_PHASES } from "@/config/constants"
import { getCurrentPhase } from "@/config/phases"

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === "your-anthropic-key") {
      throw new Error("ANTHROPIC_API_KEY nao configurada no .env.local")
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

/**
 * Build the financial system prompt with current company context
 */
export function buildSystemPrompt(): string {
  const phase = getCurrentPhase()
  const phaseConfig = BUSINESS_PHASES[phase]
  const snap = CURRENT_SNAPSHOT

  const dreMonths = MONTHLY_DATA.filter((d) => d.receita !== null)
  const latestDre = dreMonths[dreMonths.length - 1]
  const latestWithRevenue = dreMonths.filter((d) => (d.receita ?? 0) > 0).pop()

  return `Voce e o CFO AI Assistant da ASSUMFIT, uma startup fitness/wellness com a marca MUVX.
Voce responde em portugues brasileiro de forma direta e profissional, usando dados reais da empresa.

## Contexto da Empresa
- Empresa: ASSUMFIT (marca: MUVX)
- Segmento: Fitness & Wellness SaaS
- Fase atual: ${phaseConfig.label} (${phaseConfig.dateRange.start} a ${phaseConfig.dateRange.end})
- Produtos: MUVX Core (marketplace trainers), MUVX Digital (plataforma digital), MUVX Influencia

## Snapshot Financeiro Atual (${snap.month})
- Saldo de Caixa: R$ ${snap.saldo_caixa.toLocaleString("pt-BR")}
- Burn Rate Mensal: R$ ${snap.burn_rate.toLocaleString("pt-BR")}
- Runway: ${snap.runway_meses.toFixed(1)} meses
- EBITDA: R$ ${snap.ebitda.toLocaleString("pt-BR")}
- Custos Fixos: R$ ${snap.custos_fixos.toLocaleString("pt-BR")}
- Despesas Variaveis: R$ ${snap.despesas_variaveis.toLocaleString("pt-BR")}

## Maiores Custos
${TOP_EXPENSES.map((e) => `- ${e.name}: R$ ${e.value.toLocaleString("pt-BR")}`).join("\n")}

## DRE Mensal (Jan-Dez/26)
${dreMonths.map((d) => `${d.month}: Receita=${d.receita?.toLocaleString("pt-BR") ?? "0"} | EBITDA=${d.ebitda?.toLocaleString("pt-BR") ?? "0"} | BurnRate=${d.burnRate?.toLocaleString("pt-BR") ?? "0"}`).join("\n")}

## Fases do Negocio
- PROJETO (Jul-Out/25): Desenvolvimento do produto
- GO-LIVE E HYPERCARE (Nov-Dez/25): Lancamento
- TRACAO (Jan-Abr/26): Primeiros clientes
- PRE-ESCALA (Mai/26+): Crescimento acelerado

## Regras
1. Sempre use dados reais da planilha quando disponiveis
2. Formate valores monetarios como R$ X.XXX,XX
3. Seja conciso mas preciso
4. Identifique riscos e oportunidades proativamente
5. Sugira acoes concretas quando apropriado
6. Se nao tiver dados suficientes, diga claramente`
}

/**
 * Send a message to Claude with financial context and stream the response
 */
export async function* streamChat(
  messages: { role: "user" | "assistant"; content: string }[]
): AsyncGenerator<string> {
  const anthropic = getClient()
  const systemPrompt = buildSystemPrompt()

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  })

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text
    }
  }
}

/**
 * Non-streaming single response (for classification, insights)
 */
export async function chatCompletion(
  userMessage: string,
  systemOverride?: string
): Promise<string> {
  const anthropic = getClient()
  const system = systemOverride || buildSystemPrompt()

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: userMessage }],
  })

  const textBlock = response.content.find((b) => b.type === "text")
  return textBlock ? textBlock.text : ""
}
