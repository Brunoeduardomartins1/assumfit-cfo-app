/**
 * WhatsApp integration via Z-API
 * Docs: https://developer.z-api.io/
 */

const ZAPI_BASE = "https://api.z-api.io/instances"

function getConfig() {
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token = process.env.ZAPI_TOKEN
  if (!instanceId || !token) {
    throw new Error("Z-API not configured (ZAPI_INSTANCE_ID, ZAPI_TOKEN)")
  }
  return { instanceId, token }
}

function buildUrl(path: string): string {
  const { instanceId, token } = getConfig()
  return `${ZAPI_BASE}/${instanceId}/token/${token}/${path}`
}

/**
 * Send a plain text WhatsApp message.
 */
export async function sendWhatsAppText(
  phone: string,
  message: string
): Promise<boolean> {
  try {
    const res = await fetch(buildUrl("send-text"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: normalizePhone(phone),
        message,
      }),
    })
    if (!res.ok) {
      console.error("[WhatsApp] Send failed:", res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error("[WhatsApp] Send error:", err)
    return false
  }
}

/**
 * Send a document (PDF, XLSX) via WhatsApp.
 */
export async function sendWhatsAppDocument(
  phone: string,
  documentUrl: string,
  fileName: string,
  caption?: string
): Promise<boolean> {
  try {
    const res = await fetch(buildUrl("send-document/url"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: normalizePhone(phone),
        document: documentUrl,
        fileName,
        caption: caption ?? "",
      }),
    })
    if (!res.ok) {
      console.error("[WhatsApp] Doc send failed:", res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error("[WhatsApp] Doc send error:", err)
    return false
  }
}

/**
 * Send a WhatsApp message with action buttons.
 */
export async function sendWhatsAppButtons(
  phone: string,
  title: string,
  message: string,
  buttons: Array<{ id: string; label: string }>
): Promise<boolean> {
  try {
    const res = await fetch(buildUrl("send-button-list"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: normalizePhone(phone),
        title,
        message,
        buttonList: {
          buttons: buttons.map((b) => ({
            id: b.id,
            label: b.label,
          })),
        },
      }),
    })
    if (!res.ok) {
      console.error("[WhatsApp] Buttons send failed:", res.status)
      return false
    }
    return true
  } catch (err) {
    console.error("[WhatsApp] Buttons send error:", err)
    return false
  }
}

/**
 * Normalize phone to E.164 format (Brazil default).
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("55")) return digits
  return `55${digits}`
}

/**
 * Check if WhatsApp is configured.
 */
export function isWhatsAppConfigured(): boolean {
  return !!(process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN)
}
