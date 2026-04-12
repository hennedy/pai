import type { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate } from '../../middlewares/auth.middleware'
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notification.schemas'

/**
 * Modulo de notificacoes da API.
 * Registra rotas de listagem, marcacao de leitura e SSE em tempo real.
 */
export async function notificationRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticacao
  app.addHook('onRequest', authenticate)

  // =====================================================
  // GET / - Listar notificacoes do usuario logado
  // =====================================================
  app.get('/', async (request, reply) => {
    const user = request.user as any
    const query = listNotificationsQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)

    // Montar filtro
    const where: any = { userId: user.userId }

    // Filtro por status de leitura
    if (query.lida === 'true') {
      where.lida = true
    } else if (query.lida === 'false') {
      where.lida = false
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          unit: { select: { id: true, nome: true, codigo: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ])

    return reply.send({
      data: notifications,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
    })
  })

  // =====================================================
  // PATCH /:id/read - Marcar notificacao como lida
  // =====================================================
  app.patch('/:id/read', async (request, reply) => {
    const user = request.user as any
    const { id } = notificationIdParamSchema.parse(request.params)

    // Verificar se a notificacao pertence ao usuario
    const notification = await prisma.notification.findFirst({
      where: { id, userId: user.userId },
    })

    if (!notification) {
      return reply.status(404).send({
        error: 'Notificacao nao encontrada',
        code: 'NOTIFICATION_NOT_FOUND',
      })
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { lida: true },
    })

    return reply.send(updated)
  })

  // =====================================================
  // PATCH /read-all - Marcar todas as notificacoes como lidas
  // =====================================================
  app.patch('/read-all', async (request, reply) => {
    const user = request.user as any

    const result = await prisma.notification.updateMany({
      where: { userId: user.userId, lida: false },
      data: { lida: true },
    })

    return reply.send({
      message: 'Todas as notificacoes foram marcadas como lidas',
      count: result.count,
    })
  })

  // =====================================================
  // GET /stream - SSE para notificacoes em tempo real
  // =====================================================
  app.get('/stream', async (request, reply) => {
    const user = request.user as any

    // Configurar headers para Server-Sent Events
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    // Enviar evento de conexao estabelecida
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected', userId: user.userId })}\n\n`)

    // Polling a cada 5 segundos para novas notificacoes nao lidas
    let lastCheck = new Date()
    const interval = setInterval(async () => {
      try {
        const newNotifications = await prisma.notification.findMany({
          where: {
            userId: user.userId,
            lida: false,
            createdAt: { gt: lastCheck },
          },
          include: {
            unit: { select: { id: true, nome: true, codigo: true } },
          },
          orderBy: { createdAt: 'desc' },
        })

        if (newNotifications.length > 0) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'notifications', data: newNotifications })}\n\n`)
          lastCheck = new Date()
        }
      } catch {
        // Conexao pode ter sido encerrada, limpar intervalo
        clearInterval(interval)
      }
    }, 5000)

    // Limpar intervalo quando a conexao for fechada
    request.raw.on('close', () => {
      clearInterval(interval)
    })
  })
}
