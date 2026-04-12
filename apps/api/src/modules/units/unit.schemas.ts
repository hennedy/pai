import { z } from 'zod'

const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const

// Schema de listagem de unidades com paginacao
export const listUnitsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['ativo', 'inativo']).optional(),
  search: z.string().optional(),
})

export type ListUnitsQuery = z.infer<typeof listUnitsQuerySchema>

// Schema de criacao de unidade
export const createUnitSchema = z.object({
  nome: z
    .string({ required_error: 'Nome e obrigatorio' })
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim(),
  razaoSocial: z
    .string()
    .max(255, 'Razao social deve ter no maximo 255 caracteres')
    .trim()
    .optional()
    .nullable(),
  cnpj: z
    .string()
    .max(18, 'CNPJ invalido')
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'Formato de CNPJ invalido (ex: 00.000.000/0001-00)')
    .optional()
    .nullable(),
  endereco: z
    .string()
    .max(500, 'Endereco deve ter no maximo 500 caracteres')
    .trim()
    .optional()
    .nullable(),
  telefone: z
    .string()
    .max(20, 'Telefone deve ter no maximo 20 caracteres')
    .trim()
    .optional()
    .nullable(),
  email: z
    .string()
    .email('Email invalido')
    .max(255)
    .trim()
    .optional()
    .nullable(),
  responsavelId: z
    .string()
    .uuid('ID de responsavel invalido')
    .optional()
    .nullable(),
  horarioAbertura: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato invalido. Use HH:MM')
    .optional()
    .nullable(),
  horarioFechamento: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato invalido. Use HH:MM')
    .optional()
    .nullable(),
  diasFuncionamento: z
    .array(z.enum(diasSemana))
    .optional()
    .nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  raioValidacaoMetros: z.coerce.number().int().min(50).max(5000).optional().nullable(),
})

export type CreateUnitInput = z.infer<typeof createUnitSchema>

// Schema de edicao de unidade
export const updateUnitSchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim()
    .optional(),
  razaoSocial: z
    .string()
    .max(255, 'Razao social deve ter no maximo 255 caracteres')
    .trim()
    .optional()
    .nullable(),
  cnpj: z
    .string()
    .max(18, 'CNPJ invalido')
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'Formato de CNPJ invalido (ex: 00.000.000/0001-00)')
    .optional()
    .nullable(),
  endereco: z
    .string()
    .max(500, 'Endereco deve ter no maximo 500 caracteres')
    .trim()
    .optional()
    .nullable(),
  telefone: z
    .string()
    .max(20, 'Telefone deve ter no maximo 20 caracteres')
    .trim()
    .optional()
    .nullable(),
  email: z
    .string()
    .email('Email invalido')
    .max(255)
    .trim()
    .optional()
    .nullable(),
  responsavelId: z
    .string()
    .uuid('ID de responsavel invalido')
    .optional()
    .nullable(),
  horarioAbertura: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato invalido. Use HH:MM')
    .optional()
    .nullable(),
  horarioFechamento: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Formato invalido. Use HH:MM')
    .optional()
    .nullable(),
  diasFuncionamento: z
    .array(z.enum(diasSemana))
    .optional()
    .nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  raioValidacaoMetros: z.coerce.number().int().min(50).max(5000).optional().nullable(),
})

export type UpdateUnitInput = z.infer<typeof updateUnitSchema>

// Schema de alteracao de status
export const updateUnitStatusSchema = z.object({
  status: z.enum(['ativo', 'inativo'], {
    required_error: 'Status e obrigatorio',
    invalid_type_error: 'Status deve ser "ativo" ou "inativo"',
  }),
})

export type UpdateUnitStatusInput = z.infer<typeof updateUnitStatusSchema>

// Schema de parametro ID
export const unitIdParamSchema = z.object({
  id: z.string().uuid('ID de unidade invalido'),
})

export type UnitIdParam = z.infer<typeof unitIdParamSchema>

// ========== Unit Integration Schemas ==========

const unitIntegrationTypes = [
  'google',
  'cardapioweb',
  'ifood',
  'whatsapp_avisos',
  'whatsapp_frente_loja',
  'whatsapp_producao',
  'whatsapp_gerencia',
  'outro',
] as const

export const createUnitIntegrationSchema = z.object({
  tipo: z.enum(unitIntegrationTypes, { required_error: 'Tipo e obrigatorio' }),
  nome: z
    .string({ required_error: 'Nome e obrigatorio' })
    .min(1)
    .max(255)
    .trim(),
  configuracao: z.record(z.unknown()).optional().nullable(),
})

export type CreateUnitIntegrationInput = z.infer<typeof createUnitIntegrationSchema>

export const updateUnitIntegrationSchema = z.object({
  nome: z.string().min(1).max(255).trim().optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
  configuracao: z.record(z.unknown()).optional().nullable(),
})

export type UpdateUnitIntegrationInput = z.infer<typeof updateUnitIntegrationSchema>

export const unitIntegrationIdParamSchema = z.object({
  id: z.string().uuid('ID de unidade invalido'),
  integrationId: z.string().uuid('ID de integracao invalido'),
})

// ========== Sectors Schemas ==========
export const createSectorSchema = z.object({
  nome: z.string().min(1, 'Nome do setor e obrigatorio').max(100),
})

export const updateSectorSchema = z.object({
  nome: z.string().min(1).max(100).optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
})

export const sectorIdParamSchema = z.object({
  id: z.string().uuid('ID de unidade invalido'),
  sectorId: z.string().uuid('ID de setor invalido'),
})
