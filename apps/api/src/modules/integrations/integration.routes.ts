import type { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  listIntegrationsQuerySchema,
  createIntegrationSchema,
  changeIntegrationStatusSchema,
  integrationIdParamSchema,
  integrationLogParamSchema,
  listIntegrationLogsQuerySchema,
  webhookParamSchema,
} from './integration.schemas'

/**
 * Modulo de integracoes da API.
 * Registra rotas de CRUD, ativacao/desativacao, logs e webhooks.
 */
export async function integrationRoutes(app: FastifyInstance) {
  // =====================================================
  // POST /webhooks/:integrationId - Receber dados externos (webhook)
  // Rota publica (sem autenticacao), validada pelo integrationId
  // =====================================================
  app.post('/webhooks/:integrationId', async (request, reply) => {
    const { integrationId } = webhookParamSchema.parse(request.params)

    // Verificar se integracao existe e esta ativa
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
      select: { id: true, status: true, nome: true },
    })

    if (!integration) {
      return reply.status(404).send({
        error: 'Integracao nao encontrada',
        code: 'INTEGRATION_NOT_FOUND',
      })
    }

    if (integration.status !== 'ativo') {
      return reply.status(422).send({
        error: 'Integracao inativa',
        code: 'INTEGRATION_INACTIVE',
      })
    }

    // Registrar log de entrada do webhook
    try {
      await prisma.integrationLog.create({
        data: {
          integrationId,
          tipo: 'entrada',
          status: 'sucesso',
          payload: request.body as any,
        },
      })

      return reply.status(200).send({
        message: 'Webhook recebido com sucesso',
        integrationId,
      })
    } catch (err: any) {
      // Registrar falha no log
      await prisma.integrationLog.create({
        data: {
          integrationId,
          tipo: 'entrada',
          status: 'falha',
          payload: request.body as any,
          erro: err.message || 'Erro desconhecido',
        },
      })

      return reply.status(500).send({
        error: 'Erro ao processar webhook',
        code: 'WEBHOOK_PROCESSING_ERROR',
      })
    }
  })

  // Demais rotas exigem autenticacao e role de administracao
  app.register(async (authenticatedApp) => {
    authenticatedApp.addHook('onRequest', authenticate)

    // =====================================================
    // GET / - Listar integracoes
    // =====================================================
    authenticatedApp.get('/', {
      preHandler: [requireRole('gerente_geral', 'administrativo')],
    }, async (request, reply) => {
      const query = listIntegrationsQuerySchema.parse(request.query)
      const { skip, take, page, limit } = calcPagination(query.page, query.limit)

      const where: any = {}
      if (query.status) {
        where.status = query.status
      }

      const [data, total] = await Promise.all([
        prisma.integration.findMany({
          where,
          include: {
            _count: { select: { logs: true } },
          },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.integration.count({ where }),
      ])

      return reply.send({
        data,
        total,
        page,
        limit,
        totalPages: calcTotalPages(total, limit),
      })
    })

    // =====================================================
    // POST / - Criar nova integracao
    // =====================================================
    authenticatedApp.post('/', {
      preHandler: [requireRole('gerente_geral')],
    }, async (request, reply) => {
      const body = createIntegrationSchema.parse(request.body)

      const integration = await prisma.integration.create({
        data: {
          nome: body.nome,
          tipo: body.tipo,
          configuracao: body.configuracao || undefined,
        },
      })

      // Registrar log de auditoria
      await createAuditLog(request, 'criar_integracao', 'Integration', integration.id, {
        nome: body.nome,
        tipo: body.tipo,
      })

      return reply.status(201).send(integration)
    })

    // =====================================================
    // PATCH /:id/status - Ativar/desativar integracao
    // =====================================================
    authenticatedApp.patch('/:id/status', {
      preHandler: [requireRole('gerente_geral')],
    }, async (request, reply) => {
      const { id } = integrationIdParamSchema.parse(request.params)
      const body = changeIntegrationStatusSchema.parse(request.body)

      // Verificar se integracao existe
      const existing = await prisma.integration.findUnique({
        where: { id },
        select: { id: true, status: true },
      })

      if (!existing) {
        return reply.status(404).send({
          error: 'Integracao nao encontrada',
          code: 'INTEGRATION_NOT_FOUND',
        })
      }

      const updated = await prisma.integration.update({
        where: { id },
        data: { status: body.status },
      })

      // Registrar log de auditoria
      await createAuditLog(request, 'alterar_status_integracao', 'Integration', id, {
        statusAnterior: existing.status,
        statusNovo: body.status,
      })

      return reply.send(updated)
    })

    // =====================================================
    // GET /:id/logs - Listar logs de uma integracao
    // =====================================================
    authenticatedApp.get('/:id/logs', {
      preHandler: [requireRole('gerente_geral', 'administrativo')],
    }, async (request, reply) => {
      const { id } = integrationIdParamSchema.parse(request.params)
      const query = listIntegrationLogsQuerySchema.parse(request.query)
      const { skip, take, page, limit } = calcPagination(query.page, query.limit)

      // Verificar se integracao existe
      const existing = await prisma.integration.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!existing) {
        return reply.status(404).send({
          error: 'Integracao nao encontrada',
          code: 'INTEGRATION_NOT_FOUND',
        })
      }

      const where: any = { integrationId: id }
      if (query.status) {
        where.status = query.status
      }

      const [data, total] = await Promise.all([
        prisma.integrationLog.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.integrationLog.count({ where }),
      ])

      return reply.send({
        data,
        total,
        page,
        limit,
        totalPages: calcTotalPages(total, limit),
      })
    })

    // =====================================================
    // POST /:id/reprocess/:logId - Reprocessar log com falha
    // =====================================================
    authenticatedApp.post('/:id/reprocess/:logId', {
      preHandler: [requireRole('gerente_geral')],
    }, async (request, reply) => {
      const { id, logId } = integrationLogParamSchema.parse(request.params)

      // Buscar log original
      const log = await prisma.integrationLog.findFirst({
        where: { id: logId, integrationId: id },
      })

      if (!log) {
        return reply.status(404).send({
          error: 'Log nao encontrado',
          code: 'INTEGRATION_LOG_NOT_FOUND',
        })
      }

      if (log.status !== 'falha') {
        return reply.status(422).send({
          error: 'Somente logs com falha podem ser reprocessados',
          code: 'LOG_NOT_FAILED',
        })
      }

      // Criar novo log de reprocessamento
      try {
        const newLog = await prisma.integrationLog.create({
          data: {
            integrationId: id,
            tipo: log.tipo,
            status: 'sucesso',
            payload: log.payload || undefined,
          },
        })

        // Registrar log de auditoria
        await createAuditLog(request, 'reprocessar_integracao', 'IntegrationLog', newLog.id, {
          logOriginalId: logId,
          integrationId: id,
        })

        return reply.send({
          message: 'Log reprocessado com sucesso',
          log: newLog,
        })
      } catch (err: any) {
        // Registrar falha no reprocessamento
        const failedLog = await prisma.integrationLog.create({
          data: {
            integrationId: id,
            tipo: log.tipo,
            status: 'falha',
            payload: log.payload || undefined,
            erro: err.message || 'Erro no reprocessamento',
          },
        })

        return reply.status(500).send({
          error: 'Falha ao reprocessar log',
          code: 'REPROCESS_ERROR',
          log: failedLog,
        })
      }
    })
  })
}
