import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'

// Schema de listagem de logs de auditoria com filtros e paginacao
const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  userId: z.string().uuid('ID de usuario invalido').optional(),
  entidade: z.string().optional(),
  periodoInicio: z.coerce.date().optional(),
  periodoFim: z.coerce.date().optional(),
})

/**
 * Modulo de logs de auditoria da API.
 * Registra rota de listagem de logs com filtros.
 */
export async function auditLogRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticacao
  app.addHook('onRequest', authenticate)

  // =====================================================
  // GET / - Listar logs de auditoria com filtros e paginacao
  // =====================================================
  app.get('/', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const query = listAuditLogsQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)

    // Montar filtro dinamico
    const where: any = {}

    if (query.userId) {
      where.userId = query.userId
    }

    if (query.entidade) {
      where.entidade = { contains: query.entidade, mode: 'insensitive' }
    }

    // Filtro de periodo
    if (query.periodoInicio || query.periodoFim) {
      where.createdAt = {}
      if (query.periodoInicio) {
        where.createdAt.gte = query.periodoInicio
      }
      if (query.periodoFim) {
        where.createdAt.lte = query.periodoFim
      }
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, nome: true, email: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ])

    return reply.send({
      data,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
    })
  })
}
