import { z } from 'zod'

const tipoDesligamento = z.enum([
  'demissao_sem_justa_causa',
  'demissao_por_justa_causa',
  'pedido_demissao',
  'acordo_mutuo',
  'aposentadoria',
  'falecimento',
  'termino_contrato',
  'outro',
])

export const criarDesligamentoSchema = z.object({
  colaboradorId: z.string().uuid(),
  tipo: tipoDesligamento,
  dataAviso: z.string().datetime().optional(),
  dataDesligamento: z.string().datetime(),
  motivoDetalhado: z.string().optional(),
  entrevistaDeRetencao: z.boolean().default(false),
  observacoes: z.string().optional(),
  checklistItems: z.array(z.object({
    descricao: z.string(),
    concluido: z.boolean().default(false),
  })).optional(),
})

export const updateDesligamentoSchema = z.object({
  tipo: tipoDesligamento.optional(),
  dataAviso: z.string().datetime().optional().nullable(),
  dataDesligamento: z.string().datetime().optional(),
  motivoDetalhado: z.string().optional(),
  entrevistaDeRetencao: z.boolean().optional(),
  observacoes: z.string().optional(),
})

export const atualizarChecklistSchema = z.object({
  checklistItems: z.array(z.object({
    descricao: z.string(),
    concluido: z.boolean(),
    concluidoEm: z.string().optional(),
  })),
})

export const concluirDesligamentoSchema = z.object({
  observacoes: z.string().optional(),
})

export const desligamentoIdParamSchema = z.object({
  id: z.string().uuid(),
})

export const listDesligamentosQuerySchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  status: z.enum(['pendente', 'em_andamento', 'concluido', 'cancelado']).optional(),
  search: z.string().optional(),
})

export type CriarDesligamentoInput = z.infer<typeof criarDesligamentoSchema>
