/**
 * Import all N8N workflow JSON files via N8N REST API.
 *
 * Usage:
 *   npx tsx scripts/import-n8n-workflows.ts
 *
 * Required env vars (in .env.local):
 *   N8N_BASE_URL  — e.g. https://n8n-production-c7d94.up.railway.app
 *   N8N_API_KEY   — API key from N8N Settings > API
 */

import { readFileSync, readdirSync } from "fs"
import { resolve, join } from "path"
import { config } from "dotenv"

// Load .env.local
config({ path: resolve(__dirname, "../.env.local") })

const N8N_BASE_URL = process.env.N8N_BASE_URL?.trim()
const N8N_API_KEY = process.env.N8N_API_KEY?.trim()

if (!N8N_BASE_URL || !N8N_API_KEY) {
  console.error("❌ Missing env vars. Set N8N_BASE_URL and N8N_API_KEY in .env.local")
  console.error("   N8N_BASE_URL=https://n8n-production-c7d94.up.railway.app")
  console.error("   N8N_API_KEY=your-api-key (get from N8N Settings > API)")
  process.exit(1)
}

const API_URL = `${N8N_BASE_URL.replace(/\/$/, "")}/api/v1`

const headers = {
  "Content-Type": "application/json",
  "X-N8N-API-KEY": N8N_API_KEY,
}

interface WorkflowResponse {
  id: string
  name: string
  active: boolean
}

async function apiRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `${API_URL}${path}`
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${method} ${path} failed (${res.status}): ${text}`)
  }

  return res.json()
}

async function getExistingWorkflows(): Promise<WorkflowResponse[]> {
  const res = (await apiRequest("GET", "/workflows")) as { data: WorkflowResponse[] }
  return res.data ?? []
}

async function createWorkflow(workflow: Record<string, unknown>): Promise<WorkflowResponse> {
  return (await apiRequest("POST", "/workflows", workflow)) as WorkflowResponse
}

async function activateWorkflow(id: string): Promise<WorkflowResponse> {
  return (await apiRequest("POST", `/workflows/${id}/activate`)) as WorkflowResponse
}

async function main() {
  console.log(`\n🔗 N8N Instance: ${N8N_BASE_URL}`)
  console.log(`📡 API URL: ${API_URL}\n`)

  // 1. List existing workflows to avoid duplicates
  let existing: WorkflowResponse[] = []
  try {
    existing = await getExistingWorkflows()
    console.log(`📋 Existing workflows: ${existing.length}`)
    for (const wf of existing) {
      console.log(`   - [${wf.id}] ${wf.name} (active: ${wf.active})`)
    }
    console.log()
  } catch (err) {
    console.error("⚠️  Could not list existing workflows:", (err as Error).message)
    console.log("   Continuing with import...\n")
  }

  const existingNames = new Set(existing.map((w) => w.name))
  const existingByName = new Map(existing.map((w) => [w.name, w]))

  // If --activate flag, activate all inactive workflows
  if (process.argv.includes("--activate")) {
    const inactive = existing.filter((w) => !w.active)
    if (inactive.length === 0) {
      console.log("✅ All workflows are already active!\n")
      return
    }
    console.log(`🔄 Activating ${inactive.length} inactive workflows...\n`)
    for (const wf of inactive) {
      try {
        await activateWorkflow(wf.id)
        console.log(`   🟢 ${wf.name} (${wf.id}) — Activated`)
      } catch (err) {
        console.log(`   🔴 ${wf.name} (${wf.id}) — Failed: ${(err as Error).message}`)
      }
    }
    console.log()
    return
  }

  // 2. Find all workflow JSON files
  const n8nDir = resolve(__dirname, "../n8n")
  const files = readdirSync(n8nDir)
    .filter((f) => f.endsWith(".json"))
    .sort()

  console.log(`📂 Found ${files.length} workflow files:\n`)

  const results: Array<{ file: string; status: string; id?: string }> = []

  // 3. Import each workflow
  for (const file of files) {
    const filePath = join(n8nDir, file)
    const raw = readFileSync(filePath, "utf-8")

    let workflow: Record<string, unknown>
    try {
      workflow = JSON.parse(raw)
    } catch {
      console.log(`   ❌ ${file} — Invalid JSON, skipping`)
      results.push({ file, status: "invalid_json" })
      continue
    }

    // Remove read-only fields that the N8N API rejects
    delete workflow.tags
    delete workflow.id
    delete workflow.createdAt
    delete workflow.updatedAt

    const name = (workflow.name as string) ?? file.replace(".json", "")

    // Check if already exists
    if (existingNames.has(name)) {
      console.log(`   ⏭️  ${file} — "${name}" already exists, skipping`)
      results.push({ file, status: "already_exists" })
      continue
    }

    try {
      // Create workflow
      console.log(`   📤 ${file} — Creating "${name}"...`)
      const created = await createWorkflow(workflow)
      console.log(`      ✅ Created with ID: ${created.id}`)

      // Activate workflow
      try {
        const activated = await activateWorkflow(created.id)
        console.log(`      🟢 Activated: ${activated.active}`)
        results.push({ file, status: "created_and_activated", id: created.id })
      } catch (activateErr) {
        // Webhook/DB workflows may fail activation without credentials configured in N8N
        console.log(`      🟡 Created but not activated (configure credentials in N8N first)`)
        results.push({ file, status: "created_not_activated", id: created.id })
      }
    } catch (err) {
      console.log(`   ❌ ${file} — Failed: ${(err as Error).message}`)
      results.push({ file, status: "failed" })
    }

    console.log()
  }

  // 4. Summary
  console.log("\n" + "=".repeat(60))
  console.log("📊 IMPORT SUMMARY")
  console.log("=".repeat(60))

  const created = results.filter((r) => r.status.startsWith("created"))
  const skipped = results.filter((r) => r.status === "already_exists")
  const failed = results.filter((r) => r.status === "failed" || r.status === "invalid_json")

  console.log(`\n   ✅ Created: ${created.length}`)
  for (const r of created) {
    console.log(`      - ${r.file} → ID: ${r.id} (${r.status})`)
  }

  if (skipped.length > 0) {
    console.log(`   ⏭️  Skipped (already exist): ${skipped.length}`)
    for (const r of skipped) {
      console.log(`      - ${r.file}`)
    }
  }

  if (failed.length > 0) {
    console.log(`   ❌ Failed: ${failed.length}`)
    for (const r of failed) {
      console.log(`      - ${r.file} (${r.status})`)
    }
  }

  console.log(`\n🔗 Manage workflows at: ${N8N_BASE_URL}\n`)

  // 5. Reminder about credentials
  if (created.length > 0) {
    console.log("⚠️  IMPORTANT: After import, configure these credentials in N8N:")
    console.log("   1. HTTP Header Auth (Agent API Key) — N8N_WEBHOOK_SECRET as Bearer token")
    console.log("   2. HTTP Header Auth (Resend API Key) — Authorization: Bearer re_xxx")
    console.log("   3. Postgres (Supabase DB) — connection to your Supabase database")
    console.log()
    console.log("   Also set these N8N environment variables:")
    console.log("   - VERCEL_APP_URL (e.g. https://assumfit-cfo.vercel.app)")
    console.log("   - ZAPI_INSTANCE_ID, ZAPI_TOKEN, WHATSAPP_NUMBER")
    console.log("   - NOTIFICATION_EMAIL")
    console.log()
  }
}

main().catch((err) => {
  console.error("💥 Fatal error:", err)
  process.exit(1)
})
