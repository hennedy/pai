import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  createTelaContagemSchema,
  listTelaContagensQuerySchema,
  telaIdParamSchema,
} from './tela.schemas'

/**
 * Modulo de contagem de telas de pao frances.
 * Registra a quantidade de telas cruas e assadas para monitorar sobras.
 */
export async function telaRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  app.addHook('onRequest', requireUnit())

  // ============================================================
  // GET / — Listar contagens com filtros e paginacao
  // ============================================================
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listTelaContagensQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, dataInicio, dataFim } = parsed.data
    const { skip, take } = calcPagination(page, limit)
    const unitFilter = getUnitFilter(request)

    const where: any = { ...unitFilter }

    if (dataInicio || dataFim) {
      where.createdAt = {}
      if (dataInicio) where.createdAt.gte = dataInicio
      if (dataFim) where.createdAt.lte = dataFim
    }

    const [contagens, total] = await Promise.all([
      prisma.telaContagem.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          responsavel: { select: { id: true, nome: true } },
          unit: { select: { id: true, codigo: true } },
        },
      }),
      prisma.telaContagem.count({ where }),
    ])

    return reply.status(200).send({
      data: contagens,
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // GET /summary — Ultima contagem e totais do dia anterior
  // ============================================================
  app.get('/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    const unitFilter = getUnitFilter(request)

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const ontem = new Date(hoje)
    ontem.setDate(ontem.getDate() - 1)

    const [ultimaContagem, contagensOntem] = await Promise.all([
      prisma.telaContagem.findFirst({
        where: unitFilter,
        orderBy: { createdAt: 'desc' },
        include: { responsavel: { select: { id: true, nome: true } } },
      }),
      prisma.telaContagem.findMany({
        where: {
          ...unitFilter,
          createdAt: { gte: ontem, lt: hoje },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const totalCruasOntem = contagensOntem.reduce((acc, c) => acc + c.telasCruas, 0)
    const totalAssadasOntem = contagensOntem.reduce((acc, c) => acc + c.telasAssadas, 0)

    return reply.status(200).send({
      ultimaContagem,
      contagensOntem: contagensOntem.length,
      totalCruasOntem,
      totalAssadasOntem,
    })
  })

  // ============================================================
  // POST / — Registrar nova contagem
  // ============================================================
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createTelaContagemSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { telasCruas, telasAssadas, vendidosTodos, horaFim, observacao } = parsed.data
    const user = request.user as any
    const unitFilter = getUnitFilter(request)

    const contagem = await prisma.telaContagem.create({
      data: {
        unitId: unitFilter.unitId as string,
        responsavelId: user.userId,
        telasCruas,
        telasAssadas,
        vendidosTodos: vendidosTodos ?? false,
        horaFim: vendidosTodos && horaFim ? horaFim : null,
        observacao: observacao || null,
      },
      include: {
        responsavel: { select: { id: true, nome: true } },
        unit: { select: { id: true, codigo: true } },
      },
    })

    await createAuditLog(request, 'contagem_telas', 'TelaContagem', contagem.id, {
      telasCruas,
      telasAssadas,
    })

    return reply.status(201).send(contagem)
  })

  // ============================================================
  // DELETE /:id — Excluir uma contagem
  // ============================================================
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = telaIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data

    const existing = await prisma.telaContagem.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({
        error: 'Contagem nao encontrada',
        code: 'NOT_FOUND',
      })
    }

    await prisma.telaContagem.delete({ where: { id } })

    await createAuditLog(request, 'excluir_contagem_telas', 'TelaContagem', id, {
      telasCruas: existing.telasCruas,
      telasAssadas: existing.telasAssadas,
    })

    return reply.status(204).send()
  })
}
