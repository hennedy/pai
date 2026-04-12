import { z } from 'zod'

// Schema para criar utensilio
export const createUtensilSchema = z.object({
  nome: z
    .string({ required_error: 'Nome e obrigatorio' })
    .min(1, 'Nome e obrigatorio')
    .max(200, 'Nome deve ter no maximo 200 caracteres'),
  descricao: z.string().max(500, 'Descricao deve ter no maximo 500 caracteres').optional(),
  categoria: z.string().max(100, 'Categoria deve ter no maximo 100 caracteres').optional(),
  patrimonio: z
    .string({ required_error: 'Patrimonio e obrigatorio' })
    .min(1, 'Patrimonio e obrigatorio')
    .max(100, 'Patrimonio deve ter no maximo 100 caracteres'),
})

export type CreateUtensilInput = z.infer<typeof createUtensilSchema>

// Schema para editar utensilio
export const updateUtensilSchema = z.object({
  nome: z.string().min(1).max(200, 'Nome deve ter no maximo 200 caracteres').optional(),
  descricao: z.string().max(500, 'Descricao deve ter no maximo 500 caracteres').optional(),
  categoria: z.string().max(100, 'Categoria deve ter no maximo 100 caracteres').optional(),
  patrimonio: z.string().min(1).max(100, 'Patrimonio deve ter no maximo 100 caracteres').optional(),
})

export type UpdateUtensilInput = z.infer<typeof updateUtensilSchema>

// Schema para alterar status do utensilio
export const updateUtensilStatusSchema = z.object({
  status: z.enum(['disponivel', 'em_uso', 'manutencao', 'inativo'], {
    required_error: 'Status e obrigatorio',
    invalid_type_error: 'Status invalido',
  }),
})

export type UpdateUtensilStatusInput = z.infer<typeof updateUtensilStatusSchema>

// Schema para registrar movimentacao de utensilio
export const createMovementSchema = z.object({
  unitId: z.string().uuid('ID da unidade invalido'),
  tipo: z.enum(['entrada', 'saida', 'transferencia'], {
    required_error: 'Tipo de movimentacao e obrigatorio',
    invalid_type_error: 'Tipo invalido',
  }),
  observacao: z.string().max(500, 'Observacao deve ter no maximo 500 caracteres').optional(),
})

export type CreateMovementInput = z.infer<typeof createMovementSchema>

// Schema para listar utensilios com filtros
export const listUtensilsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  categoria: z.string().optional(),
  status: z.enum(['disponivel', 'em_uso', 'manutencao', 'inativo']).optional(),
  unitId: z.string().uuid('ID da unidade invalido').optional(),
})

export type ListUtensilsQuery = z.infer<typeof listUtensilsQuerySchema>

// Schema para listar movimentacoes com paginacao
export const listMovementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
})

export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>

// Schema para params com id
export const idParamSchema = z.object({
  id: z.string().uuid('ID invalido'),
})

export type IdParam = z.infer<typeof idParamSchema>

// ===================== CONTAGEM DE UTENSILIOS =====================

// Schema para criar uma contagem/reposicao
export const createUtensilCountSchema = z.object({
  turno: z.enum(['manha', 'tarde'], {
    required_error: 'Turno e obrigatorio',
    invalid_type_error: 'Turno invalido',
  }),
  tipo: z.enum(['contagem', 'reposicao'], {
    required_error: 'Tipo e obrigatorio',
    invalid_type_error: 'Tipo invalido',
  }),
  observacao: z.string().max(500, 'Observacao deve ter no maximo 500 caracteres').optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid('ID do produto invalido'),
        quantidade: z.number().int().min(0, 'Quantidade deve ser >= 0'),
      })
    )
    .min(1, 'Informe pelo menos um item'),
})

export type CreateUtensilCountInput = z.infer<typeof createUtensilCountSchema>

// Schema para listar contagens com filtros
export const listUtensilCountsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  tipo: z.enum(['contagem', 'reposicao']).optional(),
  turno: z.enum(['manha', 'tarde']).optional(),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
})

export type ListUtensilCountsQuery = z.infer<typeof listUtensilCountsQuerySchema>
