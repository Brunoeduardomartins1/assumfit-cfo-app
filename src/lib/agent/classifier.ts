import { createAdminClient } from "@/lib/supabase/admin"
import { chatCompletion } from "@/lib/ai/claude-client"
import { getAgentMemory, saveAgentMemory } from "./decision-engine"

interface ClassificationResult {
  transactionId: string
  accountCode: string
  confidence: number
  source: "memory" | "ai" | "rule"
}

/**
 * Classify transactions using memory-first approach:
 * 1. Check agent_memory for known patterns (description → account_code)
 * 2. If confidence >= 0.9, auto-classify
 * 3. Otherwise, use Claude AI for classification
 * 4. Save new pattern to memory
 */
export async function classifyWithMemory(
  orgId: string,
  context: Record<string, unknown>
): Promise<ClassificationResult[]> {
  const admin = createAdminClient()
  const results: ClassificationResult[] = []

  // Handle single transaction or batch
  const transactionIds = context.transactionIds as string[] | undefined
  const singleId = context.transactionId as string | undefined
  const ids = transactionIds ?? (singleId ? [singleId] : [])

  if (ids.length === 0) return results

  // Fetch transactions
  const { data: transactions } = await admin
    .from("transactions")
    .select("id, notes, amount, account_code")
    .in("id", ids)

  if (!transactions || transactions.length === 0) return results

  // Load classification patterns from memory
  const patterns = await getAgentMemory(orgId, "pattern")
  const patternMap = new Map<string, { accountCode: string; confidence: number }>()
  for (const p of patterns) {
    if (p.key.startsWith("classify:")) {
      const desc = p.key.replace("classify:", "").toLowerCase()
      patternMap.set(desc, {
        accountCode: (p.value as Record<string, string>).accountCode,
        confidence: p.confidence,
      })
    }
  }

  const needsAI: typeof transactions = []

  for (const tx of transactions) {
    const description = (tx.notes ?? "").toLowerCase().trim()
    if (!description) {
      needsAI.push(tx)
      continue
    }

    // Check exact match in memory
    const exact = patternMap.get(description)
    if (exact && exact.confidence >= 0.9) {
      results.push({
        transactionId: tx.id,
        accountCode: exact.accountCode,
        confidence: exact.confidence,
        source: "memory",
      })

      // Update in DB
      await admin
        .from("transactions")
        .update({ account_code: exact.accountCode })
        .eq("id", tx.id)

      continue
    }

    // Check partial match (first 3 words)
    const words = description.split(/\s+/).slice(0, 3).join(" ")
    const partial = patternMap.get(words)
    if (partial && partial.confidence >= 0.9) {
      results.push({
        transactionId: tx.id,
        accountCode: partial.accountCode,
        confidence: partial.confidence * 0.9,
        source: "memory",
      })

      await admin
        .from("transactions")
        .update({ account_code: partial.accountCode })
        .eq("id", tx.id)

      continue
    }

    needsAI.push(tx)
  }

  // Batch AI classification for remaining
  if (needsAI.length > 0) {
    const txList = needsAI
      .map((tx) => `ID: ${tx.id} | Desc: "${tx.notes}" | Valor: R$ ${Number(tx.amount).toLocaleString("pt-BR")}`)
      .join("\n")

    const prompt = `Classifique estas transacoes bancarias nas contas contabeis corretas.
Para cada transacao, responda APENAS com o formato: ID|CONTA_CONTABIL|CONFIANCA(0-1)

Contas possiveis:
- Folha de Pagamento
- Infraestrutura Cloud
- Marketing Digital
- Servicos Contabeis
- Servicos Juridicos
- Ferramentas SaaS
- Aluguel e Coworking
- Impostos e Taxas
- Receita SaaS
- Receita Servicos
- Receita Consultoria
- Investimento Capital
- Outras Despesas
- Outras Receitas

Transacoes:
${txList}

Responda APENAS as linhas ID|CONTA|CONFIANCA, sem texto adicional.`

    try {
      const response = await chatCompletion(prompt)
      const lines = response.trim().split("\n")

      for (const line of lines) {
        const parts = line.split("|").map((s) => s.trim())
        if (parts.length < 3) continue

        const [txId, accountCode, confStr] = parts
        const confidence = parseFloat(confStr) || 0.5
        const tx = needsAI.find((t) => t.id === txId)

        if (tx && accountCode) {
          results.push({
            transactionId: txId,
            accountCode,
            confidence,
            source: "ai",
          })

          // Only auto-apply if high confidence
          if (confidence >= 0.8) {
            await admin
              .from("transactions")
              .update({ account_code: accountCode })
              .eq("id", txId)
          }

          // Save pattern to memory
          const desc = (tx.notes ?? "").toLowerCase().trim()
          if (desc) {
            await saveAgentMemory(
              orgId,
              "pattern",
              `classify:${desc}`,
              { accountCode, amount: Number(tx.amount), lastSeen: new Date().toISOString() },
              confidence
            )
          }
        }
      }
    } catch (err) {
      console.error("[Classifier] AI classification failed:", err)
    }
  }

  return results
}

/**
 * Learn from manual classification — update memory when user classifies a transaction
 */
export async function learnFromManualClassification(
  orgId: string,
  transactionId: string,
  accountCode: string
): Promise<void> {
  const admin = createAdminClient()
  const { data: tx } = await admin
    .from("transactions")
    .select("notes, amount")
    .eq("id", transactionId)
    .single()

  if (!tx?.notes) return

  const desc = tx.notes.toLowerCase().trim()
  const existing = await getAgentMemory(orgId, "pattern", `classify:${desc}`)
  const currentConfidence = existing[0]?.confidence ?? 0.5

  // Increase confidence since human confirmed
  const newConfidence = Math.min(1.0, currentConfidence + 0.15)

  await saveAgentMemory(
    orgId,
    "pattern",
    `classify:${desc}`,
    { accountCode, amount: Number(tx.amount), confirmedByHuman: true, lastSeen: new Date().toISOString() },
    newConfidence
  )

  // Also save by first 3 words for fuzzy matching
  const words = desc.split(/\s+/).slice(0, 3).join(" ")
  if (words !== desc) {
    await saveAgentMemory(
      orgId,
      "pattern",
      `classify:${words}`,
      { accountCode, partial: true, lastSeen: new Date().toISOString() },
      Math.min(1.0, newConfidence * 0.9)
    )
  }
}
