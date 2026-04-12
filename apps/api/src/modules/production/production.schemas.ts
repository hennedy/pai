import { z } from 'zod'

// Schema de criacao de ordem de producao
export const createProductionOrderSchema = z.object({
  unitId: z
    .string({ required_error: 'Unidade e obrigatoria' })
    .uuid('ID da unidade invalido'),
  recipeId: z
    .string({ required_error: 'Receita e obrigatoria' })
    .uuid('ID da receita invalido'),
  turno: z.enum(['manha', 'tarde', 'noite'], {
    required_error: 'Turno e obrigatorio',
    invalid_type_error: 'Turno deve ser "manha", "tarde" ou "noite"',
  }),
  quantidadePlanejada: z
    .number({ required_error: 'Quantidade planejada e obrigatoria' })
    .positive('Quantidade planejada deve ser maior que zero'),
})

export type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>

// Schema de conclusao de ordem de producao
export const completeProductionOrderSchema = z.object({
  quantidadeRealizada: z
    .number({ required_error: 'Quantidade realizada e obrigatoria' })
    .min(0, 'Quantidade realizada nao pode ser negativa'),
})

export type CompleteProductionOrderInput = z.infer<typeof completeProductionOrderSchema>

// Schema de listagem de ordens de producao com filtros e paginacao
export const listProductionOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  unitId: z.string().uuid('ID da unidade invalido').optional(),
  turno: z.enum(['manha', 'tarde', 'noite']).optional(),
  status: z.enum(['planejada', 'em_andamento', 'concluida', 'cancelada']).optional(),
  dataInicio: z.string().datetime({ message: 'Data de inicio invalida' }).optional(),
  dataFim: z.string().datetime({ message: 'Data de fim invalida' }).optional(),
})

export type ListProductionOrdersQuery = z.infer<typeof listProductionOrdersQuerySchema>

// Schema de relatorio de producao
export const productionReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  unitId: z.string().uuid('ID da unidade invalido').optional(),
  turno: z.enum(['manha', 'tarde', 'noite']).optional(),
  dataInicio: z.string().datetime({ message: 'Data de inicio invalida' }).optional(),
  dataFim: z.string().datetime({ message: 'Data de fim invalida' }).optional(),
})

export type ProductionReportQuery = z.infer<typeof productionReportQuerySchema>

// Schema de parametro ID
export const productionOrderIdParamSchema = z.object({
  id: z.string().uuid('ID da ordem de producao invalido'),
})

export type ProductionOrderIdParam = z.infer<typeof productionOrderIdParamSchema>
