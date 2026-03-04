"use client"

import { getCurrentPhase } from "@/config/phases"
import { BUSINESS_PHASES, type BusinessPhase } from "@/config/constants"
import { cn } from "@/lib/utils"

const PHASE_COLORS: Record<BusinessPhase, string> = {
  PROJETO: "bg-fase-projeto",
  GO_LIVE: "bg-fase-golive",
  TRACAO: "bg-fase-tracao",
  PRE_ESCALA: "bg-fase-escala",
}

const PHASE_RING: Record<BusinessPhase, string> = {
  PROJETO: "ring-fase-projeto",
  GO_LIVE: "ring-fase-golive",
  TRACAO: "ring-fase-tracao",
  PRE_ESCALA: "ring-fase-escala",
}

export function PhaseTimeline() {
  const current = getCurrentPhase()
  const phases = Object.entries(BUSINESS_PHASES) as [BusinessPhase, (typeof BUSINESS_PHASES)[BusinessPhase]][]

  return (
    <div className="flex items-center gap-0 w-full">
      {phases.map(([key, config], i) => {
        const isCurrent = key === current
        const isPast = phases.findIndex(([k]) => k === current) > i
        const isLast = i === phases.length - 1

        return (
          <div key={key} className="flex items-center flex-1">
            <div
              className={cn(
                "relative flex flex-col items-center flex-1 group"
              )}
            >
              {/* Bar */}
              <div className="w-full flex items-center">
                <div
                  className={cn(
                    "h-2 flex-1 rounded-full transition-all",
                    isCurrent
                      ? cn(PHASE_COLORS[key], "shadow-sm")
                      : isPast
                        ? cn(PHASE_COLORS[key], "opacity-60")
                        : "bg-muted"
                  )}
                />
                {!isLast && (
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full border-2 shrink-0 mx-1",
                      isPast || isCurrent
                        ? cn(PHASE_COLORS[key], "border-background")
                        : "bg-muted border-muted-foreground/30"
                    )}
                  />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-[10px] mt-1.5 text-center leading-tight",
                  isCurrent
                    ? "font-semibold text-foreground"
                    : isPast
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                )}
              >
                {config.label}
              </span>

              {/* Date range */}
              <span className="text-[9px] text-muted-foreground/50">
                {config.dateRange.start.replace("20", "")} — {config.dateRange.end.replace("20", "")}
              </span>

              {/* Current indicator */}
              {isCurrent && (
                <div
                  className={cn(
                    "absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full animate-pulse",
                    PHASE_COLORS[key]
                  )}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
