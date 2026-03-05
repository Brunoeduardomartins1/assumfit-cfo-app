import { Resend } from "resend"

let resendClient: Resend | null = null

function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) throw new Error("RESEND_API_KEY not configured")
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ id: string } | null> {
  const from = process.env.RESEND_FROM_EMAIL ?? "ASSUMFIT CFO <cfo@assumfit.com.br>"
  try {
    const { data, error } = await getResend().emails.send({
      from,
      to,
      subject,
      html,
    })
    if (error) {
      console.error("Resend error:", error)
      return null
    }
    return data
  } catch (err) {
    console.error("Failed to send email:", err)
    return null
  }
}

export async function sendCFONotification(
  subject: string,
  html: string
): Promise<{ id: string } | null> {
  const to = process.env.NOTIFICATION_EMAIL
  if (!to) {
    console.warn("NOTIFICATION_EMAIL not configured, skipping email")
    return null
  }
  return sendEmail(to, subject, html)
}
