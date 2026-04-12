import { z } from 'zod'

// Schema de listagem de notificacoes com filtros e paginacao
export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  lida: z.enum(['true', 'false']).optional(),
})

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>

// Schema de parametro ID
export const notificationIdParamSchema = z.object({
  id: z.string().uuid('ID de notificacao invalido'),
})

export type NotificationIdParam = z.infer<typeof notificationIdParamSchema>
