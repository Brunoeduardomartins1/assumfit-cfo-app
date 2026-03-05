import { createAuditEntry } from "@/lib/supabase/queries"

/**
 * Convenience helper to log an action to the audit_log table.
 * Safe to call from client or server — uses the browser Supabase client.
 */
export async function logAction(
  orgId: string,
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>
) {
  try {
    await createAuditEntry(orgId, {
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue,
      new_value: newValue,
    })
  } catch (err) {
    // Audit logging should never break the main flow
    console.error("Audit log failed:", err)
  }
}
