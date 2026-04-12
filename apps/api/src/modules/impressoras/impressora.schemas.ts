import { z } from 'zod'

const SETORES_VALIDOS = ['encomendas', 'requisicao_producao'] as const

export const listImpressorasQuerySchema = z.object({
  page:    z.coerce.number().int().positive().optional().default(1),
  limit:   z.coerce.number().int().positive().max(100).optional().default(50),
  unitId:  z.string().uuid().optional(),
  ativo:   z.coerce.boolean().optional(),
  search:  z.string().optional(),
})

export const createImpressoraSchema = z.object({
  nome:     z.string().min(1, 'Nome obrigatorio').max(100).trim(),
  ip:       z.string()
    .min(7, 'IP invalido')
    .max(45)
    .regex(
      /^(\d{1,3}\.){3}\d{1,3}$/,
      'Formato de IP invalido (ex: 192.168.1.100)',
    ),
  porta:    z.coerce.number().int().min(1).max(65535).optional().default(9100),
  agentUrl:   z.string().url('URL invalida (ex: http://192.168.0.144:3456)').max(200).optional().nullable(),
  setores:  z
    .array(z.enum(SETORES_VALIDOS))
    .min(1, 'Selecione ao menos um setor'),
  unitId:   z.string().uuid('ID de unidade invalido'),
  ativo:    z.boolean().optional().default(true),
})

export const updateImpressoraSchema = z.object({
  nome:     z.string().min(1).max(100).trim().optional(),
  ip:       z.string()
    .min(7)
    .max(45)
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Formato de IP invalido')
    .optional(),
  porta:    z.coerce.number().int().min(1).max(65535).optional(),
  agentUrl:   z.string().url('URL invalida').max(200).optional().nullable(),
  setores:  z.array(z.enum(SETORES_VALIDOS)).min(1).optional(),
  unitId:   z.string().uuid().optional(),
  ativo:    z.boolean().optional(),
})

export const impressoraIdParamSchema = z.object({
  id: z.string().uuid('ID de impressora invalido'),
})

export type ListImpressorasQuery   = z.infer<typeof listImpressorasQuerySchema>
export type CreateImpressoraInput  = z.infer<typeof createImpressoraSchema>
export type UpdateImpressoraInput  = z.infer<typeof updateImpressoraSchema>
