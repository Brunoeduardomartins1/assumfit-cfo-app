import { NextRequest, NextResponse } from "next/server"
import { pluggyProvider } from "@/lib/open-finance"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { itemId, clientUserId } = body

    const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/pluggy`
      : undefined

    const token = await pluggyProvider.createConnectToken(itemId, {
      webhookUrl,
      clientUserId,
    })

    return NextResponse.json({ connectToken: token })
  } catch (error) {
    console.error("Connect token error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao criar token de conexao" },
      { status: 500 }
    )
  }
}
