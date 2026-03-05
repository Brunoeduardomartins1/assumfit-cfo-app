"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { useOrg } from "@/hooks/use-org"
import { useFinancialData } from "@/hooks/use-financial-data"
import { formatBRL, formatBRLCompact } from "@/lib/formatters/currency"
import { cn } from "@/lib/utils"
import {
  DollarSign,
  PieChart,
  TrendingUp,
  Users,
  ArrowRight,
  Plus,
  Minus,
} from "lucide-react"

interface RoundConfig {
  name: string
  valuationPreMoney: number
  amountRaised: number
  optionPool: number // percentage 0-1
}

interface RoundResult {
  name: string
  valuationPreMoney: number
  amountRaised: number
  optionPool: number
  valuationPostMoney: number
  investorOwnership: number
  founderOwnership: number
  optionPoolOwnership: number
  pricePerShare: number
  runwayMonths: number
}

function computeRound(
  config: RoundConfig,
  priorFounderOwnership: number,
  priorInvestorOwnership: number,
  monthlyBurnRate: number
): RoundResult {
  const valuationPostMoney = config.valuationPreMoney + config.amountRaised
  const newInvestorPct = config.amountRaised / valuationPostMoney
  const optionPoolPct = config.optionPool

  // Dilution: existing holders diluted by new investor + option pool expansion
  const dilutionFactor = 1 - newInvestorPct - optionPoolPct
  const founderOwnership = priorFounderOwnership * dilutionFactor
  const existingInvestorOwnership = priorInvestorOwnership * dilutionFactor

  const totalShares = 10_000_000
  const pricePerShare = valuationPostMoney / totalShares
  const runwayMonths = monthlyBurnRate > 0 ? config.amountRaised / monthlyBurnRate : 0

  return {
    name: config.name,
    valuationPreMoney: config.valuationPreMoney,
    amountRaised: config.amountRaised,
    optionPool: config.optionPool,
    valuationPostMoney,
    investorOwnership: newInvestorPct + existingInvestorOwnership,
    founderOwnership,
    optionPoolOwnership: optionPoolPct,
    pricePerShare,
    runwayMonths,
  }
}

const DEFAULT_ROUNDS: RoundConfig[] = [
  { name: "Pre-Seed", valuationPreMoney: 4_000_000, amountRaised: 500_000, optionPool: 0.10 },
  { name: "Seed", valuationPreMoney: 15_000_000, amountRaised: 3_000_000, optionPool: 0.10 },
  { name: "Series A", valuationPreMoney: 60_000_000, amountRaised: 15_000_000, optionPool: 0.05 },
]

function OwnershipBar({ founder, investor, pool }: { founder: number; investor: number; pool: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex h-4 rounded-full overflow-hidden">
        <div
          className="bg-receita/80 transition-all"
          style={{ width: `${founder * 100}%` }}
          title={`Fundadores: ${(founder * 100).toFixed(1)}%`}
        />
        <div
          className="bg-chart-1/80 transition-all"
          style={{ width: `${investor * 100}%` }}
          title={`Investidores: ${(investor * 100).toFixed(1)}%`}
        />
        <div
          className="bg-amber-500/60 transition-all"
          style={{ width: `${pool * 100}%` }}
          title={`Option Pool: ${(pool * 100).toFixed(1)}%`}
        />
      </div>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-receita/80" />
          Fundadores {(founder * 100).toFixed(1)}%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-chart-1/80" />
          Investidores {(investor * 100).toFixed(1)}%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-500/60" />
          Option Pool {(pool * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

export default function SimuladorCaptacaoPage() {
  const { orgId } = useOrg()
  const { snapshot } = useFinancialData(orgId)
  const monthlyBurn = snapshot.burn_rate || 200000

  const [rounds, setRounds] = useState<RoundConfig[]>(DEFAULT_ROUNDS)

  const updateRound = (index: number, field: keyof RoundConfig, value: number) => {
    setRounds((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const results: RoundResult[] = useMemo(() => {
    const res: RoundResult[] = []
    let founderOwn = 1.0
    let investorOwn = 0.0

    for (const round of rounds) {
      const result = computeRound(round, founderOwn, investorOwn, monthlyBurn)
      res.push(result)
      founderOwn = result.founderOwnership
      investorOwn = result.investorOwnership
    }

    return res
  }, [rounds, monthlyBurn])

  const addRound = () => {
    setRounds((prev) => [
      ...prev,
      {
        name: `Round ${prev.length + 1}`,
        valuationPreMoney: (prev[prev.length - 1]?.valuationPreMoney ?? 10_000_000) * 3,
        amountRaised: (prev[prev.length - 1]?.amountRaised ?? 1_000_000) * 3,
        optionPool: 0.05,
      },
    ])
  }

  const removeRound = (index: number) => {
    if (rounds.length <= 1) return
    setRounds((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Simulador de Captacao</h2>
        <p className="text-sm text-muted-foreground">
          Simule rodadas de investimento e analise diluicao
        </p>
      </div>

      {/* Current Company Context */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Burn Rate Atual:</span>{" "}
              <span className="font-mono font-medium">{formatBRL(monthlyBurn)}/mes</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div>
              <span className="text-muted-foreground">Runway Atual:</span>{" "}
              <span className="font-mono font-medium">{snapshot.runway_meses.toFixed(1)} meses</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div>
              <span className="text-muted-foreground">Receita:</span>{" "}
              <span className="font-mono font-medium">{formatBRL(snapshot.receita_total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rounds Configuration */}
      <div className="grid gap-4 lg:grid-cols-3">
        {rounds.map((round, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {round.name}
                  </Badge>
                </CardTitle>
                {rounds.length > 1 && (
                  <button
                    onClick={() => removeRound(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Valuation Pre-Money</Label>
                <Input
                  type="number"
                  value={round.valuationPreMoney}
                  onChange={(e) => updateRound(i, "valuationPreMoney", Number(e.target.value))}
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">{formatBRLCompact(round.valuationPreMoney)}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Valor Captado</Label>
                <Input
                  type="number"
                  value={round.amountRaised}
                  onChange={(e) => updateRound(i, "amountRaised", Number(e.target.value))}
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">{formatBRLCompact(round.amountRaised)}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Option Pool: {(round.optionPool * 100).toFixed(0)}%</Label>
                <Slider
                  value={[round.optionPool * 100]}
                  min={0}
                  max={20}
                  step={1}
                  onValueChange={([v]) => updateRound(i, "optionPool", v / 100)}
                />
              </div>

              <Separator />

              {/* Results for this round */}
              {results[i] && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Post-Money</span>
                    <span className="font-mono font-medium">{formatBRLCompact(results[i].valuationPostMoney)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fundadores</span>
                    <span className={cn(
                      "font-mono font-medium",
                      results[i].founderOwnership < 0.5 ? "text-amber-500" : "text-receita"
                    )}>
                      {(results[i].founderOwnership * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Investidores</span>
                    <span className="font-mono font-medium">{(results[i].investorOwnership * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Runway pos</span>
                    <span className="font-mono font-medium">{results[i].runwayMonths.toFixed(1)} meses</span>
                  </div>

                  <OwnershipBar
                    founder={results[i].founderOwnership}
                    investor={results[i].investorOwnership}
                    pool={results[i].optionPoolOwnership}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Add round card */}
        {rounds.length < 5 && (
          <Card
            className="flex items-center justify-center min-h-[200px] border-dashed cursor-pointer hover:bg-muted/20 transition-colors"
            onClick={addRound}
          >
            <div className="text-center text-muted-foreground">
              <Plus className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Adicionar Rodada</p>
            </div>
          </Card>
        )}
      </div>

      {/* Comparative Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Comparativo entre Rodadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs text-muted-foreground font-medium">Rodada</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Pre-Money</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Captado</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Post-Money</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Diluicao</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Fundadores</th>
                  <th className="text-right py-2 text-xs text-muted-foreground font-medium">Runway</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const dilution = r.amountRaised / r.valuationPostMoney
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 text-xs font-medium">
                        <Badge variant="outline" className="text-[10px]">{r.name}</Badge>
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs">
                        {formatBRLCompact(r.valuationPreMoney)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs">
                        {formatBRLCompact(r.amountRaised)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs font-medium">
                        {formatBRLCompact(r.valuationPostMoney)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs text-despesa">
                        {(dilution * 100).toFixed(1)}%
                      </td>
                      <td className={cn(
                        "py-2 text-right font-mono tabular-nums text-xs font-medium",
                        r.founderOwnership < 0.5 ? "text-amber-500" : "text-receita"
                      )}>
                        {(r.founderOwnership * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-xs">
                        {r.runwayMonths.toFixed(1)} meses
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
