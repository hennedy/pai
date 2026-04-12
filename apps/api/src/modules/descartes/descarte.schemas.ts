import { z } from 'zod'

// Schema para criar uma contagem de descartes
export const createDescartesCountSchema = z.object({
  observacao: z.string().max(500, 'Observacao deve ter no maximo 500 caracteres').optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid('ID do produto invalido'),
        peso: z.number().positive('Peso deve ser maior que 0'),
      })
    )
    .min(1, 'Informe pelo menos um item'),
})

export type CreateDescartesCountInput = z.infer<typeof createDescartesCountSchema>

// Schema para listar contagens com filtros
export const listDescartesCountsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
})

export type ListDescartesCountsQuery = z.infer<typeof listDescartesCountsQuerySchema>

// Schema para params com id
export const idParamSchema = z.object({
  id: z.string().uuid('ID invalido'),
})

export type IdParam = z.infer<typeof idParamSchema>

// Schema para busca por codigo de balanca
export const codigoBalancaParamSchema = z.object({
  codigo: z.string().min(1, 'Codigo e obrigatorio'),
})

export type CodigoBalancaParam = z.infer<typeof codigoBalancaParamSchema>
