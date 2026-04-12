// Tipos compartilhados entre web e api

export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiError {
  error: string
  code: string
  details?: Record<string, unknown>
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface JwtPayload {
  userId: string
  email: string
  roles: Array<{
    unitId: string
    role: string
  }>
}

export interface DashboardSummary {
  unidadesAtivas: number
  ocorrenciasAbertas: number
  checklistsPendentesHoje: number
  alertasEstoque: number
}

export interface ChartDataPoint {
  label: string
  planejado?: number
  realizado?: number
  valor?: number
}
