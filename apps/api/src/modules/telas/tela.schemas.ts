import { z } from 'zod'

// Schema para criar uma contagem de telas
export const createTelaContagemSchema = z.object({
  telasCruas: z
    .number({ required_error: 'Telas cruas e obrigatorio' })
    .int('Deve ser um numero inteiro')
    .min(0, 'Deve ser >= 0'),
  telasAssadas: z
    .number({ required_error: 'Telas assadas e obrigatorio' })
    .int('Deve ser um numero inteiro')
    .min(0, 'Deve ser >= 0'),
  vendidosTodos: z.boolean().optional().default(false),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/, 'Formato invalido, use HH:MM').optional(),
  observacao: z
    .string()
    .max(500, 'Observacao deve ter no maximo 500 caracteres')
    .optional(),
})

export type CreateTelaContagemInput = z.infer<typeof createTelaContagemSchema>

// Schema para listar contagens com filtros e paginacao
export const listTelaContagensQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
})

export type ListTelaContagensQuery = z.infer<typeof listTelaContagensQuerySchema>

// Schema para parametro ID
export const telaIdParamSchema = z.object({
  id: z.string().uuid('ID invalido'),
})

export type TelaIdParam = z.infer<typeof telaIdParamSchema>
