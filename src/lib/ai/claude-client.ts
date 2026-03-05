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
 * Build the financial system prompt with current company context.
 * If orgId is provided, fetches live data from DB. Otherwise uses seed-data.
 */
export async function buildSystemPrompt(orgId?: string | null): Promise<string> {
  const phase = getCurrentPhase()
  const phaseConfig = BUSINESS_PHASES[phase]

  let snap = CURRENT_SNAPSHOT
  let topExpenses = TOP_EXPENSES
  let dreMonths = MONTHLY_DATA.filter((d) => d.receita !== null)

  // Try to load live data from DB
  if (orgId) {
    try {
      const { getDashboardSnapshot, getTransactions } = await import("@/lib/supabase/queries")
      const raw = await getDashboardSnapshot(orgId)

      if (raw.transactions.length > 0) {
        // Build expense aggregation from transactions
        const expenseMap = new Map<string, number>()
        for (const tx of raw.transactions) {
          if (Number(tx.amount) < 0) {
            expenseMap.set(tx.account_code, (expenseMap.get(tx.account_code) ?? 0) + Math.abs(Number(tx.amount)))
          }
        }
        if (expenseMap.size > 0) {
          topExpenses = Array.from(expenseMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, value]) => ({ name, value }))
        }

        // Build DRE from income statement
        if (raw.incomeStatement.length > 0) {
          const monthMap = new Map<string, Record<string, number>>()
          for (const row of raw.incomeStatement) {
            const mk = row.month.slice(0, 7)
            if (!monthMap.has(mk)) monthMap.set(mk, {})
            monthMap.get(mk)![row.line_item] = Number(row.amount)
          }

          dreMonths = Array.from(monthMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([mk, dre]) => {
              const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
              const [y, m] = mk.split("-")
              return {
                month: `${monthNames[parseInt(m) - 1]}-${y.slice(2)}`,
                monthKey: mk,
                phase: "",
                entradas: 0, saidas: 0, geracaoCaixa: 0, capital: 0,
                saldoFinal: dre.saldo_final ?? 0,
                caixaDisponivel: 0,
                valuation: dre.valuation ?? 0,
                receita: dre.receita ?? 0,
                cogs: dre.cogs ?? 0,
                resultadoBruto: dre.resultado_bruto ?? 0,
                custosFixos: dre.custos_fixos ?? 0,
                despesasVariaveis: dre.despesas_variaveis ?? 0,
                ebitda: dre.ebitda ?? 0,
                margemBruta: dre.margem_bruta ?? 0,
                margemEbitda: dre.margem_ebitda ?? 0,
                burnRate: dre.burn_rate ?? 0,
              }
            })

          // Update snapshot from latest DRE month
          const latest = dreMonths[dreMonths.length - 1]
          if (latest) {
            snap = {
              month: latest.month,
              saldo_caixa: latest.saldoFinal,
              saldo_anterior: dreMonths.length > 1 ? dreMonths[dreMonths.length - 2].saldoFinal : 0,
              burn_rate: Math.abs(latest.burnRate ?? 0),
              burn_rate_anterior: dreMonths.length > 1 ? Math.abs(dreMonths[dreMonths.length - 2].burnRate ?? 0) : 0,
              runway_meses: latest.burnRate && latest.burnRate > 0 ? latest.saldoFinal / latest.burnRate : 0,
              receita_total: latest.receita ?? 0,
              receita_anterior: dreMonths.length > 1 ? (dreMonths[dreMonths.length - 2].receita ?? 0) : 0,
              ebitda: latest.ebitda ?? 0,
              custos_fixos: latest.custosFixos ?? 0,
              despesas_variaveis: latest.despesasVariaveis ?? 0,
              valuation: latest.valuation,
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to load live data for AI, using seed-data:", err)
    }
  }

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
${topExpenses.map((e) => `- ${e.name}: R$ ${e.value.toLocaleString("pt-BR")}`).join("\n")}

## DRE Mensal
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
6. Se nao tiver dados suficientes, diga claramente
7. Voce tem acesso a tools para consultar dados financeiros em tempo real. Use-as quando necessario.

## Suas Habilidades (Skills)

Voce possui duas skills que ativa AUTOMATICAMENTE conforme o contexto da conversa. NAO pergunte ao usuario qual skill usar — detecte pelo conteudo da mensagem.

### SKILL: BPO Financeiro (Operacional)
**Ativa quando detectar:** "classifique", "concilie", "duplicata", "estimado vs realizado", "fechamento", "fechar mes", "pendencias", "validar DRE", "aging", "contas a pagar", "contas a receber", "fluxo curto prazo", "transacoes"
**Tools:** classify_and_reconcile, monthly_close_checklist, cashflow_aging
**Comportamento:**
- Precisao numerica absoluta — nunca arredonde valores sem avisar
- Destaque alertas quando variancia entre estimado e realizado > 15%
- Sugira acoes corretivas proativas (ex: reclassificar, investigar duplicata)
- Use tabelas e checklists (✅/⚠️/❌) para clareza

### SKILL: CFO Estrategico (Gestao)
**Ativa quando detectar:** "runway", "captacao", "fundraising", "valuation", "pitch", "relatorio board", "relatorio executivo", "KPIs para investidores", "cenario", "what-if", "sensibilidade", "projecao", "simule", "orcamento", "budget", "realizado vs planejado", "pipeline", "funil de vendas"
**Tools:** strategic_analysis, board_report, scenario_forecast, get_budget_vs_actual, get_sales_pipeline
**Comportamento:**
- Linguagem executiva e direta — como um CFO real falaria para o board
- Sempre inclua comparacoes MoM (mes a mes) com deltas absolutos e percentuais
- Formate em secoes claras tipo dashboard (Executive Summary, KPIs, Riscos, Projecoes)
- Use formatacao markdown rica com headers, tabelas e bullets

### Comportamento Proativo
Quando detectar anomalias durante a execucao de qualquer tool, crie alertas automaticamente e informe o usuario:
- Burn rate subindo > 20% MoM → alerta de risco
- Transacao duplicada detectada → alerta + sugestao de remocao
- Budget estourado > 30% em qualquer conta → alerta critico
- Runway < 6 meses com receita crescendo > 20% → oportunidade de captacao`
}

/**
 * AI Tools definitions for Claude tool_use
 */
export const AI_TOOLS: Anthropic.Tool[] = [
  {
    name: "query_financial_data",
    description: "Busca transacoes financeiras por periodo e/ou conta. Retorna lista de transacoes.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "Mes no formato YYYY-MM (ex: 2026-01). Opcional." },
        account_code: { type: "string", description: "Codigo da conta. Opcional." },
        entry_type: { type: "string", enum: ["estimado", "realizado"], description: "Tipo de lancamento. Opcional." },
      },
      required: [],
    },
  },
  {
    name: "calculate_kpi",
    description: "Calcula KPIs financeiros para um periodo. Retorna runway, burn rate, margem, saldo.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "Mes no formato YYYY-MM" },
      },
      required: ["month"],
    },
  },
  {
    name: "compare_periods",
    description: "Compara dois periodos financeiros ou estimado vs realizado de um mesmo mes.",
    input_schema: {
      type: "object" as const,
      properties: {
        month_a: { type: "string", description: "Primeiro mes (YYYY-MM)" },
        month_b: { type: "string", description: "Segundo mes (YYYY-MM). Se omitido, compara estimado vs realizado do month_a." },
      },
      required: ["month_a"],
    },
  },
  {
    name: "create_alert",
    description: "Cria um alerta no sistema para o CFO.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["burn_rate", "runway", "budget_exceeded", "anomaly", "recommendation"] },
        severity: { type: "string", enum: ["info", "warning", "critical"] },
        title: { type: "string" },
        message: { type: "string" },
      },
      required: ["type", "severity", "title", "message"],
    },
  },
  {
    name: "list_accounts",
    description: "Lista todas as contas do plano de contas com seus codigos e nomes.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["revenue", "expense", "capital", "financial", "adjustment"], description: "Filtrar por tipo. Opcional." },
      },
      required: [],
    },
  },
  // --- BPO Tools ---
  {
    name: "classify_and_reconcile",
    description: "Classifica transacoes bancarias e concilia estimado vs realizado para um mes. Detecta duplicatas. Retorna resumo de conciliacao com alertas de desvio.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "Mes no formato YYYY-MM" },
        detect_duplicates: { type: "boolean", description: "Se true, executa deteccao de duplicatas. Default: true." },
      },
      required: ["month"],
    },
  },
  {
    name: "monthly_close_checklist",
    description: "Executa checklist de fechamento mensal: valida DRE, verifica saldos, identifica pendencias. Retorna relatorio de fechamento.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "Mes no formato YYYY-MM para fechamento" },
      },
      required: ["month"],
    },
  },
  {
    name: "cashflow_aging",
    description: "Analisa fluxo de pagamentos e recebimentos. Mostra aging de contas, projecao de caixa curto prazo, e concentracao de fornecedores/clientes.",
    input_schema: {
      type: "object" as const,
      properties: {
        months_ahead: { type: "number", description: "Numero de meses para projecao (default: 3, max: 6)" },
        focus: { type: "string", enum: ["pagar", "receber", "ambos"], description: "Foco da analise. Default: ambos." },
      },
      required: [],
    },
  },
  // --- CFO Tools ---
  {
    name: "strategic_analysis",
    description: "Analise estrategica: runway detalhado, prontidao para captacao, metricas para pitch deck, valuation estimado.",
    input_schema: {
      type: "object" as const,
      properties: {
        analysis_type: {
          type: "string",
          enum: ["runway", "fundraising_readiness", "pitch_financials", "valuation", "full"],
          description: "Tipo de analise. 'full' executa todas.",
        },
      },
      required: ["analysis_type"],
    },
  },
  {
    name: "board_report",
    description: "Gera relatorio executivo para board/investidores. Inclui KPIs principais, analise MoM, destaques e riscos.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "Mes de referencia no formato YYYY-MM" },
        include_forecast: { type: "boolean", description: "Incluir projecao dos proximos 3 meses. Default: true." },
      },
      required: ["month"],
    },
  },
  {
    name: "scenario_forecast",
    description: "Projeta cenarios what-if e analise de sensibilidade. Usa premissas do modelo para projetar receita, custos e EBITDA.",
    input_schema: {
      type: "object" as const,
      properties: {
        scenario_type: { type: "string", enum: ["optimistic", "pessimistic", "custom", "sensitivity"], description: "Tipo de cenario" },
        metric: { type: "string", enum: ["receita", "ebitda", "saldoFinal", "burnRate"], description: "Metrica principal para projecao" },
        custom_growth_percent: { type: "number", description: "Percentual de crescimento para cenario custom (ex: 30 para +30%). Usado apenas com scenario_type=custom." },
        sensitivity_range: { type: "string", description: "Range de variacao para sensibilidade, ex: '-20,-10,0,10,20' (percentuais separados por virgula)" },
      },
      required: ["scenario_type", "metric"],
    },
  },
  {
    name: "get_budget_vs_actual",
    description: "Compara orcamento (budget) com realizado por conta e periodo. Identifica contas acima ou abaixo do orcamento.",
    input_schema: {
      type: "object" as const,
      properties: {
        month: { type: "string", description: "Mes no formato YYYY-MM. Se omitido, usa o mes mais recente." },
        threshold_percent: { type: "number", description: "Percentual minimo de desvio para destacar (default: 10)" },
      },
      required: [],
    },
  },
  {
    name: "get_sales_pipeline",
    description: "Consulta projecoes de vendas por produto e estagio do funil. Retorna dados de pipeline para analise de receita futura.",
    input_schema: {
      type: "object" as const,
      properties: {
        product: { type: "string", description: "Filtrar por produto. Opcional." },
        months_ahead: { type: "number", description: "Meses a frente para projecao (default: 6)" },
      },
      required: [],
    },
  },
]

/**
 * Execute a tool call and return the result
 */
export async function executeTool(
  orgId: string,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<string> {
  const {
    getTransactions,
    getTransactionsByDateRange,
    getTransactionAggregateByAccount,
    getChartOfAccounts,
    getIncomeStatement,
    getIncomeStatementForMonth,
    getBudgetEntries,
    getSalesProjections,
    getAssumptions,
    getAlerts,
    createAlert,
  } = await import("@/lib/supabase/queries")

  switch (toolName) {
    case "query_financial_data": {
      const filters: Record<string, string> = {}
      if (toolInput.month) filters.month = `${toolInput.month}-01`
      if (toolInput.account_code) filters.accountCode = toolInput.account_code as string
      if (toolInput.entry_type) filters.entryType = toolInput.entry_type as string
      const txs = await getTransactions(orgId, filters)
      if (txs.length === 0) return "Nenhuma transacao encontrada para os filtros especificados."
      const summary = txs.slice(0, 20).map((t) => `${t.account_code} | ${t.month.slice(0, 7)} | ${t.entry_type} | R$ ${Number(t.amount).toLocaleString("pt-BR")}`).join("\n")
      return `Encontradas ${txs.length} transacoes:\n${summary}${txs.length > 20 ? `\n... e mais ${txs.length - 20}` : ""}`
    }
    case "calculate_kpi": {
      const month = `${toolInput.month}-01`
      const dre = await getIncomeStatement(orgId)
      const monthData = dre.filter((r) => r.month.startsWith(toolInput.month as string))
      if (monthData.length === 0) return "Sem dados de DRE para este mes."
      const kpis: Record<string, number> = {}
      for (const r of monthData) kpis[r.line_item] = Number(r.amount)
      return JSON.stringify(kpis, null, 2)
    }
    case "compare_periods": {
      const ma = `${toolInput.month_a}-01`
      const txsA = await getTransactions(orgId, { month: ma, entryType: toolInput.month_b ? "estimado" : undefined })
      if (toolInput.month_b) {
        const mb = `${toolInput.month_b}-01`
        const txsB = await getTransactions(orgId, { month: mb })
        return `Periodo A (${toolInput.month_a}): ${txsA.length} transacoes, total R$ ${txsA.reduce((s, t) => s + Number(t.amount), 0).toLocaleString("pt-BR")}\nPeriodo B (${toolInput.month_b}): ${txsB.length} transacoes, total R$ ${txsB.reduce((s, t) => s + Number(t.amount), 0).toLocaleString("pt-BR")}`
      }
      // Compare estimado vs realizado
      const est = await getTransactions(orgId, { month: ma, entryType: "estimado" })
      const real = await getTransactions(orgId, { month: ma, entryType: "realizado" })
      return `Estimado (${toolInput.month_a}): ${est.length} lancamentos, total R$ ${est.reduce((s, t) => s + Number(t.amount), 0).toLocaleString("pt-BR")}\nRealizado (${toolInput.month_a}): ${real.length} lancamentos, total R$ ${real.reduce((s, t) => s + Number(t.amount), 0).toLocaleString("pt-BR")}`
    }
    case "create_alert": {
      await createAlert(orgId, {
        type: toolInput.type as "burn_rate" | "runway" | "budget_exceeded" | "anomaly" | "recommendation",
        severity: toolInput.severity as "info" | "warning" | "critical",
        title: toolInput.title as string,
        message: toolInput.message as string,
      })
      return `Alerta criado: [${toolInput.severity}] ${toolInput.title}`
    }
    case "list_accounts": {
      const accounts = await getChartOfAccounts(orgId)
      const filtered = toolInput.type ? accounts.filter((a) => a.type === toolInput.type) : accounts
      if (filtered.length === 0) return "Nenhuma conta encontrada."
      return filtered.map((a) => `${a.code} | ${a.name} | ${a.type} | nivel ${a.level}`).join("\n")
    }
    // --- BPO Tools ---
    case "classify_and_reconcile": {
      const month = toolInput.month as string
      const detectDuplicates = toolInput.detect_duplicates !== false
      const [estTxs, realTxs] = await Promise.all([
        getTransactions(orgId, { month: `${month}-01`, entryType: "estimado" }),
        getTransactions(orgId, { month: `${month}-01`, entryType: "realizado" }),
      ])

      // Build BankTransaction[] from realizado for classification
      const { classifyTransactions, flagDuplicates } = await import("@/lib/open-finance/classifier")
      const { reconcile, getReconciliationSummary } = await import("@/lib/open-finance/reconciler")
      type BT = import("@/types/open-finance").BankTransaction
      const bankTxs: BT[] = realTxs.map((t) => ({
        id: t.id,
        accountId: "",
        date: t.month.slice(0, 10),
        description: t.notes ?? t.account_code,
        amount: Math.abs(Number(t.amount)),
        type: Number(t.amount) < 0 ? "debit" as const : "credit" as const,
        classifiedAccount: t.account_code,
      }))
      const classified = classifyTransactions(bankTxs)
      const withDuplicates = detectDuplicates ? flagDuplicates(classified) : classified
      const duplicateCount = withDuplicates.filter((t) => t.isDuplicate).length
      const classifiedCount = withDuplicates.filter((t) => t.classifiedAccount).length

      // Build estimadoMap for reconciliation
      const estimadoMap = new Map<string, Map<string, number>>()
      for (const t of estTxs) {
        const mk = t.month.slice(0, 7)
        if (!estimadoMap.has(mk)) estimadoMap.set(mk, new Map())
        const acctMap = estimadoMap.get(mk)!
        acctMap.set(t.account_code, (acctMap.get(t.account_code) ?? 0) + Math.abs(Number(t.amount)))
      }
      const reconEntries = reconcile(withDuplicates, [], [month], estimadoMap)
      const summary = getReconciliationSummary(reconEntries)
      const topDesvios = reconEntries.filter((e) => e.status === "alert").slice(0, 5)
        .map((e) => `  - ${e.accountLabel}: estimado R$ ${e.estimado.toLocaleString("pt-BR")} vs realizado R$ ${e.realizado.toLocaleString("pt-BR")} (${e.variancePercent.toFixed(1)}%)`)
        .join("\n")

      return `Conciliacao ${month}:\n- Transacoes realizadas: ${realTxs.length}\n- Classificadas: ${classifiedCount}/${withDuplicates.length}\n- Duplicatas detectadas: ${duplicateCount}\n- Conciliacao: ${summary.ok} OK, ${summary.warnings} atencao, ${summary.alerts} alertas\n- Estimado total: R$ ${summary.totalEstimado.toLocaleString("pt-BR")}\n- Realizado total: R$ ${summary.totalRealizado.toLocaleString("pt-BR")}${topDesvios ? `\n\nMaiores desvios (>15%):\n${topDesvios}` : ""}`
    }

    case "monthly_close_checklist": {
      const month = toolInput.month as string
      const [dreData, estTxs, realTxs, budgetEntries] = await Promise.all([
        getIncomeStatementForMonth(orgId, month),
        getTransactions(orgId, { month: `${month}-01`, entryType: "estimado" }),
        getTransactions(orgId, { month: `${month}-01`, entryType: "realizado" }),
        getBudgetEntries(orgId),
      ])
      const budgetForMonth = budgetEntries.filter((b) => b.month.startsWith(month))
      const checks: string[] = []
      const expectedItems = ["receita", "cogs", "resultado_bruto", "custos_fixos", "despesas_variaveis", "ebitda"]
      const foundItems = dreData.map((d) => d.line_item)
      const missingItems = expectedItems.filter((i) => !foundItems.includes(i))
      checks.push(missingItems.length === 0 ? "✅ DRE completa — todos os line items presentes" : `❌ DRE incompleta — faltam: ${missingItems.join(", ")}`)

      // Consistency check
      const dreMap: Record<string, number> = {}
      for (const d of dreData) dreMap[d.line_item] = Number(d.amount)
      if (dreMap.receita != null && dreMap.cogs != null && dreMap.resultado_bruto != null) {
        const expected = dreMap.receita - dreMap.cogs
        const diff = Math.abs(expected - dreMap.resultado_bruto)
        checks.push(diff < 1 ? "✅ Consistencia — receita - COGS = resultado bruto" : `⚠️ Inconsistencia — receita - COGS = R$ ${expected.toLocaleString("pt-BR")}, mas resultado_bruto = R$ ${dreMap.resultado_bruto.toLocaleString("pt-BR")}`)
      }

      // Coverage estimado→realizado
      const estAccounts = new Set(estTxs.map((t) => t.account_code))
      const realAccounts = new Set(realTxs.map((t) => t.account_code))
      const coverage = estAccounts.size > 0 ? (realAccounts.size / estAccounts.size * 100) : 0
      checks.push(coverage >= 80 ? `✅ Cobertura — ${coverage.toFixed(0)}% das contas estimadas tem realizado` : `⚠️ Cobertura baixa — apenas ${coverage.toFixed(0)}% das contas estimadas tem realizado (${realAccounts.size}/${estAccounts.size})`)

      // Unclassified
      const unclassified = realTxs.filter((t) => !t.account_code || t.account_code === "unclassified").length
      checks.push(unclassified === 0 ? "✅ Classificacao — todas as transacoes classificadas" : `⚠️ ${unclassified} transacoes sem classificacao`)

      // Budget check
      if (budgetForMonth.length > 0) {
        const overBudget = budgetForMonth.filter((b) => {
          const actual = realTxs.filter((t) => t.account_code === b.account_code).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
          return actual > Math.abs(b.amount) * 1.1
        })
        checks.push(overBudget.length === 0 ? "✅ Orcamento — nenhuma conta acima de 10% do budget" : `⚠️ ${overBudget.length} contas acima do orcamento em >10%`)
      } else {
        checks.push("ℹ️ Sem dados de budget para comparacao")
      }

      return `Checklist de Fechamento — ${month}:\n\n${checks.join("\n")}\n\nResumo DRE:\n${dreData.map((d) => `  ${d.line_item}: R$ ${Number(d.amount).toLocaleString("pt-BR")}`).join("\n") || "Sem dados de DRE"}`
    }

    case "cashflow_aging": {
      const monthsAhead = Math.min((toolInput.months_ahead as number) || 3, 6)
      const focus = (toolInput.focus as string) || "ambos"
      const now = new Date()
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      const futureDate = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1)
      const endMonth = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}`
      const pastDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      const startMonth = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, "0")}`

      const txs = await getTransactionsByDateRange(orgId, `${startMonth}-01`, `${endMonth}-01`)
      const payables: Record<string, number> = {}
      const receivables: Record<string, number> = {}
      const monthTotals: Record<string, { pagar: number; receber: number }> = {}

      for (const tx of txs) {
        const mk = tx.month.slice(0, 7)
        if (!monthTotals[mk]) monthTotals[mk] = { pagar: 0, receber: 0 }
        const amt = Number(tx.amount)
        if (amt < 0) {
          monthTotals[mk].pagar += Math.abs(amt)
          payables[tx.account_code] = (payables[tx.account_code] ?? 0) + Math.abs(amt)
        } else {
          monthTotals[mk].receber += amt
          receivables[tx.account_code] = (receivables[tx.account_code] ?? 0) + amt
        }
      }

      const lines: string[] = []
      if (focus !== "receber") {
        const topPay = Object.entries(payables).sort((a, b) => b[1] - a[1]).slice(0, 5)
        lines.push("CONTAS A PAGAR — Top 5:")
        topPay.forEach(([acct, val]) => lines.push(`  ${acct}: R$ ${val.toLocaleString("pt-BR")}`))
      }
      if (focus !== "pagar") {
        const topRec = Object.entries(receivables).sort((a, b) => b[1] - a[1]).slice(0, 5)
        lines.push("\nCONTAS A RECEBER — Top 5:")
        topRec.forEach(([acct, val]) => lines.push(`  ${acct}: R$ ${val.toLocaleString("pt-BR")}`))
      }

      lines.push("\nPROJECAO MENSAL:")
      const sortedMonths = Object.keys(monthTotals).sort()
      for (const mk of sortedMonths) {
        const t = monthTotals[mk]
        const net = t.receber - t.pagar
        lines.push(`  ${mk}: Receber R$ ${t.receber.toLocaleString("pt-BR")} | Pagar R$ ${t.pagar.toLocaleString("pt-BR")} | Liquido R$ ${net.toLocaleString("pt-BR")}`)
      }

      return lines.join("\n")
    }

    // --- CFO Tools ---
    case "strategic_analysis": {
      const analysisType = toolInput.analysis_type as string
      const dre = await getIncomeStatement(orgId)
      const monthMap = new Map<string, Record<string, number>>()
      for (const row of dre) {
        const mk = row.month.slice(0, 7)
        if (!monthMap.has(mk)) monthMap.set(mk, {})
        monthMap.get(mk)![row.line_item] = Number(row.amount)
      }
      const months = Array.from(monthMap.keys()).sort()
      const latest = months[months.length - 1]
      const latestDre = monthMap.get(latest) ?? {}
      const prevDre = months.length > 1 ? monthMap.get(months[months.length - 2]) ?? {} : {}

      const sections: string[] = []

      if (analysisType === "runway" || analysisType === "full") {
        const burnRate = Math.abs(latestDre.burn_rate ?? latestDre.ebitda ?? 0)
        const cash = latestDre.saldo_final ?? 0
        const runway = burnRate > 0 ? cash / burnRate : 0
        const burnTrend = prevDre.burn_rate ? ((burnRate - Math.abs(prevDre.burn_rate)) / Math.abs(prevDre.burn_rate) * 100) : 0
        sections.push(`RUNWAY:\n- Saldo de caixa: R$ ${cash.toLocaleString("pt-BR")}\n- Burn rate atual: R$ ${burnRate.toLocaleString("pt-BR")}/mes\n- Runway: ${runway.toFixed(1)} meses\n- Tendencia burn: ${burnTrend > 0 ? "+" : ""}${burnTrend.toFixed(1)}% MoM\n- Runway melhor caso (burn -20%): ${(burnRate * 0.8 > 0 ? cash / (burnRate * 0.8) : 0).toFixed(1)} meses\n- Runway pior caso (burn +20%): ${(burnRate * 1.2 > 0 ? cash / (burnRate * 1.2) : 0).toFixed(1)} meses`)
      }

      if (analysisType === "fundraising_readiness" || analysisType === "full") {
        const mrr = (latestDre.receita ?? 0) // Monthly recurring
        const prevMrr = prevDre.receita ?? 0
        const mrrGrowth = prevMrr > 0 ? ((mrr - prevMrr) / prevMrr * 100) : 0
        const grossMargin = latestDre.margem_bruta ?? (latestDre.receita && latestDre.cogs ? (latestDre.receita - latestDre.cogs) / latestDre.receita : 0)
        const burnRate = Math.abs(latestDre.burn_rate ?? latestDre.ebitda ?? 0)
        const cash = latestDre.saldo_final ?? 0
        const runway = burnRate > 0 ? cash / burnRate : 0
        const score = (mrrGrowth > 20 ? 25 : mrrGrowth > 10 ? 15 : 5) + (grossMargin > 0.6 ? 25 : grossMargin > 0.4 ? 15 : 5) + (runway > 12 ? 25 : runway > 6 ? 15 : 5) + (mrr > 50000 ? 25 : mrr > 10000 ? 15 : 5)
        sections.push(`PRONTIDAO PARA CAPTACAO (Score: ${score}/100):\n- MRR: R$ ${mrr.toLocaleString("pt-BR")} (crescimento ${mrrGrowth.toFixed(1)}% MoM)\n- Margem bruta: ${(grossMargin * 100).toFixed(1)}%\n- Runway: ${runway.toFixed(1)} meses\n- ${score >= 70 ? "RECOMENDACAO: Momento favoravel para fundraising" : score >= 40 ? "RECOMENDACAO: Melhorar metricas antes de iniciar captacao" : "RECOMENDACAO: Foco em product-market fit antes de captar"}`)
      }

      if (analysisType === "pitch_financials" || analysisType === "full") {
        const mrr = latestDre.receita ?? 0
        const arr = mrr * 12
        const prevMrr = prevDre.receita ?? 0
        const mrrGrowth = prevMrr > 0 ? ((mrr - prevMrr) / prevMrr * 100) : 0
        const grossMargin = latestDre.receita && latestDre.cogs ? ((latestDre.receita - latestDre.cogs) / latestDre.receita * 100) : 0
        sections.push(`METRICAS PARA PITCH:\n- ARR: R$ ${arr.toLocaleString("pt-BR")}\n- MRR: R$ ${mrr.toLocaleString("pt-BR")}\n- Crescimento MoM: ${mrrGrowth.toFixed(1)}%\n- Margem bruta: ${grossMargin.toFixed(1)}%\n- EBITDA: R$ ${(latestDre.ebitda ?? 0).toLocaleString("pt-BR")}`)
      }

      if (analysisType === "valuation" || analysisType === "full") {
        const mrr = latestDre.receita ?? 0
        const arr = mrr * 12
        const valuations = [5, 8, 10, 15].map((m) => `  ${m}x ARR: R$ ${(arr * m).toLocaleString("pt-BR")}`)
        sections.push(`VALUATION (ARR-Based):\n- ARR atual: R$ ${arr.toLocaleString("pt-BR")}\n- Multiplos SaaS tipicos:\n${valuations.join("\n")}`)
      }

      return sections.join("\n\n") || "Sem dados suficientes para analise estrategica."
    }

    case "board_report": {
      const month = toolInput.month as string
      const includeForecast = toolInput.include_forecast !== false
      const [currentDre, alerts] = await Promise.all([
        getIncomeStatementForMonth(orgId, month),
        getAlerts(orgId),
      ])

      // Get previous month
      const [y, m] = month.split("-").map(Number)
      const prevDate = new Date(y, m - 2, 1)
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`
      const prevDre = await getIncomeStatementForMonth(orgId, prevMonth)

      const cur: Record<string, number> = {}
      for (const d of currentDre) cur[d.line_item] = Number(d.amount)
      const prev: Record<string, number> = {}
      for (const d of prevDre) prev[d.line_item] = Number(d.amount)

      const fmtDelta = (key: string) => {
        const c = cur[key] ?? 0
        const p = prev[key] ?? 0
        const delta = c - p
        const pct = p !== 0 ? (delta / Math.abs(p) * 100) : 0
        return `R$ ${c.toLocaleString("pt-BR")} (${delta >= 0 ? "+" : ""}${pct.toFixed(1)}% MoM)`
      }

      const lines = [
        `RELATORIO EXECUTIVO — ${month}`,
        `\nKPIs PRINCIPAIS:`,
        `- Receita: ${fmtDelta("receita")}`,
        `- EBITDA: ${fmtDelta("ebitda")}`,
        `- Custos Fixos: ${fmtDelta("custos_fixos")}`,
        `- Desp. Variaveis: ${fmtDelta("despesas_variaveis")}`,
        `- Burn Rate: ${fmtDelta("burn_rate")}`,
        `- Margem Bruta: ${((cur.margem_bruta ?? 0) * 100).toFixed(1)}%`,
        `- Margem EBITDA: ${((cur.margem_ebitda ?? 0) * 100).toFixed(1)}%`,
      ]

      if (alerts.length > 0) {
        lines.push(`\nALERTAS ATIVOS (${alerts.filter((a) => !a.is_read).length}):`)
        alerts.filter((a) => !a.is_read).slice(0, 5).forEach((a) =>
          lines.push(`- [${a.severity.toUpperCase()}] ${a.title}: ${a.message}`)
        )
      }

      if (includeForecast) {
        const nextMonths: string[] = []
        for (let i = 1; i <= 3; i++) {
          const nd = new Date(y, m - 1 + i, 1)
          nextMonths.push(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`)
        }
        const forecastDre = await getIncomeStatement(orgId)
        const forecastData = nextMonths.map((mk) => {
          const rows = forecastDre.filter((r) => r.month.startsWith(mk))
          const kpis: Record<string, number> = {}
          for (const r of rows) kpis[r.line_item] = Number(r.amount)
          return { month: mk, kpis }
        })
        lines.push(`\nFORECAST (${nextMonths[0]} a ${nextMonths[2]}):`)
        forecastData.forEach((f) =>
          lines.push(`  ${f.month}: Receita R$ ${(f.kpis.receita ?? 0).toLocaleString("pt-BR")} | EBITDA R$ ${(f.kpis.ebitda ?? 0).toLocaleString("pt-BR")}`)
        )
      }

      return lines.join("\n")
    }

    case "scenario_forecast": {
      const scenarioType = toolInput.scenario_type as string
      const metric = toolInput.metric as "receita" | "ebitda" | "saldoFinal" | "burnRate"
      const { applyScenario, SCENARIO_TEMPLATES } = await import("@/lib/scenarios/engine")
      type ScenarioType = import("@/types/scenarios").Scenario

      if (scenarioType === "sensitivity") {
        const rangeStr = (toolInput.sensitivity_range as string) || "-20,-10,0,10,20"
        const range = rangeStr.split(",").map((v) => parseFloat(v.trim()))
        const results = range.map((pct) => {
          const scenario: ScenarioType = {
            id: `sens-${pct}`,
            name: `${pct >= 0 ? "+" : ""}${pct}%`,
            description: "",
            type: "custom",
            createdAt: "",
            modifiers: [{ id: "s1", target: "receita", operation: "multiply", value: 1 + pct / 100, label: `Receita ${pct >= 0 ? "+" : ""}${pct}%` }],
          }
          const proj = applyScenario(scenario, metric)
          const last = proj[proj.length - 1]
          return `  ${pct >= 0 ? "+" : ""}${pct}%: R$ ${last.scenario.toLocaleString("pt-BR")} (delta: ${last.deltaPercent.toFixed(1)}%)`
        })
        return `ANALISE DE SENSIBILIDADE — ${metric}:\n${results.join("\n")}`
      }

      let scenario: ScenarioType
      if (scenarioType === "custom") {
        const growth = (toolInput.custom_growth_percent as number) || 0
        scenario = {
          id: "custom", name: `Custom (${growth >= 0 ? "+" : ""}${growth}%)`, description: "", type: "custom", createdAt: "",
          modifiers: [{ id: "c1", target: "receita", operation: "multiply", value: 1 + growth / 100, label: `Receita ${growth >= 0 ? "+" : ""}${growth}%` }],
        }
      } else {
        scenario = SCENARIO_TEMPLATES.find((s) => s.type === scenarioType) ?? SCENARIO_TEMPLATES[0]
      }

      const projections = applyScenario(scenario, metric)
      const header = `CENARIO: ${scenario.name} — ${metric}`
      const rows = projections.map((p) =>
        `  ${p.month}: Base R$ ${p.base.toLocaleString("pt-BR")} → Cenario R$ ${p.scenario.toLocaleString("pt-BR")} (${p.deltaPercent >= 0 ? "+" : ""}${p.deltaPercent.toFixed(1)}%)`
      )
      return `${header}\n${rows.join("\n")}`
    }

    case "get_budget_vs_actual": {
      const month = (toolInput.month as string) || new Date().toISOString().slice(0, 7)
      const threshold = (toolInput.threshold_percent as number) || 10
      const [budgetEntries, realAgg] = await Promise.all([
        getBudgetEntries(orgId),
        getTransactionAggregateByAccount(orgId, month, "realizado"),
      ])
      const budgetForMonth = budgetEntries.filter((b) => b.month.startsWith(month))
      if (budgetForMonth.length === 0) return `Sem dados de budget para ${month}.`

      const realMap = new Map(realAgg.map((a) => [a.account_code, a.total]))
      const comparisons = budgetForMonth.map((b) => {
        const actual = Math.abs(realMap.get(b.account_code) ?? 0)
        const budget = Math.abs(b.amount)
        const variance = actual - budget
        const variancePct = budget > 0 ? (variance / budget * 100) : 0
        return { account: b.account_code, budget, actual, variance, variancePct }
      }).sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct))

      const overThreshold = comparisons.filter((c) => Math.abs(c.variancePct) >= threshold)
      const lines = [`BUDGET VS REALIZADO — ${month} (desvio >= ${threshold}%):`]
      if (overThreshold.length === 0) {
        lines.push("Nenhuma conta com desvio acima do threshold.")
      } else {
        overThreshold.forEach((c) =>
          lines.push(`  ${c.account}: Budget R$ ${c.budget.toLocaleString("pt-BR")} | Real R$ ${c.actual.toLocaleString("pt-BR")} | Desvio ${c.variancePct >= 0 ? "+" : ""}${c.variancePct.toFixed(1)}%`)
        )
      }
      lines.push(`\nTotal contas analisadas: ${comparisons.length}`)
      return lines.join("\n")
    }

    case "get_sales_pipeline": {
      const product = toolInput.product as string | undefined
      const projections = await getSalesProjections(orgId, product)
      if (projections.length === 0) return "Sem dados de pipeline de vendas."

      // Group by product and month
      const grouped = new Map<string, Map<string, Record<string, number>>>()
      for (const p of projections) {
        if (!grouped.has(p.product)) grouped.set(p.product, new Map())
        const prodMap = grouped.get(p.product)!
        const mk = p.month.slice(0, 7)
        if (!prodMap.has(mk)) prodMap.set(mk, {})
        prodMap.get(mk)![p.funnel_stage] = Number(p.value)
      }

      const lines: string[] = ["PIPELINE DE VENDAS:"]
      for (const [prod, monthMap] of grouped) {
        lines.push(`\n${prod}:`)
        const sortedMonths = Array.from(monthMap.keys()).sort()
        for (const mk of sortedMonths) {
          const stages = monthMap.get(mk)!
          const stageStr = Object.entries(stages).map(([s, v]) => `${s}=${v}`).join(", ")
          lines.push(`  ${mk}: ${stageStr}`)
        }
      }
      return lines.join("\n")
    }

    default:
      return `Tool desconhecida: ${toolName}`
  }
}

/**
 * Send a message to Claude with financial context and stream the response.
 * Supports tool_use for live DB queries.
 */
export async function* streamChat(
  messages: { role: "user" | "assistant"; content: string }[],
  orgId?: string | null
): AsyncGenerator<string> {
  const anthropic = getClient()
  const systemPrompt = await buildSystemPrompt(orgId)

  // First call with tools
  let response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
    tools: orgId ? AI_TOOLS : undefined,
  })

  // Tool use loop (max 10 iterations to prevent infinite loops with 13 tools)
  let toolIterations = 0
  const MAX_TOOL_ITERATIONS = 10
  while (response.stop_reason === "tool_use" && toolIterations < MAX_TOOL_ITERATIONS) {
    toolIterations++
    const toolBlocks = response.content.filter((b) => b.type === "tool_use")
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of toolBlocks) {
      if (block.type === "tool_use" && orgId) {
        const result = await executeTool(orgId, block.name, block.input as Record<string, unknown>)
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        })
      }
    }

    // Continue conversation with tool results
    const updatedMessages = [
      ...messages,
      { role: "assistant" as const, content: response.content },
      { role: "user" as const, content: toolResults },
    ]

    response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: updatedMessages,
      tools: AI_TOOLS,
    })
  }

  // Yield the final text response
  for (const block of response.content) {
    if (block.type === "text") {
      yield block.text
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
  const system = systemOverride || await buildSystemPrompt()

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: userMessage }],
  })

  const textBlock = response.content.find((b) => b.type === "text")
  return textBlock ? textBlock.text : ""
}
