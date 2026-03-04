"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  Building2,
  Key,
  Plug,
  Bell,
  Shield,
  Database,
  Bot,
  CreditCard,
  Check,
  X,
  ExternalLink,
} from "lucide-react"

interface IntegrationStatus {
  name: string
  description: string
  icon: React.ReactNode
  status: "connected" | "disconnected" | "partial"
  details?: string
}

const INTEGRATIONS: IntegrationStatus[] = [
  {
    name: "Supabase",
    description: "Banco de dados e autenticacao",
    icon: <Database className="h-4 w-4" />,
    status: "connected",
    details: "sa-east-1 | PostgreSQL 15",
  },
  {
    name: "Anthropic (Claude)",
    description: "Agente IA financeiro",
    icon: <Bot className="h-4 w-4" />,
    status: process.env.NEXT_PUBLIC_SUPABASE_URL ? "connected" : "disconnected",
    details: "claude-sonnet-4-20250514",
  },
  {
    name: "Pluggy (Open Finance)",
    description: "Conexao bancaria via Open Finance",
    icon: <CreditCard className="h-4 w-4" />,
    status: "disconnected",
    details: "Configurar PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET",
  },
]

export default function ConfiguracoesPage() {
  const [orgName, setOrgName] = useState("ASSUMFIT")
  const [brandName, setBrandName] = useState("MUVX")
  const [email, setEmail] = useState("cfo@assumfit.com.br")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Configuracoes</h2>
        <p className="text-sm text-muted-foreground">
          Configuracoes da organizacao, integracoes e preferencias
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Organization */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Organizacao</CardTitle>
            </div>
            <CardDescription>Informacoes da empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Empresa</label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Marca</label>
              <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email do CFO</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Moeda</label>
              <Input value="BRL (Real Brasileiro)" disabled />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fuso Horario</label>
              <Input value="America/Sao_Paulo (GMT-3)" disabled />
            </div>
            <Button size="sm" className="mt-2">
              Salvar Alteracoes
            </Button>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Integracoes</CardTitle>
            </div>
            <CardDescription>Status das conexoes externas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {INTEGRATIONS.map((integration) => (
              <div key={integration.name} className="flex items-start gap-3">
                <div className="mt-0.5 text-muted-foreground">{integration.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{integration.name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px]",
                        integration.status === "connected"
                          ? "bg-receita/20 text-receita"
                          : integration.status === "partial"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {integration.status === "connected" ? (
                        <><Check className="h-2.5 w-2.5 mr-0.5" /> Conectado</>
                      ) : integration.status === "partial" ? (
                        "Parcial"
                      ) : (
                        <><X className="h-2.5 w-2.5 mr-0.5" /> Desconectado</>
                      )}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{integration.description}</p>
                  {integration.details && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {integration.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <Separator />
            <Button variant="outline" size="sm" className="w-full text-xs">
              <ExternalLink className="h-3 w-3 mr-1" />
              Gerenciar Chaves de API
            </Button>
          </CardContent>
        </Card>

        {/* API Keys (masked) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Chaves de API</CardTitle>
            </div>
            <CardDescription>Variaveis de ambiente configuradas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: "NEXT_PUBLIC_SUPABASE_URL", configured: true },
              { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", configured: true },
              { key: "SUPABASE_SERVICE_ROLE_KEY", configured: true },
              { key: "ANTHROPIC_API_KEY", configured: true },
              { key: "PLUGGY_CLIENT_ID", configured: false },
              { key: "PLUGGY_CLIENT_SECRET", configured: false },
            ].map((env) => (
              <div key={env.key} className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">{env.key}</span>
                {env.configured ? (
                  <Badge variant="outline" className="text-[9px] bg-receita/20 text-receita">
                    <Check className="h-2.5 w-2.5 mr-0.5" /> Configurado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] bg-muted text-muted-foreground">
                    <X className="h-2.5 w-2.5 mr-0.5" /> Pendente
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Notificacoes</CardTitle>
            </div>
            <CardDescription>Alertas e notificacoes automaticas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Runway abaixo de 3 meses", enabled: true },
              { label: "Variancia > 15% no reconciliado", enabled: true },
              { label: "Nova transacao bancaria", enabled: false },
              { label: "Relatorio mensal gerado", enabled: true },
              { label: "Break-even atingido", enabled: true },
            ].map((notif) => (
              <div key={notif.label} className="flex items-center justify-between">
                <span className="text-sm">{notif.label}</span>
                <div
                  className={cn(
                    "w-8 h-4 rounded-full relative cursor-pointer transition-colors",
                    notif.enabled ? "bg-receita" : "bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                      notif.enabled ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Seguranca</CardTitle>
            </div>
            <CardDescription>Configuracoes de seguranca e acesso</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Autenticacao</p>
                <p className="text-xs text-muted-foreground">Supabase Auth (email/password)</p>
                <Badge variant="outline" className="text-[9px] bg-receita/20 text-receita mt-1">
                  <Check className="h-2.5 w-2.5 mr-0.5" /> Ativo
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">RLS (Row Level Security)</p>
                <p className="text-xs text-muted-foreground">Habilitado em todas as 13 tabelas</p>
                <Badge variant="outline" className="text-[9px] bg-receita/20 text-receita mt-1">
                  <Check className="h-2.5 w-2.5 mr-0.5" /> Ativo
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Audit Trail</p>
                <p className="text-xs text-muted-foreground">Log de todas as alteracoes</p>
                <Badge variant="outline" className="text-[9px] bg-receita/20 text-receita mt-1">
                  <Check className="h-2.5 w-2.5 mr-0.5" /> Ativo
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
