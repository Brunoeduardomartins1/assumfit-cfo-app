import { NextRequest } from "next/server"
import { streamChat } from "@/lib/ai"
import { getAuthContext } from "@/lib/supabase/auth-helpers"

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages obrigatorio" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Get orgId for live data queries (non-blocking — works without auth too)
    let orgId: string | null = null
    try {
      const auth = await getAuthContext()
      orgId = auth?.orgId ?? null
    } catch {
      // Continue without org context
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamChat(messages, orgId)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Erro no streaming"
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
