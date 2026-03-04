import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

export function formatMonth(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, "MMM/yy", { locale: ptBR })
}

export function formatMonthFull(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, "MMMM 'de' yyyy", { locale: ptBR })
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, "dd/MM/yyyy", { locale: ptBR })
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR })
}

export function toMonthKey(date: Date): string {
  return format(date, "yyyy-MM-01")
}
