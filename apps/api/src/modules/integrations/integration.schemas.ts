import { z } from 'zod'

// Schema de listagem de integracoes com paginacao
export const listIntegrationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['ativo', 'inativo']).optional(),
})

export type ListIntegrationsQuery = z.infer<typeof listIntegrationsQuerySchema>

// Schema de criacao de integracao
export const createIntegrationSchema = z.object({
  nome: z
    .string({ required_error: 'Nome e obrigatorio' })
    .min(1, 'Nome e obrigatorio')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim(),
  tipo: z
    .string({ required_error: 'Tipo e obrigatorio' })
    .min(1, 'Tipo e obrigatorio')
    .max(100, 'Tipo deve ter no maximo 100 caracteres'),
  configuracao: z.record(z.unknown()).optional(),
})

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>

// Schema de alteracao de status da integracao
export const changeIntegrationStatusSchema = z.object({
  status: z.enum(['ativo', 'inativo'], {
    required_error: 'Status e obrigatorio',
    invalid_type_error: 'Status deve ser "ativo" ou "inativo"',
  }),
})

export type ChangeIntegrationStatusInput = z.infer<typeof changeIntegrationStatusSchema>

// Schema de parametro ID
export const integrationIdParamSchema = z.object({
  id: z.string().uuid('ID de integracao invalido'),
})

export type IntegrationIdParam = z.infer<typeof integrationIdParamSchema>

// Schema de parametro com ID e logId
export const integrationLogParamSchema = z.object({
  id: z.string().uuid('ID de integracao invalido'),
  logId: z.string().uuid('ID do log invalido'),
})

export type IntegrationLogParam = z.infer<typeof integrationLogParamSchema>

// Schema de listagem de logs de integracao
export const listIntegrationLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['sucesso', 'falha']).optional(),
})

export type ListIntegrationLogsQuery = z.infer<typeof listIntegrationLogsQuerySchema>

// Schema do webhook
export const webhookParamSchema = z.object({
  integrationId: z.string().uuid('ID de integracao invalido'),
})

export type WebhookParam = z.infer<typeof webhookParamSchema>
