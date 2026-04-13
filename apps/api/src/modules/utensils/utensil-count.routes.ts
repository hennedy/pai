import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  createUtensilCountSchema,
  listUtensilCountsQuerySchema,
  idParamSchema,
} from './utensil.schemas'

/**
 * Modulo de contagem de utensilios.
 * Registra rotas para contagem periodica e reposicao de utensilios.
 */
export async function utensilCountRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  app.addHook('onRequest', requireUnit())

  // ============================================================
  // GET /products — Listar produtos marcados como utensilio
  // ============================================================
  app.get('/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const products = await prisma.product.findMany({
      where: {
        isUtensilio: true,
        status: 'ativo',
      },
      select: {
        id: true,
        nome: true,
        sku: true,
        unidadeMedida: true,
      },
      orderBy: { nome: 'asc' },
    })

    return reply.status(200).send({ data: products })
  })

  // ============================================================
  // GET / — Listar contagens/reposicoes com filtros e paginacao
  // ============================================================
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listUtensilCountsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, tipo, turno, dataInicio, dataFim } = parsed.data
    const { skip, take } = calcPagination(page, limit)
    const unitFilter = getUnitFilter(request)

    const where: any = {
      ...unitFilter,
      ...(tipo ? { tipo } : {}),
      ...(turno ? { turno } : {}),
    }

    if (dataInicio || dataFim) {
      where.createdAt = {}
      if (dataInicio) where.createdAt.gte = dataInicio
      if (dataFim) where.createdAt.lte = dataFim
    }

    const [counts, total] = await Promise.all([
      prisma.utensilCount.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          responsavel: { select: { id: true, nome: true } },
          unit: { select: { id: true, codigo: true } },
          items: {
            include: {
              product: { select: { id: true, nome: true, unidadeMedida: true } },
            },
          },
        },
      }),
      prisma.utensilCount.count({ where }),
    ])

    return reply.status(200).send({
      data: counts,
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // GET /:id — Detalhes de uma contagem/reposicao
  // ============================================================
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data

    const count = await prisma.utensilCount.findUnique({
      where: { id },
      include: {
        responsavel: { select: { id: true, nome: true } },
        unit: { select: { id: true, codigo: true } },
        items: {
          include: {
            product: { select: { id: true, nome: true, unidadeMedida: true } },
          },
        },
      },
    })

    if (!count) {
      return reply.status(404).send({
        error: 'Contagem nao encontrada',
        code: 'COUNT_NOT_FOUND',
      })
    }

    return reply.status(200).send(count)
  })

  // ============================================================
  // POST / — Criar nova contagem ou reposicao
  // ============================================================
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createUtensilCountSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { turno, tipo, observacao, items } = parsed.data
    const user = request.user as any
    const unitFilter = getUnitFilter(request)

    // Validar que todos os produtos existem e sao utensilios
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isUtensilio: true,
        status: 'ativo',
      },
      select: { id: true },
    })

    const validIds = new Set(products.map((p) => p.id))
    const invalidIds = productIds.filter((id) => !validIds.has(id))
    if (invalidIds.length > 0) {
      return reply.status(400).send({
        error: 'Alguns produtos nao sao utensilios validos',
        code: 'INVALID_PRODUCTS',
        details: { invalidIds },
      })
    }

    // Criar contagem com items em transacao
    const count = await prisma.$transaction(async (tx) => {
      const created = await tx.utensilCount.create({
        data: {
          unitId: unitFilter.unitId as string,
          turno: turno as any,
          tipo: tipo as any,
          responsavelId: user.userId,
          observacao: observacao || null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantidade: item.quantidade,
            })),
          },
        },
        include: {
          responsavel: { select: { id: true, nome: true } },
          unit: { select: { id: true, codigo: true } },
          items: {
            include: {
              product: { select: { id: true, nome: true, unidadeMedida: true } },
            },
          },
        },
      })

      return created
    })

    await createAuditLog(
      request,
      tipo === 'contagem' ? 'contagem_utensilios' : 'reposicao_utensilios',
      'UtensilCount',
      count.id,
      { turno, tipo, totalItems: items.length }
    )

    return reply.status(201).send(count)
  })

  // ============================================================
  // DELETE /:id — Excluir uma contagem/reposicao
  // ============================================================
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data

    const existing = await prisma.utensilCount.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({
        error: 'Contagem nao encontrada',
        code: 'COUNT_NOT_FOUND',
      })
    }

    await prisma.utensilCount.delete({ where: { id } })

    await createAuditLog(request, 'excluir_contagem_utensilios', 'UtensilCount', id, {
      tipo: existing.tipo,
      turno: existing.turno,
    })

    return reply.status(204).send()
  })

  // ============================================================
  // GET /summary — Resumo comparativo da ultima contagem vs anterior
  // ============================================================
  app.get('/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    const unitFilter = getUnitFilter(request)

    // Buscar as ultimas 2 contagens da unidade
    const lastCounts = await prisma.utensilCount.findMany({
      where: {
        ...unitFilter,
        tipo: 'contagem',
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
      include: {
        items: {
          include: {
            product: { select: { id: true, nome: true } },
          },
        },
      },
    })

    // Resumo de reposicoes do ultimo mes
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const reposicoes = await prisma.utensilCount.findMany({
      where: {
        ...unitFilter,
        tipo: 'reposicao',
        createdAt: { gte: oneMonthAgo },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, nome: true } },
          },
        },
      },
    })

    // Agregar reposicoes por produto
    const reposicaoByProduct: Record<string, { nome: string; total: number }> = {}
    for (const rep of reposicoes) {
      for (const item of rep.items) {
        if (!reposicaoByProduct[item.productId]) {
          reposicaoByProduct[item.productId] = { nome: item.product.nome, total: 0 }
        }
        reposicaoByProduct[item.productId].total += item.quantidade
      }
    }

    return reply.status(200).send({
      ultimaContagem: lastCounts[0] || null,
      contagemAnterior: lastCounts[1] || null,
      reposicoesUltimoMes: Object.entries(reposicaoByProduct).map(([productId, data]) => ({
        productId,
        nome: data.nome,
        totalReposto: data.total,
      })),
    })
  })
}
