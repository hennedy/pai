import { z } from 'zod'

// Schema de listagem de usuarios com filtros e paginacao
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  unitId: z.string().uuid('ID de unidade invalido').optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
  role: z.string().optional(),
  search: z.string().optional(),
  cpf: z.string().optional(),
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

// Schema de criacao de usuario
export const createUserSchema = z.object({
  nome: z
    .string({ required_error: 'Nome e obrigatorio' })
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim(),
  email: z
    .string({ required_error: 'Email e obrigatorio' })
    .email('Formato de email invalido')
    .transform((v) => v.toLowerCase().trim()),
  username: z
    .string()
    .min(3, 'Nome de usuario deve ter pelo menos 3 caracteres')
    .max(30, 'Nome de usuario deve ter no maximo 30 caracteres')
    .regex(/^[a-z0-9_.-]+$/, 'Nome de usuario so pode conter letras minusculas, numeros, _, . e -')
    .transform((v) => v.toLowerCase().trim())
    .optional(),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF deve ter 11 digitos numericos')
    .optional(),
  senha: z
    .string({ required_error: 'Senha e obrigatoria' })
    .min(6, 'Senha deve ter pelo menos 6 caracteres')
    .max(128, 'Senha deve ter no maximo 128 caracteres'),
  // Vinculos com unidades e roles
  unitRoles: z
    .array(
      z.object({
        unitId: z.string().uuid('ID de unidade invalido'),
        roleId: z.string().uuid('ID de role invalido'),
      })
    )
    .min(1, 'Usuario deve ter pelo menos um vinculo com unidade'),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

// Schema de edicao de usuario
export const updateUserSchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(255, 'Nome deve ter no maximo 255 caracteres')
    .trim()
    .optional(),
  email: z
    .string()
    .email('Formato de email invalido')
    .transform((v) => v.toLowerCase().trim())
    .optional(),
  username: z
    .string()
    .min(3, 'Nome de usuario deve ter pelo menos 3 caracteres')
    .max(30, 'Nome de usuario deve ter no maximo 30 caracteres')
    .regex(/^[a-z0-9_.-]+$/, 'Nome de usuario so pode conter letras minusculas, numeros, _, . e -')
    .transform((v) => v.toLowerCase().trim())
    .nullable()
    .optional(),
  cpf: z
    .string()
    .regex(/^\d{11}$/, 'CPF deve ter 11 digitos numericos')
    .nullable()
    .optional(),
  // Vinculos com unidades e roles (substituicao total)
  unitRoles: z
    .array(
      z.object({
        unitId: z.string().uuid('ID de unidade invalido'),
        roleId: z.string().uuid('ID de role invalido'),
      })
    )
    .min(1, 'Usuario deve ter pelo menos um vinculo com unidade')
    .optional(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>

// Schema de alteracao de status
export const updateUserStatusSchema = z.object({
  status: z.enum(['ativo', 'inativo'], {
    required_error: 'Status e obrigatorio',
    invalid_type_error: 'Status deve ser "ativo" ou "inativo"',
  }),
})

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>

// Schema de alteracao de senha
export const changePasswordSchema = z.object({
  senhaAtual: z
    .string({ required_error: 'Senha atual e obrigatoria' })
    .min(1, 'Senha atual e obrigatoria'),
  novaSenha: z
    .string({ required_error: 'Nova senha e obrigatoria' })
    .min(6, 'Nova senha deve ter pelo menos 6 caracteres')
    .max(128, 'Nova senha deve ter no maximo 128 caracteres'),
})

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

// Schema de parametro ID
export const userIdParamSchema = z.object({
  id: z.string().uuid('ID de usuario invalido'),
})

export type UserIdParam = z.infer<typeof userIdParamSchema>
