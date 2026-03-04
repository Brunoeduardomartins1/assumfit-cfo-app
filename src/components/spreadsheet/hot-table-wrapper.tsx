"use client"

import { useCallback, useMemo, useRef } from "react"
import { HotTable, type HotTableRef } from "@handsontable/react-wrapper"
import { registerAllModules } from "handsontable/registry"
import Handsontable from "handsontable"
import "handsontable/styles/handsontable.css"
import "handsontable/styles/ht-theme-main.css"
import { useSpreadsheetStore, getVisibleRows } from "@/stores/spreadsheet-store"
import { formatBRL } from "@/lib/formatters/currency"

registerAllModules()

export function HotTableWrapper() {
  const hotRef = useRef<HotTableRef>(null)

  const {
    fluxoRows,
    fluxoMonths,
    fluxoPhases,
    collapsedGroups,
    toggleGroup,
    updateFluxoCell,
  } = useSpreadsheetStore()

  const visibleRows = useMemo(
    () => getVisibleRows(fluxoRows, collapsedGroups),
    [fluxoRows, collapsedGroups]
  )

  // Build 2D data array for Handsontable
  const data = useMemo(() => {
    return visibleRows.map((row) => {
      const indent = "  ".repeat(row.level)
      const prefix = row.isGroup
        ? collapsedGroups.has(row.id)
          ? "▸ "
          : "▾ "
        : "  "
      const categoryCell = `${indent}${prefix}${row.category}`

      const monthValues = fluxoMonths.map((m) => row.values[m.key] ?? null)

      return [categoryCell, ...monthValues]
    })
  }, [visibleRows, fluxoMonths, collapsedGroups])

  // Column headers
  const colHeaders = useMemo(
    () => ["Categoria", ...fluxoMonths.map((m) => m.label)],
    [fluxoMonths]
  )

  // Column definitions
  const columns = useMemo(() => {
    const cols: Handsontable.ColumnSettings[] = [
      {
        type: "text",
        readOnly: true,
        width: 320,
      },
    ]

    for (let i = 0; i < fluxoMonths.length; i++) {
      cols.push({
        type: "numeric",
        numericFormat: {
          pattern: "#,##0.00",
          culture: "pt-BR",
        },
        width: 120,
      })
    }

    return cols
  }, [fluxoMonths])

  // Handle cell click (collapse/expand)
  const handleAfterSelectionEnd = useCallback(
    (row: number, col: number) => {
      if (col !== 0) return
      const visRow = visibleRows[row]
      if (visRow?.isGroup) {
        toggleGroup(visRow.id)
      }
    },
    [visibleRows, toggleGroup]
  )

  // Handle cell edit
  const handleAfterChange = useCallback(
    (changes: Handsontable.CellChange[] | null) => {
      if (!changes) return
      for (const [row, col, , newVal] of changes) {
        if (typeof col === "number" && col > 0) {
          const visRow = visibleRows[row]
          if (!visRow || visRow.isGroup) continue
          const monthKey = fluxoMonths[col - 1]?.key
          if (!monthKey) continue
          const numVal = newVal === null || newVal === "" ? null : Number(newVal)
          if (numVal !== null && isNaN(numVal)) continue
          updateFluxoCell(visRow.id, monthKey, numVal)
        }
      }
    },
    [visibleRows, fluxoMonths, updateFluxoCell]
  )

  // Custom cell styling
  const cellRenderer = useCallback(
    (
      instance: Handsontable,
      td: HTMLTableCellElement,
      row: number,
      col: number,
      prop: string | number,
      value: unknown,
      cellProperties: Handsontable.CellProperties
    ) => {
      // Use default text renderer first
      Handsontable.renderers.TextRenderer(instance, td, row, col, prop, value, cellProperties)

      const visRow = visibleRows[row]
      if (!visRow) return

      td.style.fontFamily = "var(--font-geist-mono), monospace"
      td.style.fontSize = "13px"

      if (col === 0) {
        // Category column styling
        td.style.fontFamily = "var(--font-geist-sans), sans-serif"

        if (visRow.level === 0) {
          td.style.fontWeight = "700"
          td.style.backgroundColor = "hsl(var(--muted))"
          td.style.color = "hsl(var(--foreground))"
          td.style.fontSize = "13px"
        } else if (visRow.isGroup) {
          td.style.fontWeight = "600"
          td.style.color = "hsl(var(--foreground))"
        } else {
          td.style.fontWeight = "400"
          td.style.color = "hsl(var(--muted-foreground))"
        }

        if (visRow.isEstimado) {
          td.style.color = "hsl(var(--muted-foreground))"
          td.style.fontStyle = "italic"
        }
        if (visRow.isRealizado) {
          td.style.color = "hsl(var(--foreground))"
        }

        // Section headers
        if (
          visRow.section === "geracao_caixa" ||
          visRow.section === "consolidacao"
        ) {
          td.style.fontWeight = "700"
          td.style.borderTop = "2px solid hsl(var(--border))"
        }
      } else {
        // Numeric columns
        const numVal = value as number | null
        td.style.textAlign = "right"
        td.style.fontVariantNumeric = "tabular-nums"

        if (numVal !== null && numVal !== undefined) {
          // Format as BRL
          td.textContent = formatBRL(numVal)

          if (numVal < 0) {
            td.style.color = "hsl(var(--despesa))"
          } else if (numVal > 0 && visRow.section === "entradas") {
            td.style.color = "hsl(var(--receita))"
          } else if (numVal === 0) {
            td.style.color = "hsl(var(--muted-foreground))"
            td.style.opacity = "0.5"
          }
        } else {
          td.textContent = ""
        }

        // Group row styling for value columns
        if (visRow.level === 0) {
          td.style.fontWeight = "700"
          td.style.backgroundColor = "hsl(var(--muted))"
        } else if (visRow.isGroup) {
          td.style.fontWeight = "600"
        }

        // Section separator
        if (
          visRow.section === "geracao_caixa" ||
          visRow.section === "consolidacao"
        ) {
          td.style.fontWeight = "700"
          td.style.borderTop = "2px solid hsl(var(--border))"
        }

        // Read-only for group rows
        if (visRow.isGroup) {
          cellProperties.readOnly = true
        }
      }
    },
    [visibleRows]
  )

  if (fluxoRows.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        Nenhum dado carregado. Importe uma planilha XLSX para comecar.
      </div>
    )
  }

  return (
    <div className="hot-dark-theme w-full h-full overflow-hidden rounded-md border border-border">
      <HotTable
        ref={hotRef}
        data={data}
        colHeaders={colHeaders}
        columns={columns}
        fixedColumnsStart={1}
        fixedRowsTop={0}
        rowHeaders={false}
        stretchH="all"
        height="100%"
        width="100%"
        licenseKey="non-commercial-and-evaluation"
        manualColumnResize
        afterSelectionEnd={handleAfterSelectionEnd}
        afterChange={handleAfterChange}
        cells={(row, col) => {
          return { renderer: cellRenderer }
        }}
        className="htDark"
      />
    </div>
  )
}
