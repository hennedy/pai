import { z } from 'zod'

// ===================== Schemas de Entrada de Estoque =====================

// Schema para entrada de estoque
export const stockEntrySchema = z.object({
  productId: z.string().uuid('ID de produto invalido'),
  unitId: z.string().uuid('ID de unidade invalido'),
  quantidade: z.number().positive('Quantidade deve ser maior que zero'),
  lote: z.string().max(100, 'Lote deve ter no maximo 100 caracteres').optional().nullable(),
  vencimento: z.string().datetime('Data de vencimento invalida').optional().nullable(),
})

export type StockEntryInput = z.infer<typeof stockEntrySchema>

// Schema para saida de estoque
export const stockExitSchema = z.object({
  productId: z.string().uuid('ID de produto invalido'),
  unitId: z.string().uuid('ID de unidade invalido'),
  quantidade: z.number().positive('Quantidade deve ser maior que zero'),
  motivo: z.string().max(500, 'Motivo deve ter no maximo 500 caracteres').optional().nullable(),
})

export type StockExitInput = z.infer<typeof stockExitSchema>

// Schema para ajuste de estoque (motivo obrigatorio para auditoria)
export const stockAdjustmentSchema = z.object({
  productId: z.string().uuid('ID de produto invalido'),
  unitId: z.string().uuid('ID de unidade invalido'),
  quantidade: z.number({ required_error: 'Quantidade e obrigatoria' }),
  motivo: z
    .string({ required_error: 'Motivo e obrigatorio para ajustes' })
    .min(5, 'Motivo deve ter pelo menos 5 caracteres')
    .max(500, 'Motivo deve ter no maximo 500 caracteres'),
})

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>

// Schema para registro de perda (tipo de perda obrigatorio)
export const stockLossSchema = z.object({
  productId: z.string().uuid('ID de produto invalido'),
  unitId: z.string().uuid('ID de unidade invalido'),
  quantidade: z.number().positive('Quantidade deve ser maior que zero'),
  lossType: z.enum(['quebra', 'vencimento', 'erro_operacional', 'roubo', 'outro'], {
    required_error: 'Tipo de perda e obrigatorio',
    invalid_type_error: 'Tipo de perda invalido',
  }),
  motivo: z.string().max(500, 'Motivo deve ter no maximo 500 caracteres').optional().nullable(),
})

export type StockLossInput = z.infer<typeof stockLossSchema>

// ===================== Schemas de Consulta =====================

// Schema para consultar saldo de estoque
export const stockBalanceQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  unitId: z.string().uuid('ID de unidade invalido').optional(),
  productId: z.string().uuid('ID de produto invalido').optional(),
  categoriaId: z.string().uuid('ID de categoria invalido').optional(),
  search: z.string().optional(),
})

export type StockBalanceQuery = z.infer<typeof stockBalanceQuerySchema>

// Schema para consultar movimentacoes
export const stockMovementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  unitId: z.string().uuid('ID de unidade invalido').optional(),
  productId: z.string().uuid('ID de produto invalido').optional(),
  tipo: z.enum(['entrada', 'saida', 'ajuste', 'perda']).optional(),
  dataInicio: z.string().datetime('Data inicio invalida').optional(),
  dataFim: z.string().datetime('Data fim invalida').optional(),
})

export type StockMovementsQuery = z.infer<typeof stockMovementsQuerySchema>

// ===================== Schema de Inventario =====================

// Item individual do inventario fisico
const inventoryItemSchema = z.object({
  productId: z.string().uuid('ID de produto invalido'),
  contagem: z.number().min(0, 'Contagem nao pode ser negativa'),
})

// Schema para inventario fisico
export const physicalInventorySchema = z.object({
  unitId: z.string().uuid('ID de unidade invalido'),
  itens: z
    .array(inventoryItemSchema)
    .min(1, 'Inventario deve conter pelo menos um item'),
  motivo: z
    .string({ required_error: 'Motivo e obrigatorio para inventario' })
    .min(5, 'Motivo deve ter pelo menos 5 caracteres')
    .max(500, 'Motivo deve ter no maximo 500 caracteres'),
})

export type PhysicalInventoryInput = z.infer<typeof physicalInventorySchema>

// ===================== Schema de Alertas =====================

// Schema para consultar alertas de estoque minimo
export const stockAlertsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  unitId: z.string().uuid('ID de unidade invalido').optional(),
})

export type StockAlertsQuery = z.infer<typeof stockAlertsQuerySchema>
