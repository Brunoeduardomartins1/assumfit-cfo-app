"use client"

import { Badge } from "@/components/ui/badge"
import type { BankTransaction } from "@/types/open-finance"
import { formatBRL } from "@/lib/formatters/currency"
import { cn } from "@/lib/utils"
import { AlertTriangle, Copy, ArrowRightLeft } from "lucide-react"

interface TransactionListProps {
  transactions: BankTransaction[]
}

const CONFIDENCE_COLORS = {
  high: "bg-receita/20 text-receita border-receita/30",
  medium: "bg-alerta/20 text-alerta border-alerta/30",
  low: "bg-muted text-muted-foreground border-border",
}

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Nenhuma transacao encontrada.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
            tx.isDuplicate && "bg-despesa/5 border border-despesa/20",
            tx.isInternalTransfer && "opacity-50"
          )}
        >
          {/* Date */}
          <span className="text-xs text-muted-foreground w-[70px] shrink-0">
            {new Date(tx.date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>

          {/* Description + classification */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {tx.isDuplicate && (
                <Copy className="h-3 w-3 text-despesa shrink-0" />
              )}
              {tx.isInternalTransfer && (
                <ArrowRightLeft className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className="truncate">{tx.description}</span>
            </div>
            {tx.classifiedAccount && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] mt-0.5",
                  CONFIDENCE_COLORS[tx.categoryConfidence || "low"]
                )}
              >
                {tx.classifiedAccount}
              </Badge>
            )}
          </div>

          {/* Amount */}
          <span
            className={cn(
              "font-mono tabular-nums text-sm font-medium shrink-0",
              tx.type === "credit" ? "text-receita" : "text-despesa"
            )}
          >
            {tx.type === "credit" ? "+" : "-"}
            {formatBRL(Math.abs(tx.amount))}
          </span>
        </div>
      ))}
    </div>
  )
}
