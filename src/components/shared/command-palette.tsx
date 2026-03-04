"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { mainNavItems } from "@/config/navigation"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleSelect = (href: string) => {
    router.push(href)
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar pagina, comando ou metrica..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        <CommandGroup heading="Navegacao">
          {mainNavItems.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.href}
                onSelect={() => handleSelect(item.href)}
              >
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            )
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Acoes Rapidas">
          <CommandItem onSelect={() => handleSelect("/fluxo-caixa")}>
            Importar planilha XLSX
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/fluxo-caixa")}>
            Exportar planilha
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/cenarios")}>
            Criar novo cenario
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("/agente-ia")}>
            Perguntar ao agente IA
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
