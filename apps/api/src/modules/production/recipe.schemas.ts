import { z } from 'zod'

// Schema de ingrediente para criacao/edicao de receita
const recipeIngredientSchema = z.object({
  productId: z
    .string({ required_error: 'Produto e obrigatorio' })
    .uuid('ID do produto invalido'),
  quantidade: z
    .number({ required_error: 'Quantidade e obrigatoria' })
    .positive('Quantidade deve ser maior que zero'),
  unidadeMedida: z
    .string({ required_error: 'Unidade de medida e obrigatoria' })
    .min(1, 'Unidade de medida e obrigatoria')
    .max(20, 'Unidade de medida deve ter no maximo 20 caracteres'),
  observacao: z.string().max(500, 'Observacao deve ter no maximo 500 caracteres').optional(),
})

// Schema de criacao de receita
export const createRecipeSchema = z.object({
  nome: z
    .string({ required_error: 'Nome e obrigatorio' })
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim(),
  categoria: z
    .string()
    .max(100, 'Categoria deve ter no maximo 100 caracteres')
    .optional(),
  rendimento: z
    .number({ required_error: 'Rendimento e obrigatorio' })
    .positive('Rendimento deve ser maior que zero'),
  unidadeMedida: z
    .string({ required_error: 'Unidade de medida e obrigatoria' })
    .min(1, 'Unidade de medida e obrigatoria')
    .max(20, 'Unidade de medida deve ter no maximo 20 caracteres'),
  ingredients: z
    .array(recipeIngredientSchema)
    .min(1, 'Receita deve ter pelo menos um ingrediente'),
})

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>

// Schema de edicao de receita
export const updateRecipeSchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim()
    .optional(),
  categoria: z
    .string()
    .max(100, 'Categoria deve ter no maximo 100 caracteres')
    .optional(),
  rendimento: z
    .number()
    .positive('Rendimento deve ser maior que zero')
    .optional(),
  unidadeMedida: z
    .string()
    .min(1, 'Unidade de medida e obrigatoria')
    .max(20, 'Unidade de medida deve ter no maximo 20 caracteres')
    .optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
  ingredients: z
    .array(recipeIngredientSchema)
    .min(1, 'Receita deve ter pelo menos um ingrediente')
    .optional(),
})

export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>

// Schema de listagem de receitas com filtros e paginacao
export const listRecipesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  categoria: z.string().optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
  search: z.string().optional(),
})

export type ListRecipesQuery = z.infer<typeof listRecipesQuerySchema>

// Schema de parametro ID
export const recipeIdParamSchema = z.object({
  id: z.string().uuid('ID da receita invalido'),
})

export type RecipeIdParam = z.infer<typeof recipeIdParamSchema>
