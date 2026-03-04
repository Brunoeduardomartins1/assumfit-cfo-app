"use client"

import { Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  isStreaming?: boolean
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex gap-3 py-3",
        role === "user" ? "justify-end" : "justify-start"
      )}
    >
      {role === "assistant" && (
        <div className="h-7 w-7 rounded-md bg-chart-1/20 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="h-4 w-4 text-chart-1" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed",
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border"
        )}
      >
        {content.split("\n").map((line, i) => (
          <p key={i} className={cn(i > 0 && "mt-1.5")}>
            {line || "\u00A0"}
          </p>
        ))}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-foreground/50 animate-pulse ml-0.5 align-middle" />
        )}
      </div>

      {role === "user" && (
        <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
