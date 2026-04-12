import { z } from 'zod'

// Schema de validacao para login — aceita email ou nome de usuario
export const loginInputSchema = z.object({
  identifier: z
    .string({ required_error: 'Email ou nome de usuario e obrigatorio' })
    .min(1, 'Email ou nome de usuario e obrigatorio')
    .transform((v) => v.toLowerCase().trim()),
  senha: z
    .string({ required_error: 'Senha e obrigatoria' })
    .min(1, 'Senha e obrigatoria'),
})

export type LoginInput = z.infer<typeof loginInputSchema>
