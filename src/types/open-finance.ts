export interface OpenFinanceConnection {
  id: string
  provider: "pluggy" | "belvo"
  institutionName: string
  institutionLogo?: string
  status: "connecting" | "connected" | "error" | "expired"
  lastSync: string | null
  accounts: BankAccount[]
  createdAt: string
}

export interface BankAccount {
  id: string
  connectionId: string
  name: string
  type: "checking" | "savings" | "credit_card" | "investment"
  number?: string
  balance: number
  currencyCode: string
}

export interface BankTransaction {
  id: string
  accountId: string
  date: string
  description: string
  amount: number
  type: "debit" | "credit"
  category?: string
  categoryConfidence?: "high" | "medium" | "low"
  classifiedAccount?: string // chart_of_accounts match
  isDuplicate?: boolean
  isInternalTransfer?: boolean
  rawData?: Record<string, unknown>
}

export interface ClassificationRule {
  id: string
  pattern: string // regex or keyword
  matchField: "description" | "merchant"
  accountCode: string // chart_of_accounts code
  accountLabel: string
  priority: number
}

export interface ReconciliationEntry {
  monthKey: string
  accountLabel: string
  estimado: number
  realizado: number
  variance: number
  variancePercent: number
  status: "ok" | "warning" | "alert" // ok: <5%, warning: 5-15%, alert: >15%
}

export interface OpenFinanceProvider {
  createConnectToken(): Promise<string>
  getAccounts(connectionId: string): Promise<BankAccount[]>
  getTransactions(accountId: string, from: string, to: string): Promise<BankTransaction[]>
  deleteConnection(connectionId: string): Promise<void>
}
