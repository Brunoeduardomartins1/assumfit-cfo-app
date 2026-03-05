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
  Target,
  Coins,
  Handshake,
  UsersRound,
  FileBarChart,
  Store,
  Grid3X3,
  FileSpreadsheet,
  Gauge,
  CreditCard,
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
    label: "KPIs",
    href: "/kpis",
    icon: Target,
    description: "CAC, LTV, MRR, Churn, NPS",
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
    label: "Captacao",
    href: "/simulador-captacao",
    icon: Coins,
    description: "Simulador de rodadas",
  },
  {
    label: "Cenarios",
    href: "/cenarios",
    icon: GitBranch,
    description: "Planejamento de cenarios",
  },
  {
    label: "Contratos",
    href: "/contratos",
    icon: Handshake,
    description: "Clientes e receita recorrente",
  },
  {
    label: "Headcount",
    href: "/headcount",
    icon: UsersRound,
    description: "Contratacao vs orcamento",
  },
  {
    label: "Board Report",
    href: "/board-report",
    icon: FileBarChart,
    description: "Relatorio para investidores",
  },
  {
    label: "Fornecedores",
    href: "/fornecedores",
    icon: Store,
    description: "Gestao de fornecedores",
  },
  {
    label: "Cohort",
    href: "/cohort",
    icon: Grid3X3,
    description: "Analise de retencao",
  },
  {
    label: "Notas Fiscais",
    href: "/notas-fiscais",
    icon: FileSpreadsheet,
    description: "Import e reconciliacao NFs",
  },
  {
    label: "Contas",
    href: "/contas-pagar",
    icon: CreditCard,
    description: "Contas a pagar e receber",
  },
  {
    label: "Metas",
    href: "/metas",
    icon: Gauge,
    description: "Meta vs realizado",
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
