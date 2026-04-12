import { z } from 'zod'

// Schema de listagem de produtos com filtros e paginacao
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  categoriaId: z.string().uuid('ID de categoria invalido').optional(),
  subcategoriaId: z.string().uuid('ID de subcategoria invalido').optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
  search: z.string().optional(),
  isEtiqueta: z.coerce.boolean().optional(),
  isUtensilio: z.coerce.boolean().optional(),
  controlaEstoque: z.coerce.boolean().optional(),
  enviaProducao: z.coerce.boolean().optional(),
  isInsumo: z.coerce.boolean().optional(),
  isBalanca: z.coerce.boolean().optional(),
  participaCotacao: z.coerce.boolean().optional(),
})

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>

// Schema de criacao de produto
export const createProductSchema = z.object({
  nome: z
    .string({ required_error: 'Nome e obrigatorio' })
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim(),
  sku: z
    .string()
    .max(50, 'SKU deve ter no maximo 50 caracteres')
    .trim()
    .optional()
    .nullable(),
  categoriaId: z.string().uuid('ID de categoria invalido').optional().nullable(),
  subcategoriaId: z.string().uuid('ID de subcategoria invalido').optional().nullable(),
  unidadeMedida: z
    .string()
    .min(1, 'Unidade de medida e obrigatoria')
    .max(10, 'Unidade de medida deve ter no maximo 10 caracteres')
    .optional()
    .default('un'),
  codigoSistema: z.string().max(100).trim().optional().nullable(),
  codigoCotacao: z.string().max(100).trim().optional().nullable(),
  codigoBarras: z.string().max(50).trim().optional().nullable(),
  isBalanca: z.boolean().optional().default(false),
  codigoBalanca: z.string().max(50).trim().optional().nullable(),
  isEtiqueta: z.boolean().optional().default(false),
  validadeDias: z.number().int().min(1, 'Validade deve ser pelo menos 1 dia').optional().nullable(),
  isUtensilio: z.boolean().optional().default(false),
  controlaEstoque: z.boolean().optional().default(true),
  enviaProducao: z.boolean().optional().default(false),
  isInsumo: z.boolean().optional().default(false),
  participaCotacao: z.boolean().optional().default(false),
  estoqueMinimo: z.number().min(0, 'Estoque minimo nao pode ser negativo').optional().default(0),
  custoMedio: z.number().min(0, 'Custo medio nao pode ser negativo').optional().default(0),
  status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
})

export type CreateProductInput = z.infer<typeof createProductSchema>

// Schema de edicao de produto
export const updateProductSchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim()
    .optional(),
  sku: z
    .string()
    .max(50, 'SKU deve ter no maximo 50 caracteres')
    .trim()
    .optional()
    .nullable(),
  categoriaId: z.string().uuid('ID de categoria invalido').optional().nullable(),
  subcategoriaId: z.string().uuid('ID de subcategoria invalido').optional().nullable(),
  unidadeMedida: z
    .string()
    .min(1, 'Unidade de medida e obrigatoria')
    .max(10, 'Unidade de medida deve ter no maximo 10 caracteres')
    .optional(),
  codigoSistema: z.string().max(100).trim().optional().nullable(),
  codigoCotacao: z.string().max(100).trim().optional().nullable(),
  codigoBarras: z.string().max(50).trim().optional().nullable(),
  isBalanca: z.boolean().optional(),
  codigoBalanca: z.string().max(50).trim().optional().nullable(),
  isEtiqueta: z.boolean().optional(),
  validadeDias: z.number().int().min(1, 'Validade deve ser pelo menos 1 dia').optional().nullable(),
  isUtensilio: z.boolean().optional(),
  controlaEstoque: z.boolean().optional(),
  enviaProducao: z.boolean().optional(),
  isInsumo: z.boolean().optional(),
  participaCotacao: z.boolean().optional(),
  estoqueMinimo: z.number().min(0, 'Estoque minimo nao pode ser negativo').optional(),
  custoMedio: z.number().min(0, 'Custo medio nao pode ser negativo').optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
})

export type UpdateProductInput = z.infer<typeof updateProductSchema>

// Schema de parametro ID do produto
export const productIdParamSchema = z.object({
  id: z.string().uuid('ID de produto invalido'),
})

export type ProductIdParam = z.infer<typeof productIdParamSchema>
