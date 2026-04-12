import { z } from 'zod'

export const createSetorSchema = z.object({
  nome: z.string().min(1, 'Nome do setor é obrigatório').max(100),
  unitIds: z.array(z.string().uuid()).min(1, 'Selecione ao menos uma unidade'),
})

export const updateSetorSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
  unitIds: z.array(z.string().uuid()).min(1).optional(),
})

export const setorIdParamSchema = z.object({
  id: z.string().uuid('ID de setor inválido'),
})

export const listSetoresQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
  unitId: z.string().uuid().optional(),
})

export type CreateSetorInput = z.infer<typeof createSetorSchema>
export type UpdateSetorInput = z.infer<typeof updateSetorSchema>
