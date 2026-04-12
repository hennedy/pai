import { z } from 'zod'

// Schema de listagem de ocorrencias com filtros e paginacao
export const listOccurrencesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  unitId: z.string().uuid('ID de unidade invalido').optional(),
  tipo: z.enum(['operacional', 'equipamento', 'pessoal', 'qualidade', 'seguranca', 'outro']).optional(),
  prioridade: z.enum(['baixa', 'media', 'alta', 'critica']).optional(),
  status: z.enum(['aberta', 'em_andamento', 'resolvida', 'encerrada']).optional(),
  periodoInicio: z.coerce.date().optional(),
  periodoFim: z.coerce.date().optional(),
})

export type ListOccurrencesQuery = z.infer<typeof listOccurrencesQuerySchema>

// Schema de criacao de ocorrencia
export const createOccurrenceSchema = z.object({
  unitId: z
    .string({ required_error: 'ID da unidade e obrigatorio' })
    .uuid('ID da unidade invalido'),
  titulo: z
    .string({ required_error: 'Titulo e obrigatorio' })
    .min(1, 'Titulo e obrigatorio')
    .max(255, 'Titulo deve ter no maximo 255 caracteres')
    .trim(),
  descricao: z
    .string({ required_error: 'Descricao e obrigatoria' })
    .min(1, 'Descricao e obrigatoria')
    .max(2000, 'Descricao deve ter no maximo 2000 caracteres'),
  tipo: z.enum(['operacional', 'equipamento', 'pessoal', 'qualidade', 'seguranca', 'outro'], {
    required_error: 'Tipo e obrigatorio',
    invalid_type_error: 'Tipo invalido',
  }),
  setor: z.string().max(100, 'Setor deve ter no maximo 100 caracteres').optional(),
  prioridade: z.enum(['baixa', 'media', 'alta', 'critica']).optional().default('media'),
  responsavelId: z.string().uuid('ID do responsavel invalido').optional(),
})

export type CreateOccurrenceInput = z.infer<typeof createOccurrenceSchema>

// Schema de edicao de ocorrencia
export const updateOccurrenceSchema = z.object({
  titulo: z
    .string()
    .min(1, 'Titulo e obrigatorio')
    .max(255, 'Titulo deve ter no maximo 255 caracteres')
    .trim()
    .optional(),
  descricao: z
    .string()
    .min(1, 'Descricao e obrigatoria')
    .max(2000, 'Descricao deve ter no maximo 2000 caracteres')
    .optional(),
  tipo: z.enum(['operacional', 'equipamento', 'pessoal', 'qualidade', 'seguranca', 'outro']).optional(),
  setor: z.string().max(100, 'Setor deve ter no maximo 100 caracteres').optional().nullable(),
  prioridade: z.enum(['baixa', 'media', 'alta', 'critica']).optional(),
  responsavelId: z.string().uuid('ID do responsavel invalido').optional().nullable(),
})

export type UpdateOccurrenceInput = z.infer<typeof updateOccurrenceSchema>

// Schema de alteracao de status
export const changeOccurrenceStatusSchema = z.object({
  status: z.enum(['aberta', 'em_andamento', 'resolvida', 'encerrada'], {
    required_error: 'Status e obrigatorio',
    invalid_type_error: 'Status invalido',
  }),
  observacao: z.string().max(500, 'Observacao deve ter no maximo 500 caracteres').optional(),
})

export type ChangeOccurrenceStatusInput = z.infer<typeof changeOccurrenceStatusSchema>

// Schema de comentario
export const createOccurrenceCommentSchema = z.object({
  texto: z
    .string({ required_error: 'Texto do comentario e obrigatorio' })
    .min(1, 'Texto do comentario e obrigatorio')
    .max(2000, 'Texto deve ter no maximo 2000 caracteres'),
})

export type CreateOccurrenceCommentInput = z.infer<typeof createOccurrenceCommentSchema>

// Schema de parametro ID
export const occurrenceIdParamSchema = z.object({
  id: z.string().uuid('ID de ocorrencia invalido'),
})

export type OccurrenceIdParam = z.infer<typeof occurrenceIdParamSchema>

// Schema de relatorio de recorrencia
export const occurrenceReportQuerySchema = z.object({
  unitId: z.string().uuid('ID de unidade invalido').optional(),
  periodoInicio: z.coerce.date().optional(),
  periodoFim: z.coerce.date().optional(),
  agruparPor: z.enum(['tipo', 'setor', 'periodo']).optional().default('tipo'),
})

export type OccurrenceReportQuery = z.infer<typeof occurrenceReportQuerySchema>
