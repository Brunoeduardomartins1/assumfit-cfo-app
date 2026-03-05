import { PluggyClient } from "pluggy-sdk"
import type {
  OpenFinanceProvider,
  BankAccount,
  BankTransaction,
} from "@/types/open-finance"

function getClient(): PluggyClient {
  const clientId = process.env.PLUGGY_CLIENT_ID
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET sao obrigatorios")
  }
  return new PluggyClient({ clientId, clientSecret })
}

export const pluggyProvider: OpenFinanceProvider = {
  async createConnectToken(itemId?: string, options?: {
    webhookUrl?: string
    clientUserId?: string
  }): Promise<string> {
    const client = getClient()
    const token = await client.createConnectToken(itemId, {
      webhookUrl: options?.webhookUrl,
      clientUserId: options?.clientUserId,
    })
    return token.accessToken
  },

  async getAccounts(connectionId: string): Promise<BankAccount[]> {
    const client = getClient()
    const result = await client.fetchAccounts(connectionId)
    return result.results.map((acc) => ({
      id: acc.id,
      connectionId: connectionId,
      name: acc.name,
      type: mapAccountType(acc.type),
      number: acc.number ?? undefined,
      balance: acc.balance,
      currencyCode: acc.currencyCode ?? "BRL",
    }))
  },

  async getTransactions(
    accountId: string,
    from: string,
    to: string
  ): Promise<BankTransaction[]> {
    const client = getClient()
    const result = await client.fetchTransactions(accountId, {
      from,
      to,
      pageSize: 500,
    })
    return result.results.map((tx) => ({
      id: tx.id,
      accountId,
      date: tx.date instanceof Date ? tx.date.toISOString().split("T")[0] : String(tx.date),
      description: tx.description ?? "",
      amount: tx.amount,
      type: tx.type === "DEBIT" ? "debit" : "credit",
      category: tx.category ?? undefined,
      rawData: tx as unknown as Record<string, unknown>,
    }))
  },

  async deleteConnection(connectionId: string): Promise<void> {
    const client = getClient()
    await client.deleteItem(connectionId)
  },
}

function mapAccountType(
  type: string
): BankAccount["type"] {
  switch (type) {
    case "BANK":
    case "CHECKING_ACCOUNT":
      return "checking"
    case "SAVINGS_ACCOUNT":
      return "savings"
    case "CREDIT_CARD":
    case "CREDIT":
      return "credit_card"
    case "INVESTMENT":
      return "investment"
    default:
      return "checking"
  }
}
