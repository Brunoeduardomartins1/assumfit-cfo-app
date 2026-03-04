import { NextRequest, NextResponse } from "next/server"
import { pluggyProvider } from "@/lib/open-finance"

export async function GET(request: NextRequest) {
  const connectionId = request.nextUrl.searchParams.get("connectionId")
  if (!connectionId) {
    return NextResponse.json({ error: "connectionId obrigatorio" }, { status: 400 })
  }

  try {
    const accounts = await pluggyProvider.getAccounts(connectionId)
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error("Accounts error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar contas" },
      { status: 500 }
    )
  }
}
