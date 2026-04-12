import { z } from 'zod'

export const createTransferenciaCountSchema = z.object({
  origemUnitId: z.string().uuid('ID da unidade de origem invalido'),
  destinoUnitId: z.string().uuid('ID da unidade de destino invalido'),
  observacao: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid('ID do produto invalido'),
        peso: z.number().positive('Peso deve ser maior que 0'),
      })
    )
    .min(1, 'Informe pelo menos um item'),
}).refine((d) => d.origemUnitId !== d.destinoUnitId, {
  message: 'Unidade de origem e destino nao podem ser iguais',
  path: ['destinoUnitId'],
})

export type CreateTransferenciaCountInput = z.infer<typeof createTransferenciaCountSchema>

export const listTransferenciaCountsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  origemUnitId: z.string().uuid().optional(),
  destinoUnitId: z.string().uuid().optional(),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
})

export type ListTransferenciaCountsQuery = z.infer<typeof listTransferenciaCountsQuerySchema>

export const idParamSchema = z.object({
  id: z.string().uuid('ID invalido'),
})

export const codigoBalancaParamSchema = z.object({
  codigo: z.string().min(1),
})
