"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PhaseBadge } from "@/components/shared/phase-badge"
import { ConnectionCard } from "@/components/open-finance/connection-card"
import { TransactionList } from "@/components/open-finance/transaction-list"
import { ReconciliationPanel } from "@/components/open-finance/reconciliation-panel"
import { getCurrentPhase } from "@/config/phases"
import { Landmark, ArrowDownUp, Shield, Loader2 } from "lucide-react"
import type { OpenFinanceConnection, BankAccount, BankTransaction, ReconciliationEntry } from "@/types/open-finance"
import { PluggyConnectWidget } from "@/components/open-finance/pluggy-connect-widget"
import { toast } from "sonner"
import { useOrg } from "@/hooks/use-org"
import { reconcile } from "@/lib/open-finance/reconciler"
import { useSpreadsheetStore } from "@/stores/spreadsheet-store"
import { useRealtimeSync } from "@/hooks/use-realtime-sync"

export default function OpenFinancePage() {
  const currentPhase = getCurrentPhase()
  const { orgId } = useOrg()
  const fluxoRows = useSpreadsheetStore((s) => s.fluxoRows)
  const fluxoMonths = useSpreadsheetStore((s) => s.fluxoMonths)
  const [connections, setConnections] = useState<OpenFinanceConnection[]>([])
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [reconciliation, setReconciliation] = useState<ReconciliationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)

  // Load bank accounts + realized transactions from API (uses admin client, bypasses RLS)
  const loadOpenFinanceData = useCallback(async () => {
    if (!orgId) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await fetch("/api/open-finance/data")
      if (!res.ok) {
        console.error("[open-finance] API error:", res.status, await res.text())
        return
      }
      const { bankAccounts: dbAccounts, transactions: dbTxs } = await res.json()

      if (dbAccounts.length > 0) {
        const conn: OpenFinanceConnection = {
          id: dbAccounts[0].id,
          provider: dbAccounts[0].provider as "pluggy",
          institutionName: dbAccounts[0].bank_name,
          status: dbAccounts[0].connection_status === "connected" ? "connected" : "error",
          lastSync: dbAccounts[0].last_sync,
          createdAt: dbAccounts[0].created_at,
          accounts: dbAccounts.map((a: Record<string, string | number | null>) => ({
            id: a.id,
            connectionId: a.id,
            name: a.bank_name,
            type: (a.account_type as "checking") ?? "checking",
            number: a.account_number ?? undefined,
            balance: a.balance ?? 0,
            currencyCode: "BRL",
          })),
        }
        setConnections([conn])
      } else {
        setConnections([])
      }

      if (dbTxs.length > 0) {
        const bankTxs: BankTransaction[] = dbTxs.map((t: Record<string, string | number | null>) => ({
          id: t.id,
          accountId: "acc-db",
          date: (t.month as string).slice(0, 10),
          description: t.notes ?? t.account_code,
          amount: Math.abs(Number(t.amount)),
          type: Number(t.amount) < 0 ? "debit" as const : "credit" as const,
          classifiedAccount: t.account_code,
          categoryConfidence: "high" as const,
        }))
        setTransactions(bankTxs)
        if (fluxoRows.length > 0) {
          const monthKeys = fluxoMonths.map((m) => m.key)
          const recon = reconcile(bankTxs, fluxoRows, monthKeys)
          setReconciliation(recon)
        }
      } else {
        setTransactions([])
        setReconciliation([])
      }
    } catch (err) {
      console.error("[open-finance] Error loading data:", err)
    } finally {
      setLoading(false)
    }
  }, [orgId, fluxoRows, fluxoMonths])

  useEffect(() => {
    if (!orgId) return
    loadOpenFinanceData()
  }, [orgId, loadOpenFinanceData])

  // Realtime sync — re-fetch when bank_accounts or transactions change
  const realtimeTables = useMemo(() => ["bank_accounts", "transactions"], [])
  useRealtimeSync(orgId, realtimeTables, loadOpenFinanceData)

  const handleConnectSuccess = useCallback(async (itemId: string) => {
    if (!orgId) return
    try {
      // Fetch accounts from the new connection
      const accountsRes = await fetch(`/api/open-finance/accounts?connectionId=${itemId}`)
      const accountsData = await accountsRes.json()
      if (!accountsRes.ok) throw new Error(accountsData.error)

      const accounts = accountsData.accounts as BankAccount[]
      if (accounts.length === 0) {
        toast.warning("Nenhuma conta encontrada nesta conexao.")
        return
      }

      // Fetch transactions (last 90 days)
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        .toISOString().split("T")[0]
      const to = now.toISOString().split("T")[0]

      let allTransactions: BankTransaction[] = []
      for (const acc of accounts) {
        const txRes = await fetch(
          `/api/open-finance/transactions?accountId=${acc.id}&from=${from}&to=${to}`
        )
        const txData = await txRes.json()
        if (txRes.ok && txData.transactions) {
          allTransactions = [...allTransactions, ...txData.transactions]
        }
      }

      // Sync to database
      const syncRes = await fetch("/api/open-finance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: allTransactions,
          bankAccount: {
            provider: "pluggy",
            providerAccountId: accounts[0].id,
            pluggyItemId: itemId,
            bankName: accounts[0].name,
            type: accounts[0].type,
            number: accounts[0].number,
            balance: accounts[0].balance,
          },
        }),
      })
      const syncData = await syncRes.json()

      toast.success(
        `Sincronizado! ${syncData.synced} transacoes (${syncData.classified} classificadas)`
      )
      await loadOpenFinanceData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao sincronizar")
    }
  }, [orgId, loadOpenFinanceData])

  const handleSync = useCallback(async (connectionId: string) => {
    if (!orgId) return
    setSyncing(connectionId)
    try {
      const conn = connections.find((c) => c.id === connectionId)
      if (!conn || conn.accounts.length === 0) {
        toast.error("Sem contas para sincronizar")
        return
      }

      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toISOString().split("T")[0]
      const to = now.toISOString().split("T")[0]

      let allTransactions: BankTransaction[] = []
      for (const acc of conn.accounts) {
        const txRes = await fetch(
          `/api/open-finance/transactions?accountId=${acc.id}&from=${from}&to=${to}`
        )
        const txData = await txRes.json()
        if (txRes.ok && txData.transactions) {
          allTransactions = [...allTransactions, ...txData.transactions]
        }
      }

      const syncRes = await fetch("/api/open-finance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: allTransactions }),
      })
      const syncData = await syncRes.json()

      toast.success(`${syncData.synced} transacoes sincronizadas`)
      await loadOpenFinanceData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na sincronizacao")
    } finally {
      setSyncing(null)
    }
  }, [orgId, connections, loadOpenFinanceData])

  const handleDelete = useCallback(async (connectionId: string) => {
    if (!confirm("Remover esta conexao bancaria? As transacoes ja importadas serao mantidas.")) {
      return
    }
    try {
      const res = await fetch("/api/open-finance/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      toast.success("Conexao removida")
      setConnections((prev) => prev.filter((c) => c.id !== connectionId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover")
    }
  }, [])

  const classified = transactions.filter((t) => t.classifiedAccount).length
  const total = transactions.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Open Finance</h2>
          <p className="text-sm text-muted-foreground">
            Conexoes bancarias, transacoes e conciliacao automatica
          </p>
        </div>
        <PhaseBadge phase={currentPhase} />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Carregando dados bancarios...</span>
        </div>
      )}

      {/* Stats */}
      {!loading && <><div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Conexoes</span>
            </div>
            <p className="text-2xl font-bold mt-1">{connections.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Transacoes</span>
            </div>
            <p className="text-2xl font-bold mt-1">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Classificadas</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {classified}
              <span className="text-sm font-normal text-muted-foreground">/{total}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex flex-col justify-between h-full">
            <span className="text-sm text-muted-foreground">Nova conexao</span>
            <div className="mt-2">
              <PluggyConnectWidget
                onSuccess={handleConnectSuccess}
                clientUserId={orgId ?? undefined}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connections */}
      {connections.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              onSync={handleSync}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {!loading && connections.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma conexao bancaria. Conecte um banco usando o botao acima.
          </CardContent>
        </Card>
      )}

      {/* Transactions + Reconciliation side by side */}
      {transactions.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Transacoes</CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {classified}/{total} classificadas
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto">
                <TransactionList transactions={transactions} />
              </div>
            </CardContent>
          </Card>

          <ReconciliationPanel entries={reconciliation} />
        </div>
      )}
      </>}
    </div>
  )
}
