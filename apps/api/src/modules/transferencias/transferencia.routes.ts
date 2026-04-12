import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  createTransferenciaCountSchema,
  listTransferenciaCountsQuerySchema,
  idParamSchema,
  codigoBalancaParamSchema,
} from './transferencia.schemas'

export async function transferenciaRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  app.addHook('onRequest', requireUnit())

  // ============================================================
  // GET /units — Listar unidades ativas para selecao
  // ============================================================
  app.get('/units', async (request: FastifyRequest, reply: FastifyReply) => {
    const units = await prisma.unit.findMany({
      where: { status: 'ativo' },
      select: { id: true, nome: true, codigo: true },
      orderBy: { nome: 'asc' },
    })
    return reply.status(200).send({ data: units })
  })

  // ============================================================
  // GET /products/by-balanca/:codigo — Buscar produto por codigo de balanca
  // ============================================================
  app.get('/products/by-balanca/:codigo', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = codigoBalancaParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Codigo invalido', code: 'VALIDATION_ERROR' })
    }

    const product = await prisma.product.findFirst({
      where: { codigoBalanca: parsed.data.codigo, isBalanca: true, status: 'ativo' },
      select: { id: true, nome: true, sku: true, unidadeMedida: true, codigoBalanca: true },
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
  // GET / — Listar transferencias com filtros
  // ============================================================
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listTransferenciaCountsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, origemUnitId, destinoUnitId, dataInicio, dataFim } = parsed.data
    const { skip, take } = calcPagination(page, limit)
    const allowedUnitIds: string[] | null = (request as any).allowedUnitIds

    // Filtrar por unidades permitidas (origem OU destino)
    const where: any = {}

    if (allowedUnitIds !== null) {
      where.OR = [
        { origemUnitId: { in: allowedUnitIds } },
        { destinoUnitId: { in: allowedUnitIds } },
      ]
    }

    if (origemUnitId) where.origemUnitId = origemUnitId
    if (destinoUnitId) where.destinoUnitId = destinoUnitId

    if (dataInicio || dataFim) {
      where.createdAt = {}
      if (dataInicio) where.createdAt.gte = dataInicio
      if (dataFim) where.createdAt.lte = dataFim
    }

    const [records, total] = await Promise.all([
      prisma.transferenciaCount.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          responsavel: { select: { id: true, nome: true } },
          origemUnit: { select: { id: true, nome: true, codigo: true } },
          destinoUnit: { select: { id: true, nome: true, codigo: true } },
          items: {
            include: {
              product: { select: { id: true, nome: true, unidadeMedida: true } },
            },
          },
        },
      }),
      prisma.transferenciaCount.count({ where }),
    ])

    return reply.status(200).send({
      data: records,
      pagination: { page, limit, total, totalPages: calcTotalPages(total, limit) },
    })
  })

  // ============================================================
  // GET /:id — Detalhes
  // ============================================================
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })
    }

    const record = await prisma.transferenciaCount.findUnique({
      where: { id: parsed.data.id },
      include: {
        responsavel: { select: { id: true, nome: true } },
        origemUnit: { select: { id: true, nome: true, codigo: true } },
        destinoUnit: { select: { id: true, nome: true, codigo: true } },
        items: {
          include: {
            product: { select: { id: true, nome: true, unidadeMedida: true } },
          },
        },
      },
    })

    if (!record) {
      return reply.status(404).send({ error: 'Transferencia nao encontrada', code: 'NOT_FOUND' })
    }

    return reply.status(200).send(record)
  })

  // ============================================================
  // POST / — Criar nova transferencia
  // ============================================================
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createTransferenciaCountSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { origemUnitId, destinoUnitId, observacao, items } = parsed.data
    const user = request.user as any

    // Verificar que as unidades existem e estao ativas
    const [origem, destino] = await Promise.all([
      prisma.unit.findUnique({ where: { id: origemUnitId, status: 'ativo' }, select: { id: true } }),
      prisma.unit.findUnique({ where: { id: destinoUnitId, status: 'ativo' }, select: { id: true } }),
    ])

    if (!origem) {
      return reply.status(400).send({ error: 'Unidade de origem invalida', code: 'INVALID_UNIT' })
    }
    if (!destino) {
      return reply.status(400).send({ error: 'Unidade de destino invalida', code: 'INVALID_UNIT' })
    }

    // Verificar produtos
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: 'ativo' },
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

    const record = await prisma.$transaction(async (tx) => {
      return tx.transferenciaCount.create({
        data: {
          origemUnitId,
          destinoUnitId,
          responsavelId: user.userId,
          observacao: observacao || null,
          items: {
            create: items.map((item) => ({ productId: item.productId, peso: item.peso })),
          },
        },
        include: {
          responsavel: { select: { id: true, nome: true } },
          origemUnit: { select: { id: true, nome: true, codigo: true } },
          destinoUnit: { select: { id: true, nome: true, codigo: true } },
          items: {
            include: {
              product: { select: { id: true, nome: true, unidadeMedida: true } },
            },
          },
        },
      })
    })

    await createAuditLog(request, 'criar_transferencia', 'TransferenciaCount', record.id, {
      origemUnitId,
      destinoUnitId,
      totalItems: items.length,
      pesoTotal: items.reduce((acc, i) => acc + i.peso, 0),
    })

    return reply.status(201).send(record)
  })

  // ============================================================
  // DELETE /:id — Excluir
  // ============================================================
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.transferenciaCount.findUnique({ where: { id: parsed.data.id } })
    if (!existing) {
      return reply.status(404).send({ error: 'Transferencia nao encontrada', code: 'NOT_FOUND' })
    }

    await prisma.transferenciaCount.delete({ where: { id: parsed.data.id } })

    await createAuditLog(request, 'excluir_transferencia', 'TransferenciaCount', parsed.data.id, {
      origemUnitId: existing.origemUnitId,
      destinoUnitId: existing.destinoUnitId,
    })

    return reply.status(204).send()
  })
}
