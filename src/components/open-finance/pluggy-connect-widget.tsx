"use client"

import { useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false }
)
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface PluggyConnectWidgetProps {
  onSuccess: (itemId: string) => void
  onError?: (error: { message: string; code?: string }) => void
  existingItemId?: string
  clientUserId?: string
}

export function PluggyConnectWidget({
  onSuccess,
  onError,
  existingItemId,
  clientUserId,
}: PluggyConnectWidgetProps) {
  const [connectToken, setConnectToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleOpen = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/open-finance/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: existingItemId,
          clientUserId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao obter token")
      setConnectToken(data.connectToken)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar conexao")
      setLoading(false)
    }
  }, [existingItemId, clientUserId])

  const handleSuccess = useCallback(
    (data: { item: { id: string } }) => {
      setConnectToken(null)
      setLoading(false)
      toast.success("Banco conectado com sucesso!")
      onSuccess(data.item.id)
    },
    [onSuccess]
  )

  const handleError = useCallback(
    (error: { message: string; code?: string }) => {
      setConnectToken(null)
      setLoading(false)
      toast.error(`Erro na conexao: ${error.message}`)
      onError?.(error)
    },
    [onError]
  )

  const handleClose = useCallback(() => {
    setConnectToken(null)
    setLoading(false)
  }, [])

  return (
    <>
      <Button size="sm" onClick={handleOpen} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Plus className="h-4 w-4 mr-1" />
        )}
        Conectar banco
      </Button>

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          onSuccess={handleSuccess}
          onError={handleError}
          onClose={handleClose}
        />
      )}
    </>
  )
}
