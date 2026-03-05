import { NextRequest, NextResponse } from "next/server"
import { setupUserOrg } from "@/lib/supabase/auth-helpers"

export async function POST(request: NextRequest) {
  try {
    const { userId, fullName, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json({ error: "userId and email required" }, { status: 400 })
    }

    const result = await setupUserOrg(userId, fullName ?? "", email)
    return NextResponse.json(result)
  } catch (error) {
    console.error("Auth setup error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao configurar conta" },
      { status: 500 }
    )
  }
}
