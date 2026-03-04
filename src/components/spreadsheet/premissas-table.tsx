"use client"

import { useSpreadsheetStore } from "@/stores/spreadsheet-store"

export function PremissasTable() {
  const { premissasData } = useSpreadsheetStore()

  if (!premissasData) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        Nenhuma premissa carregada.
      </div>
    )
  }

  return (
    <div className="overflow-auto border border-border rounded-md">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-card">
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Premissa
            </th>
            <th className="px-4 py-2 text-right font-medium text-muted-foreground w-[200px]">
              Valor
            </th>
          </tr>
        </thead>
        <tbody>
          {premissasData.items.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="px-4 py-2">{item.label}</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">
                {item.value !== null && item.value !== undefined
                  ? String(item.value)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
