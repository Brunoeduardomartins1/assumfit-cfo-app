import { NextRequest, NextResponse } from "next/server"
import { pluggyProvider, classifyTransactions, flagDuplicates } from "@/lib/open-finance"

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId")
  const from = request.nextUrl.searchParams.get("from")
  const to = request.nextUrl.searchParams.get("to")

  if (!accountId || !from || !to) {
    return NextResponse.json(
      { error: "accountId, from e to sao obrigatorios" },
      { status: 400 }
    )
  }

  try {
    let transactions = await pluggyProvider.getTransactions(accountId, from, to)

    // Classify and flag duplicates
    transactions = classifyTransactions(transactions)
    transactions = flagDuplicates(transactions)

    return NextResponse.json({
      transactions,
      stats: {
        total: transactions.length,
        classified: transactions.filter((t) => t.classifiedAccount).length,
        duplicates: transactions.filter((t) => t.isDuplicate).length,
        internalTransfers: transactions.filter((t) => t.isInternalTransfer).length,
      },
    })
  } catch (error) {
    console.error("Transactions error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar transacoes" },
      { status: 500 }
    )
  }
}
