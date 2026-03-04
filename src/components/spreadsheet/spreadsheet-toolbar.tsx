"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Upload,
  Download,
  Undo2,
  Redo2,
  ChevronsUpDown,
  ChevronsDownUp,
  Save,
} from "lucide-react"
import { useSpreadsheetStore } from "@/stores/spreadsheet-store"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SpreadsheetToolbarProps {
  onImport: (file: File) => void
  onExport: () => void
}

export function SpreadsheetToolbar({ onImport, onExport }: SpreadsheetToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const {
    undo,
    redo,
    undoStack,
    redoStack,
    expandAll,
    collapseAll,
    dirtyCells,
    clearDirty,
  } = useSpreadsheetStore()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onImport(file)
      e.target.value = ""
    }
  }

  const hasDirty = dirtyCells.size > 0

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-card">
      {/* Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1" />
            Importar
          </Button>
        </TooltipTrigger>
        <TooltipContent>Importar planilha XLSX</TooltipContent>
      </Tooltip>

      {/* Export */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-1" />
            Exportar
          </Button>
        </TooltipTrigger>
        <TooltipContent>Exportar como XLSX</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Undo / Redo */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={undoStack.length === 0}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={redo}
            disabled={redoStack.length === 0}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refazer (Ctrl+Y)</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Expand / Collapse */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={expandAll}>
            <ChevronsUpDown className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Expandir tudo</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={collapseAll}>
            <ChevronsDownUp className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Recolher tudo</TooltipContent>
      </Tooltip>

      {/* Save indicator */}
      {hasDirty && (
        <>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <div className="flex items-center gap-1 text-xs text-alerta">
            <Save className="h-3.5 w-3.5" />
            <span>{dirtyCells.size} alteracoes nao salvas</span>
          </div>
        </>
      )}
    </div>
  )
}
