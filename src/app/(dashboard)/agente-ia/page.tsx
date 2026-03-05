"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhaseBadge } from "@/components/shared/phase-badge"
import { ChatMessage } from "@/components/ai/chat-message"
import { InsightsPanel } from "@/components/ai/insights-panel"
import { getCurrentPhase } from "@/config/phases"
import {
  Send,
  Bot,
  Sparkles,
  ClipboardCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Settings2,
  Shield,
  Activity,
  MessageSquare,
} from "lucide-react"
import { toast } from "sonner"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface AgentAction {
  id: string
  action: string
  priority: "critical" | "high" | "medium" | "low"
  reasoning: string
  status: "pending" | "approved" | "executed" | "rejected" | "failed"
  automated: boolean
  requires_approval: boolean
  created_at: string
  executed_at?: string
  context?: Record<string, unknown>
}

interface AutonomyConfig {
  auto_classify: boolean
  auto_update_dre: boolean
  auto_bill_reconcile: boolean
  runway_alert_months: number
  variance_alert_percent: number
  single_transaction_limit: number
  notify_email: boolean
  notify_whatsapp: boolean
  whatsapp_number: string
}

type TabKey = "chat" | "timeline" | "approvals" | "autonomy"

const PROMPT_CATEGORIES = [
  {
    label: "BPO Financeiro",
    icon: ClipboardCheck,
    color: "text-amber-400",
    prompts: [
      "Classifique e concilie as transacoes de fevereiro",
      "Execute o checklist de fechamento do mes passado",
      "Qual o aging das contas a pagar?",
      "Projete o fluxo de caixa dos proximos 3 meses",
    ],
  },
  {
    label: "CFO Estrategico",
    icon: TrendingUp,
    color: "text-emerald-400",
    prompts: [
      "Qual nosso runway atual e cenario de captacao?",
      "Gere o relatorio executivo para o board",
      "Simule cenario pessimista com -20% de receita",
      "Compare orcamento vs realizado deste mes",
    ],
  },
  {
    label: "Visao Geral",
    icon: Sparkles,
    color: "text-chart-1",
    prompts: [
      "Como esta a saude financeira da empresa?",
      "Quais os maiores riscos financeiros agora?",
      "Analise a margem EBITDA ao longo do tempo",
      "Qual nossa prontidao para fundraising?",
    ],
  },
]

const DEMO_ACTIONS: AgentAction[] = [
  {
    id: "1",
    action: "classify_transactions",
    priority: "medium",
    reasoning: "12 transações novas do Pluggy sem classificação",
    status: "executed",
    automated: true,
    requires_approval: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    executed_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    action: "update_dre",
    priority: "medium",
    reasoning: "DRE atualizada com 12 transações classificadas",
    status: "executed",
    automated: true,
    requires_approval: false,
    created_at: new Date(Date.now() - 1.9 * 60 * 60 * 1000).toISOString(),
    executed_at: new Date(Date.now() - 1.9 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    action: "alert",
    priority: "high",
    reasoning: "Variância de 32% detectada em Marketing Digital — R$ 18.400 vs orçado R$ 12.000",
    status: "executed",
    automated: true,
    requires_approval: false,
    created_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    executed_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "4",
    action: "reconcile_bill",
    priority: "medium",
    reasoning: "Pagamento R$ 4.800 identificado como conta Infraestrutura Cloud — vencimento 10/03",
    status: "pending",
    automated: false,
    requires_approval: true,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: "5",
    action: "generate_report",
    priority: "low",
    reasoning: "Board Report de Fevereiro pronto para geração automática",
    status: "pending",
    automated: false,
    requires_approval: true,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
]

export default function AgenteIaPage() {
  const currentPhase = getCurrentPhase()
  const [activeTab, setActiveTab] = useState<TabKey>("chat")
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [actions, setActions] = useState<AgentAction[]>(DEMO_ACTIONS)
  const [autonomy, setAutonomy] = useState<AutonomyConfig>({
    auto_classify: true,
    auto_update_dre: true,
    auto_bill_reconcile: true,
    runway_alert_months: 3,
    variance_alert_percent: 20,
    single_transaction_limit: 50000,
    notify_email: true,
    notify_whatsapp: false,
    whatsapp_number: "",
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      const userMsg: Message = { role: "user", content: text.trim() }
      const newMessages = [...messages, userMsg]
      setMessages(newMessages)
      setInput("")
      setIsStreaming(true)

      const assistantMsg: Message = { role: "assistant", content: "" }
      setMessages([...newMessages, assistantMsg])

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages }),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Erro na API")
        }

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let fullText = ""

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split("\n")

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim()
                if (data === "[DONE]") continue
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.error) throw new Error(parsed.error)
                  if (parsed.text) {
                    fullText += parsed.text
                    setMessages((prev) => {
                      const updated = [...prev]
                      updated[updated.length - 1] = { role: "assistant", content: fullText }
                      return updated
                    })
                  }
                } catch (e) {
                  if (e instanceof SyntaxError) continue
                  throw e
                }
              }
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Erro desconhecido"
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Erro: ${errorMsg}. Verifique se ANTHROPIC_API_KEY esta configurada no .env.local.`,
          }
          return updated
        })
      } finally {
        setIsStreaming(false)
      }
    },
    [messages, isStreaming]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleApprove = (id: string) => {
    setActions((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: "executed" as const, executed_at: new Date().toISOString() } : a
      )
    )
    toast.success("Ação aprovada e executada")
  }

  const handleReject = (id: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "rejected" as const } : a))
    )
    toast.info("Ação rejeitada")
  }

  const pendingCount = actions.filter((a) => a.status === "pending" && a.requires_approval).length

  const tabs: Array<{ key: TabKey; label: string; icon: React.ElementType; badge?: number }> = [
    { key: "chat", label: "Chat", icon: MessageSquare },
    { key: "timeline", label: "Timeline", icon: Activity },
    { key: "approvals", label: "Aprovações", icon: Shield, badge: pendingCount },
    { key: "autonomy", label: "Autonomia", icon: Settings2 },
  ]

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-chart-1/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-chart-1" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Agente CFO Autônomo</h2>
              <p className="text-xs text-muted-foreground">
                Powered by Claude — Opera como CFO 24/7
              </p>
            </div>
          </div>
          <PhaseBadge phase={currentPhase} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-chart-1/20 text-chart-1"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.badge ? (
                  <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "chat" && (
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardContent className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Sparkles className="h-10 w-10 text-chart-1/40 mb-3" />
                  <h3 className="text-base font-medium mb-1">CFO AI Assistant</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-md">
                    Pergunte sobre metricas financeiras, analise de custos, projecoes de receita,
                    cenarios ou qualquer duvida sobre a saude financeira da ASSUMFIT.
                  </p>
                  <div className="grid grid-cols-3 gap-4 max-w-2xl w-full">
                    {PROMPT_CATEGORIES.map((cat) => {
                      const Icon = cat.icon
                      return (
                        <div key={cat.label} className="space-y-2">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Icon className={`h-3.5 w-3.5 ${cat.color}`} />
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {cat.label}
                            </span>
                          </div>
                          {cat.prompts.map((prompt) => (
                            <button
                              key={prompt}
                              onClick={() => sendMessage(prompt)}
                              className="w-full text-xs text-left px-3 py-2 rounded-md border border-border bg-card hover:bg-muted transition-colors text-muted-foreground"
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <ChatMessage
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
                  />
                ))
              )}
            </CardContent>

            <div className="border-t border-border p-3">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Pergunte ao agente financeiro..."
                  disabled={isStreaming}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={isStreaming || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
        )}

        {activeTab === "timeline" && (
          <Card className="flex-1 overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-sm">Histórico de Ações do Agente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...actions].reverse().map((action) => (
                  <div key={action.id} className="flex gap-3 relative">
                    <div className="flex flex-col items-center">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          action.status === "executed"
                            ? "bg-emerald-500/20"
                            : action.status === "pending"
                              ? "bg-amber-500/20"
                              : action.status === "rejected"
                                ? "bg-red-500/20"
                                : "bg-muted"
                        }`}
                      >
                        {action.status === "executed" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : action.status === "pending" ? (
                          <Clock className="h-4 w-4 text-amber-400" />
                        ) : action.status === "rejected" ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="w-px flex-1 bg-border mt-1" />
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">{formatActionLabel(action.action)}</span>
                        <PriorityBadge priority={action.priority} />
                        {action.automated && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-chart-1/10 text-chart-1 rounded">
                            Auto
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{action.reasoning}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {new Date(action.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "approvals" && (
          <Card className="flex-1 overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-sm">Ações Pendentes de Aprovação</CardTitle>
            </CardHeader>
            <CardContent>
              {actions.filter((a) => a.status === "pending" && a.requires_approval).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma ação pendente</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    O agente solicitará aprovação para ações críticas
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {actions
                    .filter((a) => a.status === "pending" && a.requires_approval)
                    .map((action) => (
                      <div
                        key={action.id}
                        className="border border-border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {formatActionLabel(action.action)}
                            </span>
                            <PriorityBadge priority={action.priority} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(action.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{action.reasoning}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleApprove(action.id)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleReject(action.id)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "autonomy" && (
          <Card className="flex-1 overflow-y-auto">
            <CardHeader>
              <CardTitle className="text-sm">Configurações de Autonomia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto actions */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-3">
                  Ações Automáticas (sem aprovação)
                </h4>
                <div className="space-y-3">
                  <ToggleItem
                    label="Classificar transações automaticamente"
                    description="Usa memória + IA para classificar novas transações"
                    checked={autonomy.auto_classify}
                    onChange={(v) => setAutonomy((prev) => ({ ...prev, auto_classify: v }))}
                  />
                  <ToggleItem
                    label="Atualizar DRE automaticamente"
                    description="Recalcula DRE quando transações são classificadas"
                    checked={autonomy.auto_update_dre}
                    onChange={(v) => setAutonomy((prev) => ({ ...prev, auto_update_dre: v }))}
                  />
                  <ToggleItem
                    label="Conciliar contas automaticamente"
                    description="Vincula pagamentos bancários a contas a pagar"
                    checked={autonomy.auto_bill_reconcile}
                    onChange={(v) => setAutonomy((prev) => ({ ...prev, auto_bill_reconcile: v }))}
                  />
                </div>
              </div>

              {/* Thresholds */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-3">Limites e Alertas</h4>
                <div className="space-y-4">
                  <ThresholdItem
                    label="Alerta de runway abaixo de"
                    value={autonomy.runway_alert_months}
                    suffix="meses"
                    onChange={(v) => setAutonomy((prev) => ({ ...prev, runway_alert_months: v }))}
                  />
                  <ThresholdItem
                    label="Alerta de variância acima de"
                    value={autonomy.variance_alert_percent}
                    suffix="%"
                    onChange={(v) => setAutonomy((prev) => ({ ...prev, variance_alert_percent: v }))}
                  />
                  <ThresholdItem
                    label="Limite para transação única"
                    value={autonomy.single_transaction_limit}
                    suffix="R$"
                    onChange={(v) =>
                      setAutonomy((prev) => ({ ...prev, single_transaction_limit: v }))
                    }
                  />
                </div>
              </div>

              {/* Notifications */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-3">Notificações</h4>
                <div className="space-y-3">
                  <ToggleItem
                    label="Email"
                    description="Receber alertas e resumos por email"
                    checked={autonomy.notify_email}
                    onChange={(v) => setAutonomy((prev) => ({ ...prev, notify_email: v }))}
                  />
                  <ToggleItem
                    label="WhatsApp"
                    description="Receber alertas críticos e resumo diário via WhatsApp"
                    checked={autonomy.notify_whatsapp}
                    onChange={(v) => setAutonomy((prev) => ({ ...prev, notify_whatsapp: v }))}
                  />
                  {autonomy.notify_whatsapp && (
                    <div className="ml-4">
                      <Input
                        placeholder="(11) 99999-9999"
                        value={autonomy.whatsapp_number}
                        onChange={(e) =>
                          setAutonomy((prev) => ({ ...prev, whatsapp_number: e.target.value }))
                        }
                        className="h-8 text-xs max-w-[200px]"
                      />
                    </div>
                  )}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => toast.success("Configurações salvas")}
              >
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Insights sidebar */}
      <div className="w-[320px] shrink-0 overflow-y-auto hidden xl:block">
        <InsightsPanel />
      </div>
    </div>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400",
    high: "bg-amber-500/20 text-amber-400",
    medium: "bg-blue-500/20 text-blue-400",
    low: "bg-slate-500/20 text-slate-400",
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[priority] ?? colors.medium}`}>
      {priority}
    </span>
  )
}

function ToggleItem({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="pt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
            checked ? "bg-chart-1" : "bg-muted"
          }`}
        >
          <span
            className={`pointer-events-none h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              checked ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      <div>
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{description}</p>
      </div>
    </label>
  )
}

function ThresholdItem({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string
  value: number
  suffix: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs">{label}</span>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-7 w-20 text-xs text-right"
        />
        <span className="text-xs text-muted-foreground w-10">{suffix}</span>
      </div>
    </div>
  )
}

function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    classify_transactions: "Classificar Transações",
    update_dre: "Atualizar DRE",
    alert: "Alerta Enviado",
    notify: "Notificação",
    generate_report: "Gerar Relatório",
    reconcile_bill: "Conciliar Conta",
    plan: "Plano de Ação",
  }
  return labels[action] ?? action
}
