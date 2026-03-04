import { NextResponse } from "next/server"
import { pluggyProvider } from "@/lib/open-finance"

export async function POST() {
  try {
    const token = await pluggyProvider.createConnectToken()
    return NextResponse.json({ connectToken: token })
  } catch (error) {
    console.error("Connect token error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar token de conexao" },
      { status: 500 }
    )
  }
}
