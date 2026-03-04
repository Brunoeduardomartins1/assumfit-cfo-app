import type { BankTransaction, ClassificationRule } from "@/types/open-finance"

/**
 * Built-in classification rules for known vendors/categories.
 * Matches against transaction description using case-insensitive patterns.
 */
const DEFAULT_RULES: ClassificationRule[] = [
  // Software + Equipamentos
  { id: "r01", pattern: "figma", matchField: "description", accountCode: "software", accountLabel: "Figma", priority: 10 },
  { id: "r02", pattern: "adobe", matchField: "description", accountCode: "software", accountLabel: "Adobe", priority: 10 },
  { id: "r03", pattern: "atlassian|jira|bitbucket", matchField: "description", accountCode: "software", accountLabel: "Atlassian", priority: 10 },
  { id: "r04", pattern: "zendesk", matchField: "description", accountCode: "software", accountLabel: "Zendesk", priority: 10 },
  { id: "r05", pattern: "active.?campaign", matchField: "description", accountCode: "software", accountLabel: "Active Campaing", priority: 10 },
  { id: "r06", pattern: "asana", matchField: "description", accountCode: "software", accountLabel: "Asana", priority: 10 },
  { id: "r07", pattern: "canva", matchField: "description", accountCode: "software", accountLabel: "Canva", priority: 10 },
  { id: "r08", pattern: "typeform", matchField: "description", accountCode: "software", accountLabel: "Typeform", priority: 10 },
  { id: "r09", pattern: "manychat", matchField: "description", accountCode: "software", accountLabel: "Manychat", priority: 10 },
  { id: "r10", pattern: "supabase", matchField: "description", accountCode: "software", accountLabel: "Supabase", priority: 10 },
  { id: "r11", pattern: "openai|chatgpt", matchField: "description", accountCode: "software", accountLabel: "ChatGPT", priority: 10 },
  { id: "r12", pattern: "anthropic|claude", matchField: "description", accountCode: "software", accountLabel: "Claude", priority: 10 },
  { id: "r13", pattern: "hubspot", matchField: "description", accountCode: "software", accountLabel: "HubSpot", priority: 10 },
  { id: "r14", pattern: "hostinger", matchField: "description", accountCode: "software", accountLabel: "Hostinger", priority: 10 },
  { id: "r15", pattern: "aws|amazon.?web", matchField: "description", accountCode: "infra_aws", accountLabel: "AWS", priority: 10 },
  { id: "r16", pattern: "railway", matchField: "description", accountCode: "infra", accountLabel: "Railway", priority: 10 },
  { id: "r17", pattern: "zoom", matchField: "description", accountCode: "software", accountLabel: "Zoom", priority: 10 },
  { id: "r18", pattern: "office.?365|microsoft", matchField: "description", accountCode: "software", accountLabel: "Office365", priority: 8 },
  { id: "r19", pattern: "curseduca", matchField: "description", accountCode: "software", accountLabel: "Curseduca", priority: 10 },
  { id: "r20", pattern: "clicksign", matchField: "description", accountCode: "software", accountLabel: "Clicksign", priority: 10 },
  { id: "r21", pattern: "framer", matchField: "description", accountCode: "software", accountLabel: "Framer", priority: 10 },
  { id: "r22", pattern: "freepik", matchField: "description", accountCode: "software", accountLabel: "Freepik", priority: 10 },

  // Infraestrutura
  { id: "r30", pattern: "aluguel|escritorio|coworking", matchField: "description", accountCode: "infra_escritorio", accountLabel: "Escritorio", priority: 5 },

  // Pessoal
  { id: "r40", pattern: "salario|folha|holerite", matchField: "description", accountCode: "pessoal_salarios", accountLabel: "Salários", priority: 8 },
  { id: "r41", pattern: "gympass|wellhub", matchField: "description", accountCode: "pessoal_gympass", accountLabel: "Gympass/Wellhub", priority: 10 },
  { id: "r42", pattern: "gerar.?estagio|estagio", matchField: "description", accountCode: "pessoal_estagio", accountLabel: "Gerar (estágio)", priority: 8 },

  // Servicos de terceiros
  { id: "r50", pattern: "juridico|advocacia|adv\\b", matchField: "description", accountCode: "servicos_juridico", accountLabel: "Jurídico", priority: 7 },
  { id: "r51", pattern: "contab|contador", matchField: "description", accountCode: "servicos_contabilidade", accountLabel: "Contabilidade", priority: 7 },

  // Marketing
  { id: "r60", pattern: "meta.?ads|facebook.?ads|instagram.?ads", matchField: "description", accountCode: "mkt_trafego", accountLabel: "Trafego", priority: 8 },
  { id: "r61", pattern: "google.?ads", matchField: "description", accountCode: "mkt_trafego", accountLabel: "Trafego", priority: 8 },
  { id: "r62", pattern: "tiktok.?ads", matchField: "description", accountCode: "mkt_trafego", accountLabel: "Trafego", priority: 8 },

  // Financeiro
  { id: "r70", pattern: "iof", matchField: "description", accountCode: "fin_iof", accountLabel: "IOF", priority: 10 },
  { id: "r71", pattern: "tarifa|taxa.?banc", matchField: "description", accountCode: "fin_tarifas", accountLabel: "Tarifas bancárias", priority: 6 },
  { id: "r72", pattern: "juros|multa", matchField: "description", accountCode: "fin_juros", accountLabel: "Atrasos + Multas + Juros", priority: 5 },

  // Transporte
  { id: "r80", pattern: "uber|99|cabify", matchField: "description", accountCode: "op_uber", accountLabel: "Uber empresa", priority: 7 },
  { id: "r81", pattern: "ifood", matchField: "description", accountCode: "op_ifood", accountLabel: "Club iFood", priority: 7 },

  // Internal transfers (to be flagged, not classified)
  { id: "r90", pattern: "transferencia.?entre.?contas|ted.?propria|pix.?propri", matchField: "description", accountCode: "_internal_transfer", accountLabel: "Transferência interna", priority: 20 },
]

export interface ClassificationResult {
  accountCode: string
  accountLabel: string
  confidence: "high" | "medium" | "low"
  ruleId?: string
  isInternalTransfer: boolean
}

/**
 * Classify a transaction using rules-based matching.
 * Returns the best match or null if no rule matched.
 */
export function classifyTransaction(
  tx: BankTransaction,
  customRules: ClassificationRule[] = []
): ClassificationResult | null {
  const allRules = [...customRules, ...DEFAULT_RULES].sort(
    (a, b) => b.priority - a.priority
  )

  const description = tx.description.toLowerCase()

  for (const rule of allRules) {
    const field = rule.matchField === "description" ? description : description
    const regex = new RegExp(rule.pattern, "i")

    if (regex.test(field)) {
      const isInternal = rule.accountCode === "_internal_transfer"
      return {
        accountCode: rule.accountCode,
        accountLabel: rule.accountLabel,
        confidence: rule.priority >= 10 ? "high" : rule.priority >= 7 ? "medium" : "low",
        ruleId: rule.id,
        isInternalTransfer: isInternal,
      }
    }
  }

  return null
}

/**
 * Batch classify transactions
 */
export function classifyTransactions(
  transactions: BankTransaction[],
  customRules: ClassificationRule[] = []
): BankTransaction[] {
  return transactions.map((tx) => {
    const result = classifyTransaction(tx, customRules)
    if (result) {
      return {
        ...tx,
        classifiedAccount: result.accountLabel,
        categoryConfidence: result.confidence,
        isInternalTransfer: result.isInternalTransfer,
      }
    }
    return { ...tx, categoryConfidence: "low" as const }
  })
}

/**
 * Detect potential duplicate transactions
 */
export function flagDuplicates(transactions: BankTransaction[]): BankTransaction[] {
  const seen = new Map<string, BankTransaction>()

  return transactions.map((tx) => {
    // Key: same date + same amount + similar description
    const key = `${tx.date}|${tx.amount}`
    const existing = seen.get(key)

    if (existing && existing.id !== tx.id) {
      const descSimilar =
        existing.description.toLowerCase().substring(0, 20) ===
        tx.description.toLowerCase().substring(0, 20)
      if (descSimilar) {
        return { ...tx, isDuplicate: true }
      }
    }

    seen.set(key, tx)
    return tx
  })
}
