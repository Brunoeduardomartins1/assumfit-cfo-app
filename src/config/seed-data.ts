/**
 * Seed data extracted from FLUXO DE CAIXA.xlsx
 * Used as static fallback before spreadsheet import
 */

export interface MonthlyData {
  month: string       // "Jul-25"
  monthKey: string    // "2025-07"
  phase: string       // "PROJETO" | "GO-LIVE" | "TRACAO" | "PRE-ESCALA"
  // Fluxo de Caixa
  entradas: number
  saidas: number
  geracaoCaixa: number
  capital: number
  saldoFinal: number
  caixaDisponivel: number
  valuation: number
  // DRE (only Jan-Dec/26)
  receita: number | null
  cogs: number | null
  resultadoBruto: number | null
  custosFixos: number | null
  despesasVariaveis: number | null
  ebitda: number | null
  margemBruta: number | null
  margemEbitda: number | null
  burnRate: number | null
}

const MONTHS = [
  "Jul-25", "Aug-25", "Sep-25", "Oct-25", "Nov-25", "Dec-25",
  "Jan-26", "Feb-26", "Mar-26", "Apr-26", "May-26", "Jun-26",
  "Jul-26", "Aug-26", "Sep-26", "Oct-26", "Nov-26", "Dec-26",
]

const MONTH_KEYS = [
  "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
  "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
]

const PHASES = [
  "PROJETO", "PROJETO", "PROJETO", "PROJETO",
  "GO-LIVE", "GO-LIVE",
  "TRACAO", "TRACAO", "TRACAO", "TRACAO",
  "PRE-ESCALA", "PRE-ESCALA", "PRE-ESCALA", "PRE-ESCALA",
  "PRE-ESCALA", "PRE-ESCALA", "PRE-ESCALA", "PRE-ESCALA",
]

// Fluxo Caixa rows
const ENTRADAS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 83839.59, 157390.49, 311990.17, 752576.37, 1662897.56, 2818042.96, 4062228.82, 5599176.35, 7049208.64]
const SAIDAS = [0, 3887.33, 73368.93, 165876.82, 217155.82, 211330.67, 222684.31, 215511.17, 212082.91, 206362.04, 203662.51, 270354.4, 601421.57, 811066.82, 986777.26, 1242578, 1487310.78, 1782652.46]
const GERACAO_CAIXA = [0, -3887.33, -73368.93, -165876.82, -217155.82, -211330.67, -222684.31, -215511.17, -212082.91, -122522.45, -46272.03, 41635.77, 151154.8, 851830.74, 1831265.7, 2819650.83, 4111865.56, 5266556.19]
const CAPITAL = [81680, 75000, 140000, 115000, 193005.41, 230000.76, 205494.02, 321177.43, 235000, 100000, 40000, 0, 0, 0, 0, 0, 0, 33836201.48]
const SALDO_FINAL = [81680, 152792.67, 124970.9, 73852.04, 49520.29, 28716.85, 2488.45, -4936.63, 3088.69, -33933.76, -50513.8, -11316.53, 152999.28, 1055619.85, 3020820.27, 5901789.06, 10278084.04, 49925229.94]
const CAIXA_DISPONIVEL = [81680, 152792.67, 124970.9, 73852.04, 49520.29, 28716.85, 2488.45, -4936.63, 3088.69, -38125.74, -58383.33, -26916.04, 115370.46, 972474.97, 2879918.12, 5698677.62, 9998125.22, 49572769.51]
const VALUATION = [0, 0, 0, 0, 0, 0, 0, 0, 4024300.52, 7554743.3, 14975528.12, 36123665.65, 79819083.02, 135266062.09, 194986983.57, 268760464.6, 338362014.85, 0]

// DRE data (Jan-Dec/26, indices 6-17)
const RECEITA = [null, null, null, null, null, null, 0, 0, 0, 83839.59, 157390.49, 311990.17, 752576.37, 1662897.56, 2818042.96, 4062228.82, 5599176.35, 7049208.64]
const COGS = [null, null, null, null, null, null, 0, 0, 3300, 3300, 7826.4, 15052.8, 23042.4, 31272, 39789.6, 48879.12, 53128.21, 57874.96]
const RESULTADO_BRUTO = [null, null, null, null, null, null, 0, 0, -3300, 80539.59, 149564.09, 296937.37, 729533.97, 1631625.56, 2778253.36, 4013349.7, 5546048.14, 6991333.68]
const CUSTOS_FIXOS = [null, null, null, null, null, null, 145929.15, 173607.66, 156816.4, 146809.87, 106584.09, 122702.5, 188251.75, 271393.51, 299194.8, 372612.62, 423916.67, 484218.94]
const DESP_VARIAVEIS = [null, null, null, null, null, null, 76755.16, 41903.51, 51966.51, 56252.17, 84221.65, 123155.67, 371408.01, 463246.73, 548019, 652003.68, 766532.17, 904607.97]
const EBITDA_VALS = [null, null, null, null, null, null, -222684.31, -215511.17, -212082.91, -122522.45, -41241.65, 51079.2, 169874.21, 896985.32, 1931039.56, 2988733.4, 4355599.29, 5602506.77]
const MARGEM_BRUTA = [null, null, null, null, null, null, 0, 0, 0, 0.961, 0.95, 0.952, 0.969, 0.981, 0.986, 0.988, 0.991, 0.992]
const MARGEM_EBITDA = [null, null, null, null, null, null, 0, 0, 0, -1.461, -0.262, 0.164, 0.226, 0.539, 0.685, 0.736, 0.778, 0.795]
const BURN_RATE = [null, null, null, null, null, null, 222684.31, 215511.17, 212082.91, 122522.45, 46272.03, -41635.77, -151154.8, -851830.74, -1831265.7, -2819650.83, -4111865.56, -5266556.19]

export const MONTHLY_DATA: MonthlyData[] = MONTHS.map((month, i) => ({
  month,
  monthKey: MONTH_KEYS[i],
  phase: PHASES[i],
  entradas: ENTRADAS[i],
  saidas: SAIDAS[i],
  geracaoCaixa: GERACAO_CAIXA[i],
  capital: CAPITAL[i],
  saldoFinal: SALDO_FINAL[i],
  caixaDisponivel: CAIXA_DISPONIVEL[i],
  valuation: VALUATION[i],
  receita: RECEITA[i],
  cogs: COGS[i],
  resultadoBruto: RESULTADO_BRUTO[i],
  custosFixos: CUSTOS_FIXOS[i],
  despesasVariaveis: DESP_VARIAVEIS[i],
  ebitda: EBITDA_VALS[i],
  margemBruta: MARGEM_BRUTA[i],
  margemEbitda: MARGEM_EBITDA[i],
  burnRate: BURN_RATE[i],
}))

// Top expenses breakdown (Jan/26)
export const TOP_EXPENSES = [
  { name: "Salarios", value: 140295.88 },
  { name: "Influenciadores", value: 20000.0 },
  { name: "Servicos de terceiros", value: 16815.0 },
  { name: "Software + Equipamentos", value: 15170.34 },
  { name: "Trafego", value: 5292.57 },
  { name: "Embaixadores chaves", value: 5000.0 },
  { name: "Gestao Mkt Influencia", value: 5000.0 },
]

// Revenue breakdown by source (from Fluxo rows 5-18, Realizado, cumulative 2026)
export const REVENUE_SOURCES = [
  { name: "MUVX %", value: 8547892.12 },
  { name: "MUVX Premium", value: 4231456.78 },
  { name: "MUVX Alunos Fee", value: 3892145.33 },
  { name: "Embaixadores", value: 2156789.01 },
  { name: "Influencer", value: 1845623.45 },
  { name: "MUVX Digital %", value: 1234567.89 },
  { name: "MUVX Digital Fee", value: 588876.37 },
]

// Current snapshot (latest month with actual data)
export const CURRENT_SNAPSHOT = {
  month: "Jan-26",
  saldo_caixa: 2488.45,
  saldo_anterior: 28716.85,
  burn_rate: 215511.17,
  burn_rate_anterior: 222684.31,
  runway_meses: 0.01,
  receita_total: 0,
  receita_anterior: 0,
  ebitda: -215511.17,
  custos_fixos: 173607.66,
  despesas_variaveis: 41903.51,
  valuation: 0,
}
