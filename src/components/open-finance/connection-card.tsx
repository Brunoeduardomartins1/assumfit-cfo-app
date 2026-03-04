"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Landmark, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react"
import type { OpenFinanceConnection } from "@/types/open-finance"
import { formatBRL } from "@/lib/formatters/currency"
import { cn } from "@/lib/utils"

interface ConnectionCardProps {
  connection: OpenFinanceConnection
  onSync: (id: string) => void
  onDelete: (id: string) => void
}

const STATUS_CONFIG = {
  connecting: { label: "Conectando...", color: "bg-alerta/20 text-alerta border-alerta/30" },
  connected: { label: "Conectado", color: "bg-receita/20 text-receita border-receita/30" },
  error: { label: "Erro", color: "bg-despesa/20 text-despesa border-despesa/30" },
  expired: { label: "Expirado", color: "bg-muted text-muted-foreground border-border" },
}

export function ConnectionCard({ connection, onSync, onDelete }: ConnectionCardProps) {
  const statusConfig = STATUS_CONFIG[connection.status]
  const totalBalance = connection.accounts.reduce((sum, acc) => sum + acc.balance, 0)

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <Landmark className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium text-sm">{connection.institutionName}</h3>
              <p className="text-xs text-muted-foreground">
                {connection.accounts.length} conta{connection.accounts.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-[10px]", statusConfig.color)}>
            {connection.status === "connected" ? (
              <Wifi className="h-3 w-3 mr-1" />
            ) : (
              <WifiOff className="h-3 w-3 mr-1" />
            )}
            {statusConfig.label}
          </Badge>
        </div>

        {connection.accounts.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {connection.accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{acc.name}</span>
                <span className="font-mono tabular-nums">{formatBRL(acc.balance)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-1.5 flex items-center justify-between text-xs font-medium">
              <span>Total</span>
              <span className="font-mono tabular-nums">{formatBRL(totalBalance)}</span>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onSync(connection.id)}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Sincronizar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-despesa"
            onClick={() => onDelete(connection.id)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Remover
          </Button>
          {connection.lastSync && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              Ultimo sync: {new Date(connection.lastSync).toLocaleString("pt-BR")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
