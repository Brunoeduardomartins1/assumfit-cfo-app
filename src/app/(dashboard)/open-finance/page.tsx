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
import { getBankAccounts, getTransactions } from "@/lib/supabase/queries"
import { reconcile } from "@/lib/open-finance/reconciler"
import { useSpreadsheetStore } from "@/stores/spreadsheet-store"
import { useRealtimeSync } from "@/hooks/use-realtime-sync"

// Demo data for when DB is empty / Pluggy not configured
const DEMO_CONNECTION: OpenFinanceConnection = {
  id: "demo-1",
  provider: "pluggy",
  institutionName: "Conta Simples",
  status: "connected",
  lastSync: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  accounts: [
    {
      id: "acc-1",
      connectionId: "demo-1",
      name: "Conta Corrente PJ",
      type: "checking",
      number: "****1234",
      balance: 2488.45,
      currencyCode: "BRL",
    },
  ],
}

const DEMO_TRANSACTIONS: BankTransaction[] = [
  { id: "tx1", accountId: "acc-1", date: "2026-01-28", description: "SALARIOS FOLHA JAN/26", amount: 140295.88, type: "debit", classifiedAccount: "Salários", categoryConfidence: "high" },
  { id: "tx2", accountId: "acc-1", date: "2026-01-25", description: "PAG FIGMA INC", amount: 540.0, type: "debit", classifiedAccount: "Figma", categoryConfidence: "high" },
  { id: "tx3", accountId: "acc-1", date: "2026-01-25", description: "PAG ATLASSIAN PTY", amount: 289.0, type: "debit", classifiedAccount: "Atlassian", categoryConfidence: "high" },
  { id: "tx4", accountId: "acc-1", date: "2026-01-22", description: "PIX INFLUENCIADOR MARIA", amount: 5000.0, type: "debit", classifiedAccount: "Gestão Mkt Influencia", categoryConfidence: "medium" },
  { id: "tx5", accountId: "acc-1", date: "2026-01-20", description: "PAG SUPABASE INC", amount: 125.0, type: "debit", classifiedAccount: "Supabase", categoryConfidence: "high" },
  { id: "tx6", accountId: "acc-1", date: "2026-01-18", description: "META ADS - TRAFEGO", amount: 5292.57, type: "debit", classifiedAccount: "Trafego", categoryConfidence: "high" },
  { id: "tx7", accountId: "acc-1", date: "2026-01-15", description: "TED RECEBIDA - INTEGRALIZACAO CAPITAL", amount: 30000.0, type: "credit" },
  { id: "tx8", accountId: "acc-1", date: "2026-01-10", description: "TED RECEBIDA - EMPRESTIMO SOCIO", amount: 80000.0, type: "credit" },
  { id: "tx9", accountId: "acc-1", date: "2026-01-10", description: "EMPRESTIMO BANCARIO", amount: 90000.0, type: "credit" },
  { id: "tx10", accountId: "acc-1", date: "2026-01-08", description: "PAG AWS AMAZON WEB SERVICES", amount: 1234.56, type: "debit", classifiedAccount: "AWS", categoryConfidence: "high" },
  { id: "tx11", accountId: "acc-1", date: "2026-01-05", description: "CONTABILIDADE MENSAL", amount: 2500.0, type: "debit", classifiedAccount: "Contabilidade", categoryConfidence: "medium" },
  { id: "tx12", accountId: "acc-1", date: "2026-01-03", description: "TARIFA MANUTENCAO CONTA", amount: 134.68, type: "debit", classifiedAccount: "Tarifas bancárias", categoryConfidence: "high" },
  { id: "tx13", accountId: "acc-1", date: "2026-01-02", description: "IOF S/ EMPRESTIMO", amount: 115.03, type: "debit", classifiedAccount: "IOF", categoryConfidence: "high" },
]

const DEMO_RECONCILIATION: ReconciliationEntry[] = [
  { monthKey: "2026-01", accountLabel: "Salários", estimado: 140295.88, realizado: 140295.88, variance: 0, variancePercent: 0, status: "ok" },
  { monthKey: "2026-01", accountLabel: "Software + Equipamentos", estimado: 15170.34, realizado: 12188.56, variance: -2981.78, variancePercent: -19.7, status: "alert" },
  { monthKey: "2026-01", accountLabel: "Trafego", estimado: 5292.57, realizado: 5292.57, variance: 0, variancePercent: 0, status: "ok" },
  { monthKey: "2026-01", accountLabel: "Influenciadores", estimado: 20000.0, realizado: 5000.0, variance: -15000.0, variancePercent: -75.0, status: "alert" },
  { monthKey: "2026-01", accountLabel: "Servicos de terceiros", estimado: 16815.0, realizado: 2500.0, variance: -14315.0, variancePercent: -85.2, status: "alert" },
  { monthKey: "2026-01", accountLabel: "Tarifas bancárias", estimado: 134.68, realizado: 134.68, variance: 0, variancePercent: 0, status: "ok" },
  { monthKey: "2026-01", accountLabel: "IOF", estimado: 115.03, realizado: 115.03, variance: 0, variancePercent: 0, status: "ok" },
]

export default function OpenFinancePage() {
  const currentPhase = getCurrentPhase()
  const { orgId } = useOrg()
  const fluxoRows = useSpreadsheetStore((s) => s.fluxoRows)
  const fluxoMonths = useSpreadsheetStore((s) => s.fluxoMonths)
  const [connections, setConnections] = useState<OpenFinanceConnection[]>([DEMO_CONNECTION])
  const [transactions, setTransactions] = useState<BankTransaction[]>(DEMO_TRANSACTIONS)
  const [reconciliation, setReconciliation] = useState<ReconciliationEntry[]>(DEMO_RECONCILIATION)
  const [loadedFromDb, setLoadedFromDb] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)

  // Load bank accounts + realized transactions from DB
  const loadOpenFinanceData = useCallback(async () => {
    if (!orgId) return
    try {
      const [dbAccounts, dbTxs] = await Promise.all([
        getBankAccounts(orgId),
        getTransactions(orgId, { source: "open_finance" }),
      ])
      if (dbAccounts.length > 0) {
        const conn: OpenFinanceConnection = {
          id: dbAccounts[0].id,
          provider: dbAccounts[0].provider as "pluggy",
          institutionName: dbAccounts[0].bank_name,
          status: dbAccounts[0].connection_status === "connected" ? "connected" : "error",
          lastSync: dbAccounts[0].last_sync,
          createdAt: dbAccounts[0].created_at,
          accounts: dbAccounts.map((a) => ({
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
      }
      if (dbTxs.length > 0) {
        const bankTxs: BankTransaction[] = dbTxs.map((t) => ({
          id: t.id,
          accountId: "acc-db",
          date: t.month.slice(0, 10),
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
          if (recon.length > 0) setReconciliation(recon)
        }
      }
      setLoadedFromDb(true)
    } catch {
      setLoadedFromDb(true)
    }
  }, [orgId, fluxoRows, fluxoMonths])

  useEffect(() => {
    if (!orgId || loadedFromDb) return
    loadOpenFinanceData()
  }, [orgId, loadedFromDb, loadOpenFinanceData])

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
      setLoadedFromDb(false) // triggers re-fetch
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao sincronizar")
    }
  }, [orgId])

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
      setLoadedFromDb(false) // refresh
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na sincronizacao")
    } finally {
      setSyncing(null)
    }
  }, [orgId, connections])

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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
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

      {/* Transactions + Reconciliation side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Transactions */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Transacoes (Jan/26)</CardTitle>
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

        {/* Reconciliation */}
        <ReconciliationPanel entries={reconciliation} />
      </div>
    </div>
  )
}
