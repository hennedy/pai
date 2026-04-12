import { z } from 'zod'

// Schema para criar ciclo de compras
export const createCycleSchema = z.object({
  titulo: z
    .string({ required_error: 'Titulo e obrigatorio' })
    .min(1, 'Titulo e obrigatorio')
    .max(200, 'Titulo deve ter no maximo 200 caracteres'),
  dataFechamento: z
    .string()
    .datetime({ message: 'Data de fechamento invalida' })
    .optional(),
  unitId: z.string().uuid('ID da unidade invalido').optional(),
})

export type CreateCycleInput = z.infer<typeof createCycleSchema>

// Schema para reabrir ciclo
export const reopenCycleSchema = z.object({
  motivo: z
    .string({ required_error: 'Motivo e obrigatorio para reabrir ciclo' })
    .min(1, 'Motivo e obrigatorio para reabrir ciclo')
    .max(500, 'Motivo deve ter no maximo 500 caracteres'),
})

export type ReopenCycleInput = z.infer<typeof reopenCycleSchema>

// Schema para criar solicitacao de compra
export const createRequestSchema = z.object({
  productId: z
    .string({ required_error: 'Produto e obrigatorio' })
    .uuid('ID do produto invalido'),
  quantidade: z
    .number({ required_error: 'Quantidade e obrigatoria' })
    .positive('Quantidade deve ser maior que zero'),
  observacao: z.string().max(500, 'Observacao deve ter no maximo 500 caracteres').optional(),
  marca: z.string().max(200, 'Marca deve ter no maximo 200 caracteres').optional(),
})

export type CreateRequestInput = z.infer<typeof createRequestSchema>

// Schema para editar solicitacao de compra
export const updateRequestSchema = z.object({
  productId: z.string().uuid('ID do produto invalido').optional(),
  quantidade: z.number().positive('Quantidade deve ser maior que zero').optional(),
  observacao: z.string().max(500, 'Observacao deve ter no maximo 500 caracteres').optional(),
  marca: z.string().max(200, 'Marca deve ter no maximo 200 caracteres').optional(),
})

export type UpdateRequestInput = z.infer<typeof updateRequestSchema>

// Schema para filtros de listagem de ciclos
export const listCyclesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['aberto', 'fechado', 'reaberto', 'consolidado']).optional(),
  unitId: z.string().uuid('ID da unidade invalido').optional(),
})

export type ListCyclesQuery = z.infer<typeof listCyclesQuerySchema>

// Schema para filtros de listagem de solicitacoes
export const listRequestsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  unitId: z.string().uuid('ID da unidade invalido').optional(),
})

export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>

// Schema para params com id
export const idParamSchema = z.object({
  id: z.string().uuid('ID invalido'),
})

export type IdParam = z.infer<typeof idParamSchema>

// Schema para params com id e reqId
export const requestParamSchema = z.object({
  id: z.string().uuid('ID do ciclo invalido'),
  reqId: z.string().uuid('ID da solicitacao invalido'),
})

export type RequestParam = z.infer<typeof requestParamSchema>

// Schema para query de consolidacao
export const consolidationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
})

export type ConsolidationQuery = z.infer<typeof consolidationQuerySchema>
