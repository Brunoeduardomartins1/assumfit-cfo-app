import { timingSafeEqual } from "crypto"
import { type NextRequest } from "next/server"

export function verifyCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const authHeader = request.headers.get("authorization")
  if (!authHeader) return false

  const token = authHeader.replace("Bearer ", "")

  try {
    const a = Buffer.from(token, "utf-8")
    const b = Buffer.from(secret, "utf-8")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
