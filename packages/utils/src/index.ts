// Helpers comuns - datas, formatacao, etc.

/**
 * Formata data para exibicao no padrao brasileiro
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR')
}

/**
 * Formata data e hora para exibicao
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('pt-BR')
}

/**
 * Gera codigo de unidade sequencial: PAD-001, PAD-002, etc.
 */
export function generateUnitCode(sequence: number): string {
  return `PAD-${String(sequence).padStart(3, '0')}`
}

/**
 * Gera codigo de lote: YYYYMMDD-NNN
 */
export function generateLoteCode(date: Date, sequence: number): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}-${String(sequence).padStart(3, '0')}`
}

/**
 * Formata valor monetario em BRL
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Calcula paginacao
 */
export function calcPagination(page: number = 1, limit: number = 20) {
  const safePage = Math.max(1, page)
  const safeLimit = Math.min(100, Math.max(1, limit))
  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    page: safePage,
    limit: safeLimit,
  }
}

/**
 * Calcula total de paginas
 */
export function calcTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit)
}
