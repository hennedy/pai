import type { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireRole, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  listOccurrencesQuerySchema,
  createOccurrenceSchema,
  updateOccurrenceSchema,
  changeOccurrenceStatusSchema,
  createOccurrenceCommentSchema,
  occurrenceIdParamSchema,
  occurrenceReportQuerySchema,
} from './occurrence.schemas'

/**
 * Modulo de ocorrencias da API.
 * Registra rotas de CRUD, alteracao de status, comentarios e relatorios.
 */
export async function occurrenceRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticacao
  app.addHook('onRequest', authenticate)

  // =====================================================
  // GET / - Listar ocorrencias com filtros e paginacao
  // =====================================================
  app.get('/', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const query = listOccurrencesQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)
    const unitFilter = getUnitFilter(request)

    // Montar filtro dinamico
    const where: any = { ...unitFilter }

    if (query.tipo) {
      where.tipo = query.tipo
    }

    if (query.prioridade) {
      where.prioridade = query.prioridade
    }

    if (query.status) {
      where.status = query.status
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

    const [occurrences, total] = await Promise.all([
      prisma.occurrence.findMany({
        where,
        include: {
          unit: { select: { id: true, nome: true, codigo: true } },
          criadoPor: { select: { id: true, nome: true } },
          responsavel: { select: { id: true, nome: true } },
          _count: { select: { comments: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.occurrence.count({ where }),
    ])

    return reply.send({
      data: occurrences,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
    })
  })

  // =====================================================
  // POST / - Criar nova ocorrencia
  // =====================================================
  app.post('/', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const body = createOccurrenceSchema.parse(request.body)
    const user = request.user as any

    const occurrence = await prisma.occurrence.create({
      data: {
        unitId: body.unitId,
        titulo: body.titulo,
        descricao: body.descricao,
        tipo: body.tipo,
        setor: body.setor,
        prioridade: body.prioridade,
        responsavelId: body.responsavelId,
        criadoPorId: user.userId,
      },
      include: {
        unit: { select: { id: true, nome: true, codigo: true } },
        criadoPor: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    })

    // Registrar log de auditoria
    await createAuditLog(request, 'criar_ocorrencia', 'Occurrence', occurrence.id, {
      titulo: body.titulo,
      tipo: body.tipo,
      prioridade: body.prioridade,
    })

    return reply.status(201).send(occurrence)
  })

  // =====================================================
  // GET /report - Relatorio de recorrencia por tipo/setor/periodo
  // =====================================================
  app.get('/report', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const query = occurrenceReportQuerySchema.parse(request.query)
    const unitFilter = getUnitFilter(request)

    // Montar filtro base
    const where: any = { ...unitFilter }

    if (query.periodoInicio || query.periodoFim) {
      where.createdAt = {}
      if (query.periodoInicio) {
        where.createdAt.gte = query.periodoInicio
      }
      if (query.periodoFim) {
        where.createdAt.lte = query.periodoFim
      }
    }

    // Agrupar conforme parametro
    if (query.agruparPor === 'tipo') {
      const result = await prisma.occurrence.groupBy({
        by: ['tipo'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      })

      return reply.send({
        agrupadoPor: 'tipo',
        data: result.map((r) => ({
          label: r.tipo,
          total: r._count.id,
        })),
      })
    }

    if (query.agruparPor === 'setor') {
      const result = await prisma.occurrence.groupBy({
        by: ['setor'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      })

      return reply.send({
        agrupadoPor: 'setor',
        data: result.map((r) => ({
          label: r.setor || 'Sem setor',
          total: r._count.id,
        })),
      })
    }

    // Agrupamento por periodo (mensal)
    const occurrences = await prisma.occurrence.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    // Agrupar por mes
    const grouped: Record<string, number> = {}
    for (const occ of occurrences) {
      const key = `${occ.createdAt.getFullYear()}-${String(occ.createdAt.getMonth() + 1).padStart(2, '0')}`
      grouped[key] = (grouped[key] || 0) + 1
    }

    return reply.send({
      agrupadoPor: 'periodo',
      data: Object.entries(grouped).map(([label, total]) => ({
        label,
        total,
      })),
    })
  })

  // =====================================================
  // GET /:id - Detalhe da ocorrencia com historico e comentarios
  // =====================================================
  app.get('/:id', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const { id } = occurrenceIdParamSchema.parse(request.params)

    const occurrence = await prisma.occurrence.findUnique({
      where: { id },
      include: {
        unit: { select: { id: true, nome: true, codigo: true } },
        criadoPor: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
        comments: {
          include: {
            user: { select: { id: true, nome: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        history: {
          include: {
            user: { select: { id: true, nome: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!occurrence) {
      return reply.status(404).send({
        error: 'Ocorrencia nao encontrada',
        code: 'OCCURRENCE_NOT_FOUND',
      })
    }

    return reply.send(occurrence)
  })

  // =====================================================
  // PUT /:id - Editar ocorrencia
  // =====================================================
  app.put('/:id', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const { id } = occurrenceIdParamSchema.parse(request.params)
    const body = updateOccurrenceSchema.parse(request.body)

    // Verificar se ocorrencia existe
    const existing = await prisma.occurrence.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      return reply.status(404).send({
        error: 'Ocorrencia nao encontrada',
        code: 'OCCURRENCE_NOT_FOUND',
      })
    }

    const updated = await prisma.occurrence.update({
      where: { id },
      data: body,
      include: {
        unit: { select: { id: true, nome: true, codigo: true } },
        criadoPor: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    })

    // Registrar log de auditoria
    await createAuditLog(request, 'editar_ocorrencia', 'Occurrence', id, {
      campos_alterados: Object.keys(body).filter((k) => (body as any)[k] !== undefined),
    })

    return reply.send(updated)
  })

  // =====================================================
  // PATCH /:id/status - Alterar status da ocorrencia
  // =====================================================
  app.patch('/:id/status', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const { id } = occurrenceIdParamSchema.parse(request.params)
    const body = changeOccurrenceStatusSchema.parse(request.body)
    const user = request.user as any

    // Buscar ocorrencia atual para registrar historico
    const existing = await prisma.occurrence.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!existing) {
      return reply.status(404).send({
        error: 'Ocorrencia nao encontrada',
        code: 'OCCURRENCE_NOT_FOUND',
      })
    }

    // Atualizar status e criar historico em transacao
    const [updated] = await prisma.$transaction([
      prisma.occurrence.update({
        where: { id },
        data: {
          status: body.status,
          resolvidoAt: body.status === 'resolvida' ? new Date() : undefined,
        },
        include: {
          unit: { select: { id: true, nome: true, codigo: true } },
          criadoPor: { select: { id: true, nome: true } },
          responsavel: { select: { id: true, nome: true } },
        },
      }),
      prisma.occurrenceHistory.create({
        data: {
          occurrenceId: id,
          userId: user.userId,
          statusDe: existing.status,
          statusPara: body.status,
          observacao: body.observacao,
        },
      }),
    ])

    // Registrar log de auditoria
    await createAuditLog(request, 'alterar_status_ocorrencia', 'Occurrence', id, {
      statusAnterior: existing.status,
      statusNovo: body.status,
    })

    return reply.send(updated)
  })

  // =====================================================
  // POST /:id/comments - Adicionar comentario a ocorrencia
  // =====================================================
  app.post('/:id/comments', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const { id } = occurrenceIdParamSchema.parse(request.params)
    const body = createOccurrenceCommentSchema.parse(request.body)
    const user = request.user as any

    // Verificar se ocorrencia existe
    const existing = await prisma.occurrence.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      return reply.status(404).send({
        error: 'Ocorrencia nao encontrada',
        code: 'OCCURRENCE_NOT_FOUND',
      })
    }

    const comment = await prisma.occurrenceComment.create({
      data: {
        occurrenceId: id,
        userId: user.userId,
        texto: body.texto,
      },
      include: {
        user: { select: { id: true, nome: true } },
      },
    })

    // Registrar log de auditoria
    await createAuditLog(request, 'comentar_ocorrencia', 'OccurrenceComment', comment.id, {
      occurrenceId: id,
    })

    return reply.status(201).send(comment)
  })
}
