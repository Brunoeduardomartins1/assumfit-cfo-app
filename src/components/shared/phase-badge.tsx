import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { BUSINESS_PHASES, type BusinessPhase } from "@/config/constants"

interface PhaseBadgeProps {
  phase: BusinessPhase
  className?: string
}

const phaseColorMap: Record<BusinessPhase, string> = {
  PROJETO: "bg-fase-projeto/20 text-fase-projeto border-fase-projeto/30",
  GO_LIVE: "bg-fase-golive/20 text-fase-golive border-fase-golive/30",
  TRACAO: "bg-fase-tracao/20 text-fase-tracao border-fase-tracao/30",
  PRE_ESCALA: "bg-fase-escala/20 text-fase-escala border-fase-escala/30",
}

export function PhaseBadge({ phase, className }: PhaseBadgeProps) {
  const config = BUSINESS_PHASES[phase]

  return (
    <Badge
      variant="outline"
      className={cn(phaseColorMap[phase], className)}
    >
      {config.label}
    </Badge>
  )
}
