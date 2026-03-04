"use client"

import type { ParsedVendas } from "@/types/spreadsheet"
import { cn } from "@/lib/utils"

interface VendasTableProps {
  data: ParsedVendas | null
  title: string
}

export function VendasTable({ data, title }: VendasTableProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        Nenhum dado de {title} carregado.
      </div>
    )
  }

  // Get column keys from first row's values
  const valueKeys = data.rows.length > 0 ? Object.keys(data.rows[0].values) : []

  return (
    <div className="overflow-auto border border-border rounded-md">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-card">
            <th className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-medium text-muted-foreground min-w-[100px]">
              Mes
            </th>
            {data.headers.slice(1).map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-right font-medium text-muted-foreground min-w-[110px] whitespace-nowrap text-xs"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="sticky left-0 z-10 bg-background px-4 py-1.5 whitespace-nowrap">
                {row.monthLabel}
              </td>
              {valueKeys.map((key) => {
                const val = row.values[key]
                return (
                  <td
                    key={`${row.id}_${key}`}
                    className={cn(
                      "px-3 py-1.5 text-right font-mono tabular-nums",
                      val !== null && val !== undefined && val < 0 && "text-despesa"
                    )}
                  >
                    {val !== null && val !== undefined
                      ? val.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
                      : "—"}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
