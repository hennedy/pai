import { z } from 'zod'

// ========== Category Schemas ==========

export const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  search: z.string().optional(),
})

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>

export const createCategorySchema = z.object({
  nome: z
    .string({ required_error: 'Nome e obrigatorio' })
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>

export const updateCategorySchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim()
    .optional(),
})

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>

export const categoryIdParamSchema = z.object({
  id: z.string().uuid('ID de categoria invalido'),
})

export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>

// ========== Subcategory Schemas ==========

export const createSubcategorySchema = z.object({
  nome: z
    .string({ required_error: 'Nome e obrigatorio' })
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim(),
})

export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>

export const updateSubcategorySchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim()
    .optional(),
})

export type UpdateSubcategoryInput = z.infer<typeof updateSubcategorySchema>

export const subcategoryIdParamSchema = z.object({
  id: z.string().uuid('ID de categoria invalido'),
  subcategoryId: z.string().uuid('ID de subcategoria invalido'),
})

export type SubcategoryIdParam = z.infer<typeof subcategoryIdParamSchema>
