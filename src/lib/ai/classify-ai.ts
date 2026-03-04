import { chatCompletion } from "./claude-client"
import type { BankTransaction } from "@/types/open-finance"

const CLASSIFICATION_PROMPT = `Voce e um classificador de transacoes bancarias para a ASSUMFIT/MUVX.

Categorias disponiveis (plano de contas):
- Custos com pessoal > Salários, Gympass/Wellhub, Salário CEO, Gerar (estágio), Férias, Ajuda de Custo
- Infraestrutura > Escritório, Base Executiva SP
- Software + Equipamentos > Office365, Figma, Adobe, Zendesk, Active Campaing, Asana, Canva, CapCut, Typeform, Manychat, Lovable, Supabase, ChatGPT, Clicksign, Hostinger, Brazu, Framer, AWS, Railway, HubSpot, Freepik, Curseduca, Browserstack, Zoom, Claude
- Serviços de terceiros > Jurídico, Contabilidade, Trafego - Ramon, Consultoria - Matheus, Filmmaker, BPO - BeOrange, Criadora de Conteúdo
- Comissões > Embaixadores, Agencia Parça, Influenciadores
- Marketing e Growth > Influenciadores, Patrocínio Eventos, Trafego, Investimento MUVX Digital, Gestão Mkt Influencia, Embaixadores chaves, Identidade Visual/Marca/Branding
- Pessoas e Recrutamento > Treinamento MKT, LinkedIn Vagas, Eventos/Treinamentos Equipe
- Operacional > Press Kit, Passagens Aéreas, Hospedagens, Uber empresa, Club iFood
- Impostos > Impostos a Pagar
- Financeiro > Tarifas bancárias, IOF, Atrasos + Multas + Juros
- Capital > Integralização Capital Social, Empréstimo Sócio, Empréstimo Bancário
- Receita > Receita MUVX %, Receita MUVX Premium, Receita MUVX (Alunos) Fee, Receita Embaixadores, Receita Influencer, Receita MUVX Digital

Responda SOMENTE com JSON no formato: {"account": "Nome da conta", "confidence": "high"|"medium"|"low"}
Se nao conseguir classificar, responda: {"account": null, "confidence": "low"}`

/**
 * Use Claude AI to classify a transaction that rules-based matching couldn't handle
 */
export async function classifyWithAI(
  tx: BankTransaction
): Promise<{ account: string | null; confidence: "high" | "medium" | "low" }> {
  try {
    const response = await chatCompletion(
      `Classifique esta transacao bancaria:
- Descricao: ${tx.description}
- Valor: R$ ${Math.abs(tx.amount).toLocaleString("pt-BR")}
- Tipo: ${tx.type === "debit" ? "Débito (saída)" : "Crédito (entrada)"}
- Data: ${tx.date}`,
      CLASSIFICATION_PROMPT
    )

    const parsed = JSON.parse(response.trim())
    return {
      account: parsed.account || null,
      confidence: parsed.confidence || "low",
    }
  } catch {
    return { account: null, confidence: "low" }
  }
}

/**
 * Batch classify unclassified transactions using AI
 */
export async function batchClassifyWithAI(
  transactions: BankTransaction[]
): Promise<BankTransaction[]> {
  const results: BankTransaction[] = []

  for (const tx of transactions) {
    if (!tx.classifiedAccount) {
      const result = await classifyWithAI(tx)
      results.push({
        ...tx,
        classifiedAccount: result.account ?? undefined,
        categoryConfidence: result.confidence,
      })
    } else {
      results.push(tx)
    }
  }

  return results
}
