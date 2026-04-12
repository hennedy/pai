import { z } from 'zod'

// ===================== QUERY =====================

export const listEncomendasQuerySchema = z.object({
  page:          z.coerce.number().int().positive().optional().default(1),
  limit:         z.coerce.number().int().positive().max(100).optional().default(20),
  unitId:        z.string().uuid('ID de unidade invalido').optional(),
  status:        z.enum(['pendente', 'pronta', 'retirada', 'cancelada']).optional(),
  pendentes:     z.coerce.boolean().optional(),
  search:        z.string().optional(),
  dataInicio:    z.coerce.date().optional(),
  dataFim:       z.coerce.date().optional(),
})

export type ListEncomendasQuery = z.infer<typeof listEncomendasQuerySchema>

// ===================== ITEM =====================

export const encomendaItemSchema = z.object({
  descricao:  z.string().min(1, 'Descricao do item e obrigatoria').max(200),
  quantidade: z.coerce.number().positive('Quantidade deve ser positiva'),
  unidade:    z.string().max(20).optional().default('un'),
  observacao: z.string().max(500).optional(),
})

export type EncomendaItemInput = z.infer<typeof encomendaItemSchema>

// ===================== CREATE =====================

export const createEncomendaSchema = z.object({
  unitId:          z.string({ required_error: 'ID da unidade e obrigatorio' }).uuid('ID invalido'),
  clienteNome:     z.string({ required_error: 'Nome do cliente e obrigatorio' }).min(2).max(200).trim(),
  clienteTelefone: z.string().max(20).optional(),
  dataRetirada:    z.coerce.date({ required_error: 'Data de retirada e obrigatoria' }),
  horaRetirada:    z.string({ required_error: 'Hora de retirada e obrigatoria' })
    .regex(/^\d{2}:\d{2}$/, 'Hora deve estar no formato HH:MM'),
  observacoes:     z.string().max(1000).optional(),
  valorCaucao:     z.coerce.number().min(0).optional().default(0),
  valorTotal:      z.coerce.number().min(0).optional().default(0),
  itens:           z.array(encomendaItemSchema).min(1, 'Adicione pelo menos 1 item'),
})

export type CreateEncomendaInput = z.infer<typeof createEncomendaSchema>

// ===================== UPDATE STATUS =====================

export const updateEncomendaStatusSchema = z.object({
  status: z.enum(['pendente', 'pronta', 'retirada', 'cancelada'], {
    required_error: 'Status e obrigatorio',
  }),
})

export type UpdateEncomendaStatusInput = z.infer<typeof updateEncomendaStatusSchema>

// ===================== PARAMS =====================

export const encomendaIdParamSchema = z.object({
  id: z.string().uuid('ID de encomenda invalido'),
})

export type EncomendaIdParam = z.infer<typeof encomendaIdParamSchema>
