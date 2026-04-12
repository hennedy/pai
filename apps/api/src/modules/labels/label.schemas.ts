import { z } from 'zod'

// Schema para gerar etiqueta
export const createLabelSchema = z.object({
  unitId: z.string().uuid('ID da unidade invalido'),
  recipeId: z.string().uuid('ID da receita invalido').optional(),
  productId: z.string().uuid('ID do produto invalido').optional(),
  descricao: z
    .string({ required_error: 'Descricao e obrigatoria' })
    .min(1, 'Descricao e obrigatoria')
    .max(300, 'Descricao deve ter no maximo 300 caracteres'),
  dataProducao: z.string().min(1, 'Data de producao e obrigatoria'),
  quantidade: z.coerce
    .number({ required_error: 'Quantidade e obrigatoria' })
    .int('Quantidade deve ser inteira')
    .positive('Quantidade deve ser maior que zero'),
})

export type CreateLabelInput = z.infer<typeof createLabelSchema>

// Schema para listar etiquetas com filtros
export const listLabelsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  unitId: z.string().uuid('ID da unidade invalido').optional(),
  dataInicio: z.string().datetime({ message: 'Data inicio invalida' }).optional(),
  dataFim: z.string().datetime({ message: 'Data fim invalida' }).optional(),
})

export type ListLabelsQuery = z.infer<typeof listLabelsQuerySchema>

// Schema para params com id
export const idParamSchema = z.object({
  id: z.string().uuid('ID invalido'),
})

export type IdParam = z.infer<typeof idParamSchema>

// Schema para criar template de etiqueta
export const createLabelTemplateSchema = z.object({
  productId: z.string().uuid('ID do produto invalido').optional(),
  recipeId: z.string().uuid('ID da receita invalido').optional(),
  diasValidade: z.coerce
    .number({ required_error: 'Dias de validade e obrigatorio' })
    .int('Dias de validade deve ser inteiro')
    .positive('Dias de validade deve ser maior que zero'),
})

export type CreateLabelTemplateInput = z.infer<typeof createLabelTemplateSchema>

// Schema para editar template de etiqueta
export const updateLabelTemplateSchema = z.object({
  productId: z.string().uuid('ID do produto invalido').optional(),
  recipeId: z.string().uuid('ID da receita invalido').optional(),
  diasValidade: z.coerce
    .number()
    .int('Dias de validade deve ser inteiro')
    .positive('Dias de validade deve ser maior que zero')
    .optional(),
})

export type UpdateLabelTemplateInput = z.infer<typeof updateLabelTemplateSchema>
