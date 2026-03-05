import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|api/agent|api/open-finance/force-sync|api/debug|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
