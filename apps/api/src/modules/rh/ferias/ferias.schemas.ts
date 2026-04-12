import { z } from 'zod'

export const criarPeriodoAquisitivoSchema = z.object({
  colaboradorId: z.string().uuid(),
  numero: z.number().int().min(1),
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime(),
})

export const solicitarFeriasSchema = z.object({
  colaboradorId: z.string().uuid(),
  periodoAquisitivoId: z.string().uuid(),
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime(),
  diasSolicitados: z.number().int().min(5).max(30),
  abonoPecuniario: z.number().int().min(0).max(10).default(0),
  observacoes: z.string().optional(),
})

export const aprovarFeriasSchema = z.object({
  observacoes: z.string().optional(),
})

export const reprovarFeriasSchema = z.object({
  motivoReprovacao: z.string().min(1, 'Informe o motivo'),
})

export const feriasIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const periodoIdParamSchema = z.object({
  periodoId: z.string().uuid(),
})

export const listFeriasQuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  status: z.enum(['solicitado', 'aprovado', 'reprovado', 'programado', 'gozando', 'concluido', 'cancelado']).optional(),
  colaboradorId: z.string().uuid().optional(),
  search: z.string().optional(),
})

export const listPeriodosQuerySchema = z.object({
  colaboradorId: z.string().uuid().optional(),
  status: z.enum(['em_curso', 'adquirido', 'vencendo', 'vencido']).optional(),
})

export type SolicitarFeriasInput = z.infer<typeof solicitarFeriasSchema>
