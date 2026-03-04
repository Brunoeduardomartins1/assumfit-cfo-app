import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  TrendingUp,
  Landmark,
  Bot,
  GitBranch,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  description?: string
}

export const mainNavItems: NavItem[] = [
  {
    label: "Painel",
    href: "/painel",
    icon: LayoutDashboard,
    description: "Visao geral financeira",
  },
  {
    label: "Fluxo de Caixa",
    href: "/fluxo-caixa",
    icon: Receipt,
    description: "Planilha de fluxo de caixa",
  },
  {
    label: "DRE",
    href: "/dre",
    icon: BarChart3,
    description: "Demonstracao de resultado",
  },
  {
    label: "Projecoes",
    href: "/projecoes",
    icon: TrendingUp,
    description: "Projecoes de vendas",
  },
  {
    label: "Open Finance",
    href: "/open-finance",
    icon: Landmark,
    description: "Conexoes bancarias",
  },
  {
    label: "Agente IA",
    href: "/agente-ia",
    icon: Bot,
    description: "Assistente financeiro",
  },
  {
    label: "Cenarios",
    href: "/cenarios",
    icon: GitBranch,
    description: "Planejamento de cenarios",
  },
  {
    label: "Relatorios",
    href: "/relatorios",
    icon: FileText,
    description: "Relatorios e exportacao",
  },
]

export const bottomNavItems: NavItem[] = [
  {
    label: "Configuracoes",
    href: "/configuracoes",
    icon: Settings,
    description: "Configuracoes do sistema",
  },
]
