import { z } from 'zod'

const datasExcecaoSchema = z
  .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data invalido (YYYY-MM-DD)'))
  .optional()
  .nullable()

// Schema para a configuracao de Recorrencia do Checklist
const recorrenciaSchema = z.object({
  tipo: z.enum(['diario', 'semanal', 'mensal', 'anual', 'data_especifica']),
  diasSemana: z.array(z.number().int().min(0).max(6)).optional(), // 0 = Domingo
  intervaloSemanas: z.number().int().min(1).max(52).optional().default(1), // A cada N semanas
  diasMes: z.array(z.number().int().min(1).max(31)).optional(), // 1 a 31
  mes: z.number().int().min(1).max(12).optional(), // 1 a 12
  dia: z.number().int().min(1).max(31).optional(), // Usado para anual
  datas: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data invalido (YYYY-MM-DD)')).optional(),
})

// Schema para item do checklist template
const checklistItemSchema = z.object({
  descricao: z
    .string({ required_error: 'Descricao do item e obrigatoria' })
    .min(1, 'Descricao do item e obrigatoria')
    .max(500, 'Descricao deve ter no maximo 500 caracteres'),
  ordem: z.coerce.number().int().nonnegative('Ordem deve ser >= 0'),
  tipo: z.enum(['checkbox', 'texto', 'foto', 'numero', 'estoque', 'estrelas']).optional().default('checkbox'),
  obrigatorio: z.boolean().optional().default(false),
  exigeFoto: z.boolean().optional().default(false),
  exigeObservacao: z.boolean().optional().default(false),
  isCritico: z.boolean().optional().default(false),
  condicaoAlerta: z.record(z.any()).nullable().optional(),
  peso: z.coerce.number().int().optional().default(1),
  opcoes: z.record(z.any()).nullable().optional(),
  rotulos: z.array(z.string().max(100)).max(10).optional().nullable(),
  responsavelId: z.string().uuid('ID do colaborador invalido').optional().nullable(),
})

// Schema para criar template de checklist
export const createChecklistTemplateSchema = z.object({
  nome: z
    .string({ required_error: 'Nome e obrigatorio' })
    .min(1, 'Nome e obrigatorio')
    .max(200, 'Nome deve ter no maximo 200 caracteres'),
  sectorId: z.string().uuid('ID do setor invalido').optional().nullable(),
  unitId: z.string().uuid('ID da unidade invalido').nullable().optional(),
  horario: z.enum(['manha', 'tarde', 'noite', 'abertura', 'fechamento'], {
    required_error: 'Horario e obrigatorio',
    invalid_type_error: 'Horario invalido',
  }),
  obrigatorio: z.boolean().optional().default(false),
  icone: z.string().max(100).optional().nullable(),
  tempoLimiteMinutos: z.coerce.number().int().positive().optional().nullable(),
  recorrencia: recorrenciaSchema.optional().nullable(),
  datasExcecao: datasExcecaoSchema,
  atribuidoAId: z.string().uuid('ID do usuario responsavel invalido').optional().nullable(),
  responsavelColabId: z.string().uuid('ID do colaborador invalido').optional().nullable(),
  items: z
    .array(checklistItemSchema, { required_error: 'Items sao obrigatorios' })
    .min(1, 'Template deve ter pelo menos 1 item'),
})

export type CreateChecklistTemplateInput = z.infer<typeof createChecklistTemplateSchema>

// Schema para editar template de checklist
export const updateChecklistTemplateSchema = z.object({
  nome: z.string().min(1).max(200, 'Nome deve ter no maximo 200 caracteres').optional(),
  sectorId: z.string().uuid('ID do setor invalido').optional().nullable(),
  unitId: z.string().uuid('ID da unidade invalido').nullable().optional(),
  horario: z.enum(['manha', 'tarde', 'noite', 'abertura', 'fechamento']).optional(),
  obrigatorio: z.boolean().optional(),
  icone: z.string().max(100).optional().nullable(),
  tempoLimiteMinutos: z.coerce.number().int().positive().optional().nullable(),
  recorrencia: recorrenciaSchema.optional().nullable(),
  datasExcecao: datasExcecaoSchema,
  atribuidoAId: z.string().uuid('ID do usuario responsavel invalido').optional().nullable(),
  responsavelColabId: z.string().uuid('ID do colaborador invalido').optional().nullable(),
  items: z.array(checklistItemSchema).min(1, 'Template deve ter pelo menos 1 item').optional(),
})

export type UpdateChecklistTemplateInput = z.infer<typeof updateChecklistTemplateSchema>

// Schema para iniciar execucao de checklist
export const createExecutionSchema = z.object({
  templateId: z.string().uuid('ID do template invalido'),
  unitId: z.string().uuid('ID da unidade invalido'),
  turno: z.enum(['manha', 'tarde', 'noite'], {
    required_error: 'Turno e obrigatorio',
    invalid_type_error: 'Turno invalido',
  }),
  atribuidoAId: z.string().uuid('ID do responsavel obrigatorio'),
  responsavelId: z.string().uuid('ID do colaborador invalido').optional().nullable(),
})

export type CreateExecutionInput = z.infer<typeof createExecutionSchema>

// Schema para resposta de item da execucao
const itemResponseSchema = z.object({
  itemId: z.string().uuid('ID do item invalido'),
  resposta: z.string().max(1000, 'Resposta deve ter no maximo 1000 caracteres').optional().nullable(),
  conformidade: z.string().max(100).optional().nullable(), // Rotulo de conformidade selecionado
  fotoUrl: z.string().url('URL da foto invalida').optional().nullable(),
  videoUrl: z.string().url('URL de video invalida').optional().nullable(),
  geolocation: z.record(z.any()).optional().nullable(),
  naoAplicavel: z.boolean().optional().default(false),
})

// Schema para salvar respostas da execucao
export const updateExecutionSchema = z.object({
  responses: z
    .array(itemResponseSchema, { required_error: 'Respostas sao obrigatorias' })
    .min(1, 'Deve ter pelo menos 1 resposta'),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  observacaoGeral: z.string().optional().nullable(),
})

export type UpdateExecutionInput = z.infer<typeof updateExecutionSchema>

// Schema para duplicar template para outra unidade
export const duplicateTemplateSchema = z.object({
  targetUnitId: z.string().uuid('ID da unidade destino invalido'),
  nome: z.string().min(1).max(200).optional(), // Opcional: novo nome para a copia
})

export type DuplicateTemplateInput = z.infer<typeof duplicateTemplateSchema>

// Schema para listar templates com paginacao e filtros
export const listTemplatesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sectorId: z.string().uuid().optional(),
  status: z.enum(['ativo', 'inativo', 'todos']).optional(),
  search: z.string().max(200).optional(),
})

export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>

// Schema para listar execucoes com filtros
export const listExecutionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  unitId: z.string().uuid('ID da unidade invalido').optional(),
  data: z.string().datetime({ message: 'Data invalida' }).optional(),
  status: z.enum(['pendente', 'concluido', 'atrasado']).optional(),
  templateId: z.string().uuid('ID do template invalido').optional(),
})

export type ListExecutionsQuery = z.infer<typeof listExecutionsQuerySchema>

// Schema para ranking de usuarios
export const rankingQuerySchema = z.object({
  unitId: z.string().uuid('ID da unidade invalido').optional(),
  periodo: z.coerce.number().int().positive().max(365).optional().default(30), // Dias
})

export type RankingQuery = z.infer<typeof rankingQuerySchema>

// Schema para params com id
export const idParamSchema = z.object({
  id: z.string().uuid('ID invalido'),
})

export type IdParam = z.infer<typeof idParamSchema>
