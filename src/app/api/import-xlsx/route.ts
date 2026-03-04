import { NextRequest, NextResponse } from "next/server"
import { parseWorkbook } from "@/lib/parsers"

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
