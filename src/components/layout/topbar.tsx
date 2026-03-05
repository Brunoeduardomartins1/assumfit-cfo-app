"use client"

import { usePathname } from "next/navigation"
import { Bell, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { mainNavItems } from "@/config/navigation"
import { PeriodFilter } from "./period-filter"

export function Topbar() {
  const pathname = usePathname()
  const currentPage = mainNavItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  )

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <div>
        <h1 className="text-lg font-semibold">
          {currentPage?.label ?? "ASSUMFIT CFO"}
        </h1>
        {currentPage?.description && (
          <p className="text-xs text-muted-foreground">
            {currentPage.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <PeriodFilter />
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />
        </Button>
      </div>
    </header>
  )
}
