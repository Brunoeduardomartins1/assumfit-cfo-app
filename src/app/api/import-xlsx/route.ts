import { NextRequest, NextResponse } from "next/server"
import { parseWorkbook } from "@/lib/parsers"
import { getAuthContext } from "@/lib/supabase/auth-helpers"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "Nenhum arquivo enviado" },
        { status: 400 }
      )
    }

    if (
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xls")
    ) {
      return NextResponse.json(
        { error: "Formato invalido. Envie um arquivo .xlsx ou .xls" },
        { status: 400 }
      )
    }

    const buffer = await file.arrayBuffer()
    const parsed = parseWorkbook(buffer)

    // Persist to Supabase if authenticated
    const auth = await getAuthContext()
    if (auth?.orgId) {
      const admin = createAdminClient()
      const orgId = auth.orgId

      // 1. Upsert chart of accounts from fluxo rows
      const accountRows = parsed.fluxoCaixa.rows.map((r, i) => ({
        organization_id: orgId,
        code: r.id,
        name: r.category,
        level: r.level,
        parent_code: r.parentId ?? null,
        type: mapSectionToType(r.section),
        phase: null,
        is_summary: r.isGroup,
        display_order: i,
      }))

      if (accountRows.length > 0) {
        const { error: coaErr } = await admin
          .from("chart_of_accounts")
          .upsert(accountRows, { onConflict: "organization_id,code" })
        if (coaErr) console.error("COA upsert error:", coaErr)
      }

      // 2. Upsert transactions from fluxo rows (each cell = a transaction)
      const txRows: Array<{
        organization_id: string
        account_code: string
        month: string
        entry_type: string
        amount: number
        source: string
        created_by: string | null
      }> = []

      for (const row of parsed.fluxoCaixa.rows) {
        if (row.isGroup) continue // Skip summary rows
        for (const month of parsed.fluxoCaixa.months) {
          const val = row.values[month.key]
          if (val !== undefined && val !== null) {
            txRows.push({
              organization_id: orgId,
              account_code: row.id,
              month: `${month.key}-01`, // "2026-01" -> "2026-01-01"
              entry_type: row.isEstimado ? "estimado" : row.isRealizado ? "realizado" : "estimado",
              amount: val,
              source: "import",
              created_by: auth.userId,
            })
          }
        }
      }

      // Batch upsert transactions
      for (let i = 0; i < txRows.length; i += 500) {
        const chunk = txRows.slice(i, i + 500)
        const { error: txErr } = await admin
          .from("transactions")
          .upsert(chunk, { onConflict: "organization_id,account_code,month,entry_type" })
        if (txErr) console.error("Transaction upsert error:", txErr)
      }

      // 3. Upsert DRE (income statement)
      const dreRows: Array<{
        organization_id: string
        scenario_id: null
        month: string
        line_item: string
        amount: number
      }> = []

      for (const row of parsed.dre.rows) {
        for (const [key, val] of Object.entries(row.values)) {
          if (val !== undefined && val !== null && typeof val === "number") {
            dreRows.push({
              organization_id: orgId,
              scenario_id: null,
              month: `${key}-01`,
              line_item: row.id,
              amount: val,
            })
          }
        }
      }

      if (dreRows.length > 0) {
        for (let i = 0; i < dreRows.length; i += 500) {
          const chunk = dreRows.slice(i, i + 500)
          const { error: dreErr } = await admin
            .from("income_statement")
            .upsert(chunk, { onConflict: "organization_id,scenario_id,month,line_item" })
          if (dreErr) console.error("DRE upsert error:", dreErr)
        }
      }

      // 4. Upsert premissas
      if (parsed.premissas.items.length > 0) {
        const premRows = parsed.premissas.items
          .filter((p) => p.value !== null && typeof p.value === "number")
          .map((p) => ({
            organization_id: orgId,
            scenario_id: null,
            key: p.id,
            label: p.label,
            value: p.value as number,
            unit: "number" as const,
          }))

        if (premRows.length > 0) {
          const { error: premErr } = await admin
            .from("model_assumptions")
            .upsert(premRows, { onConflict: "organization_id,scenario_id,key" })
          if (premErr) console.error("Premissas upsert error:", premErr)
        }
      }

      // 5. Audit log
      await admin.from("audit_log").insert({
        organization_id: orgId,
        user_id: auth.userId,
        action: "import",
        entity_type: "spreadsheet",
        new_value: {
          filename: file.name,
          fluxoRows: parsed.fluxoCaixa.rows.length,
          fluxoMonths: parsed.fluxoCaixa.months.length,
          dreRows: parsed.dre.rows.length,
          premissas: parsed.premissas.items.length,
          transactions: txRows.length,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        fluxoCaixa: {
          rows: parsed.fluxoCaixa.rows,
          months: parsed.fluxoCaixa.months,
          phases: parsed.fluxoCaixa.phases,
        },
        dre: parsed.dre,
        premissas: parsed.premissas,
        vendasCoreNew: parsed.vendasCoreNew,
        vendasDigital: parsed.vendasDigital,
        vendasInfluencia: parsed.vendasInfluencia,
        vendasCore: parsed.vendasCore,
      },
      stats: {
        fluxoRows: parsed.fluxoCaixa.rows.length,
        fluxoMonths: parsed.fluxoCaixa.months.length,
        dreRows: parsed.dre.rows.length,
        premissas: parsed.premissas.items.length,
      },
    })
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao processar planilha",
      },
      { status: 500 }
    )
  }
}

function mapSectionToType(section: string): string {
  switch (section) {
    case "entradas":
      return "revenue"
    case "saidas":
    case "saidas_financeiras":
      return "expense"
    case "capital":
      return "capital"
    case "consolidacao":
      return "adjustment"
    default:
      return "expense"
  }
}
