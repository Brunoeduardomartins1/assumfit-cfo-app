"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PhaseBadge } from "@/components/shared/phase-badge"
import { ChatMessage } from "@/components/ai/chat-message"
import { InsightsPanel } from "@/components/ai/insights-panel"
import { getCurrentPhase } from "@/config/phases"
import { Send, Bot, Sparkles } from "lucide-react"
import { toast } from "sonner"

interface Message {
  role: "user" | "assistant"
  content: string
}

const SUGGESTED_PROMPTS = [
  "Qual o burn rate atual e como reduzir?",
  "Quando atingimos o break-even?",
  "Compare custos fixos vs variaveis",
  "Projete a receita para os proximos 6 meses",
  "Quais os maiores riscos financeiros?",
  "Analise a margem EBITDA ao longo do tempo",
]

export default function AgenteIaPage() {
  const currentPhase = getCurrentPhase()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
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

      // Add empty assistant message for streaming
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
                  if (parsed.error) {
                    throw new Error(parsed.error)
                  }
                  if (parsed.text) {
                    fullText += parsed.text
                    setMessages((prev) => {
                      const updated = [...prev]
                      updated[updated.length - 1] = {
                        role: "assistant",
                        content: fullText,
                      }
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

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      {/* Chat panel */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-chart-1/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-chart-1" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Agente IA Financeiro</h2>
              <p className="text-xs text-muted-foreground">
                Powered by Claude — Contexto financeiro ASSUMFIT/MUVX
              </p>
            </div>
          </div>
          <PhaseBadge phase={currentPhase} />
        </div>

        {/* Messages */}
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
                <div className="grid grid-cols-2 gap-2 max-w-lg">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="text-xs text-left px-3 py-2 rounded-md border border-border bg-card hover:bg-muted transition-colors text-muted-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
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

          {/* Input */}
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
      </div>

      {/* Insights sidebar */}
      <div className="w-[320px] shrink-0 overflow-y-auto hidden xl:block">
        <InsightsPanel />
      </div>
    </div>
  )
}
