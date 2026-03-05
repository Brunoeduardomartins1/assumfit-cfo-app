import { NextRequest, NextResponse } from "next/server"
import { pluggyProvider } from "@/lib/open-finance"
import { getAuthContext } from "@/lib/supabase/auth-helpers"
import { createAuditEntry } from "@/lib/supabase/queries"

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext()
    if (!auth) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
    }

    const { connectionId } = await request.json()
    if (!connectionId) {
      return NextResponse.json({ error: "connectionId obrigatorio" }, { status: 400 })
    }

    await pluggyProvider.deleteConnection(connectionId)

    await createAuditEntry(auth.orgId, {
      user_id: auth.userId,
      action: "delete_connection",
      entity_type: "bank_accounts",
      new_value: { connectionId },
    })

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error("Delete connection error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao remover conexao" },
      { status: 500 }
    )
  }
}
