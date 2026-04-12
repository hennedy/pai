import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  createDescartesCountSchema,
  listDescartesCountsQuerySchema,
  idParamSchema,
  codigoBalancaParamSchema,
} from './descarte.schemas'

/**
 * Modulo de contagem de descartes.
 * Itens sao adicionados via leitura de codigo de balanca (EAN-13 prefixo 2).
 * Formato: 2 PPPPP WWWWW C
 *   P = codigoBalanca do produto (5 digitos)
 *   W = peso em gramas (5 digitos)
 *   C = digito verificador
 */
export async function descartesRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  app.addHook('onRequest', requireUnit())

  // ============================================================
  // GET /products/by-balanca/:codigo — Buscar produto pelo codigo de balanca
  // ============================================================
  app.get('/products/by-balanca/:codigo', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = codigoBalancaParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'Codigo invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const { codigo } = paramsParsed.data

    const product = await prisma.product.findFirst({
      where: {
        codigoBalanca: codigo,
        isBalanca: true,
        status: 'ativo',
      },
      select: {
        id: true,
        nome: true,
        sku: true,
        unidadeMedida: true,
        codigoBalanca: true,
      },
    })

    if (!product) {
      return reply.status(404).send({
        error: 'Produto nao encontrado para este codigo de balanca',
        code: 'PRODUCT_NOT_FOUND',
      })
    }

    return reply.status(200).send(product)
  })

  // ============================================================
  // GET / — Listar contagens com filtros e paginacao
  // ============================================================
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listDescartesCountsQuerySchema.safeParse(request.query)
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

    const [counts, total] = await Promise.all([
      prisma.descartesCount.findMany({
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
      prisma.descartesCount.count({ where }),
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
  // GET /:id — Detalhes de uma contagem
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

    const count = await prisma.descartesCount.findUnique({
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
  // POST / — Criar nova contagem de descartes
  // ============================================================
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createDescartesCountSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { observacao, items } = parsed.data
    const user = request.user as any
    const unitFilter = getUnitFilter(request)

    // Validar que todos os produtos existem e sao produtos de balanca
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: 'ativo',
      },
      select: { id: true },
    })

    const validIds = new Set(products.map((p) => p.id))
    const invalidIds = productIds.filter((id) => !validIds.has(id))
    if (invalidIds.length > 0) {
      return reply.status(400).send({
        error: 'Alguns produtos nao foram encontrados ou estao inativos',
        code: 'INVALID_PRODUCTS',
        details: { invalidIds },
      })
    }

    const count = await prisma.$transaction(async (tx) => {
      const created = await tx.descartesCount.create({
        data: {
          unitId: unitFilter.unitId,
          responsavelId: user.userId,
          observacao: observacao || null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              peso: item.peso,
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

    await createAuditLog(request, 'criar_contagem_descartes', 'DescartesCount', count.id, {
      totalItems: items.length,
      pesoTotal: items.reduce((acc, i) => acc + i.peso, 0),
    })

    return reply.status(201).send(count)
  })

  // ============================================================
  // DELETE /:id — Excluir uma contagem
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

    const existing = await prisma.descartesCount.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({
        error: 'Contagem nao encontrada',
        code: 'COUNT_NOT_FOUND',
      })
    }

    await prisma.descartesCount.delete({ where: { id } })

    await createAuditLog(request, 'excluir_contagem_descartes', 'DescartesCount', id, {})

    return reply.status(204).send()
  })
}
