import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireUnit, getUnitFilter, requirePermission } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  createProductionOrderSchema,
  completeProductionOrderSchema,
  listProductionOrdersQuerySchema,
  productionReportQuerySchema,
  productionOrderIdParamSchema,
} from './production.schemas'

/**
 * Modulo de ordens de producao da API.
 * Registra rotas de criacao, controle de status e relatorios.
 */
export async function productionRoutes(app: FastifyInstance) {
  // Aplicar autenticacao e controle de unidade em todas as rotas
  app.addHook('onRequest', authenticate)
  app.addHook('onRequest', requireUnit())

  // ============================================================
  // GET / — Listar ordens de producao com filtros e paginacao
  // ============================================================
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar query params
    const parsed = listProductionOrdersQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, unitId, turno, status, dataInicio, dataFim } = parsed.data
    const { skip, take } = calcPagination(page, limit)

    // Montar filtros dinamicos com isolamento de unidade
    const unitFilter = getUnitFilter(request)
    const where: Record<string, unknown> = { ...unitFilter }

    if (unitId) {
      where.unitId = unitId
    }

    if (turno) {
      where.turno = turno
    }

    if (status) {
      where.status = status
    }

    // Filtro de periodo (createdAt)
    if (dataInicio || dataFim) {
      const createdAtFilter: Record<string, unknown> = {}
      if (dataInicio) createdAtFilter.gte = new Date(dataInicio)
      if (dataFim) createdAtFilter.lte = new Date(dataFim)
      where.createdAt = createdAtFilter
    }

    // Buscar ordens e total em paralelo
    const [orders, total] = await Promise.all([
      prisma.productionOrder.findMany({
        where,
        include: {
          unit: { select: { id: true, nome: true, codigo: true } },
          recipe: { select: { id: true, nome: true, versao: true } },
          responsavel: { select: { id: true, nome: true } },
          ingredients: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.productionOrder.count({ where }),
    ])

    return reply.status(200).send({
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // GET /report — Relatorio planejado vs realizado por unidade/turno/periodo
  // ============================================================
  app.get('/report', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar query params
    const parsed = productionReportQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, unitId, turno, dataInicio, dataFim } = parsed.data
    const { skip, take } = calcPagination(page, limit)

    // Montar filtros com isolamento de unidade
    const unitFilter = getUnitFilter(request)
    const where: Record<string, unknown> = {
      ...unitFilter,
      // Apenas ordens concluidas para o relatorio
      status: 'concluida',
    }

    if (unitId) {
      where.unitId = unitId
    }

    if (turno) {
      where.turno = turno
    }

    // Filtro de periodo
    if (dataInicio || dataFim) {
      const createdAtFilter: Record<string, unknown> = {}
      if (dataInicio) createdAtFilter.gte = new Date(dataInicio)
      if (dataFim) createdAtFilter.lte = new Date(dataFim)
      where.createdAt = createdAtFilter
    }

    // Buscar ordens concluidas com dados para relatorio
    const [orders, total] = await Promise.all([
      prisma.productionOrder.findMany({
        where,
        include: {
          unit: { select: { id: true, nome: true, codigo: true } },
          recipe: { select: { id: true, nome: true } },
          responsavel: { select: { id: true, nome: true } },
        },
        orderBy: { concluidoAt: 'desc' },
        skip,
        take,
      }),
      prisma.productionOrder.count({ where }),
    ])

    // Montar relatorio com planejado vs realizado
    const report = orders.map((order) => ({
      id: order.id,
      unit: order.unit,
      recipe: order.recipe,
      turno: order.turno,
      responsavel: order.responsavel,
      quantidadePlanejada: order.quantidadePlanejada,
      quantidadeRealizada: order.quantidadeRealizada,
      diferenca: (order.quantidadeRealizada || 0) - order.quantidadePlanejada,
      percentualAtingido:
        order.quantidadePlanejada > 0
          ? Math.round(((order.quantidadeRealizada || 0) / order.quantidadePlanejada) * 10000) / 100
          : 0,
      iniciadoAt: order.iniciadoAt,
      concluidoAt: order.concluidoAt,
    }))

    return reply.status(200).send({
      data: report,
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // POST / — Criar ordem de producao com snapshot dos ingredientes
  // ============================================================
  app.post('/', { preHandler: [requirePermission('producao', 'criar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar corpo da requisicao
    const parsed = createProductionOrderSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { unitId, recipeId, turno, quantidadePlanejada } = parsed.data
    const user = request.user as any

    // Verificar se a receita existe e esta ativa
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: { ingredients: true },
    })

    if (!recipe) {
      return reply.status(404).send({
        error: 'Receita nao encontrada',
        code: 'NOT_FOUND',
      })
    }

    if (recipe.status !== 'ativo') {
      return reply.status(400).send({
        error: 'Receita inativa nao pode ser utilizada',
        code: 'RECIPE_INACTIVE',
      })
    }

    // Verificar se a unidade existe
    const unit = await prisma.unit.findUnique({ where: { id: unitId } })
    if (!unit) {
      return reply.status(404).send({
        error: 'Unidade nao encontrada',
        code: 'NOT_FOUND',
      })
    }

    // Calcular fator multiplicador baseado na quantidade planejada vs rendimento da receita
    const fator = quantidadePlanejada / recipe.rendimento

    // Criar ordem com snapshot dos ingredientes (quantidades proporcionais)
    const order = await prisma.productionOrder.create({
      data: {
        unitId,
        recipeId,
        turno,
        quantidadePlanejada,
        responsavelId: user.userId,
        ingredients: {
          create: recipe.ingredients.map((ing) => ({
            productId: ing.productId,
            quantidade: ing.quantidade * fator,
            unidadeMedida: ing.unidadeMedida,
          })),
        },
      },
      include: {
        unit: { select: { id: true, nome: true, codigo: true } },
        recipe: { select: { id: true, nome: true, versao: true } },
        responsavel: { select: { id: true, nome: true } },
        ingredients: true,
      },
    })

    // Registrar auditoria
    await createAuditLog(request, 'criar_ordem_producao', 'ProductionOrder', order.id, {
      unitId,
      recipeId,
      turno,
      quantidadePlanejada,
      versaoReceita: recipe.versao,
    })

    return reply.status(201).send({ data: order })
  })

  // ============================================================
  // PATCH /:id/start — Iniciar producao
  // ============================================================
  app.patch('/:id/start', { preHandler: [requirePermission('producao', 'iniciar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar parametro ID
    const paramParsed = productionOrderIdParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramParsed.data

    // Buscar ordem de producao
    const order = await prisma.productionOrder.findUnique({ where: { id } })

    if (!order) {
      return reply.status(404).send({
        error: 'Ordem de producao nao encontrada',
        code: 'NOT_FOUND',
      })
    }

    // Validar que a ordem esta no status correto para iniciar
    if (order.status !== 'planejada') {
      return reply.status(400).send({
        error: 'Apenas ordens com status "planejada" podem ser iniciadas',
        code: 'INVALID_STATUS_TRANSITION',
      })
    }

    // Atualizar status para em_andamento e registrar inicio
    const updated = await prisma.productionOrder.update({
      where: { id },
      data: {
        status: 'em_andamento',
        iniciadoAt: new Date(),
      },
      include: {
        unit: { select: { id: true, nome: true, codigo: true } },
        recipe: { select: { id: true, nome: true, versao: true } },
        responsavel: { select: { id: true, nome: true } },
        ingredients: true,
      },
    })

    // Registrar auditoria
    await createAuditLog(request, 'iniciar_ordem_producao', 'ProductionOrder', id, {
      statusAnterior: 'planejada',
      statusAtual: 'em_andamento',
    })

    return reply.status(200).send({ data: updated })
  })

  // ============================================================
  // PATCH /:id/complete — Concluir producao (valida estoque, cria saidas)
  // ============================================================
  app.patch('/:id/complete', { preHandler: [requirePermission('producao', 'concluir')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar parametro ID
    const paramParsed = productionOrderIdParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramParsed.error.flatten().fieldErrors,
      })
    }

    // Validar corpo da requisicao
    const bodyParsed = completeProductionOrderSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: bodyParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramParsed.data
    const { quantidadeRealizada } = bodyParsed.data
    const user = request.user as any

    // Buscar ordem com ingredientes
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: { ingredients: true },
    })

    if (!order) {
      return reply.status(404).send({
        error: 'Ordem de producao nao encontrada',
        code: 'NOT_FOUND',
      })
    }

    // Validar que a ordem esta em andamento
    if (order.status !== 'em_andamento') {
      return reply.status(400).send({
        error: 'Apenas ordens com status "em_andamento" podem ser concluidas',
        code: 'INVALID_STATUS_TRANSITION',
      })
    }

    // Verificar estoque de TODOS os ingredientes antes de prosseguir
    const productIds = order.ingredients.map((ing) => ing.productId)

    const balances = await prisma.stockBalance.findMany({
      where: {
        unitId: order.unitId,
        productId: { in: productIds },
      },
      include: {
        product: { select: { id: true, nome: true, unidadeMedida: true } },
      },
    })

    const balanceMap = new Map(balances.map((b) => [b.productId, b]))

    // Verificar se ha estoque suficiente para cada ingrediente
    const missingItems: Array<{
      productId: string
      productNome: string
      quantidadeNecessaria: number
      quantidadeDisponivel: number
      deficit: number
    }> = []

    for (const ingredient of order.ingredients) {
      const balance = balanceMap.get(ingredient.productId)
      const disponivel = balance?.quantidade || 0

      if (disponivel < ingredient.quantidade) {
        missingItems.push({
          productId: ingredient.productId,
          productNome: balance?.product?.nome || 'Produto desconhecido',
          quantidadeNecessaria: ingredient.quantidade,
          quantidadeDisponivel: disponivel,
          deficit: ingredient.quantidade - disponivel,
        })
      }
    }

    // Se houver itens com estoque insuficiente, retornar erro detalhado
    if (missingItems.length > 0) {
      return reply.status(400).send({
        error: 'Estoque insuficiente para concluir a producao',
        code: 'INSUFFICIENT_STOCK',
        details: missingItems,
      })
    }

    // Executar tudo em transacao: atualizar ordem, criar saidas de estoque e atualizar saldos
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Atualizar ordem de producao
      const completedOrder = await tx.productionOrder.update({
        where: { id },
        data: {
          status: 'concluida',
          quantidadeRealizada,
          concluidoAt: new Date(),
        },
        include: {
          unit: { select: { id: true, nome: true, codigo: true } },
          recipe: { select: { id: true, nome: true, versao: true } },
          responsavel: { select: { id: true, nome: true } },
          ingredients: true,
        },
      })

      // 2. Criar movimentacao de saida e atualizar saldo para cada ingrediente
      for (const ingredient of order.ingredients) {
        // Criar entrada de estoque (tipo: saida)
        await tx.stockEntry.create({
          data: {
            productId: ingredient.productId,
            unitId: order.unitId,
            quantidade: ingredient.quantidade,
            tipo: 'saida',
            motivo: `Producao - Ordem #${order.id}`,
            responsavelId: user.userId,
          },
        })

        // Atualizar saldo do estoque (decrementar)
        await tx.stockBalance.update({
          where: {
            productId_unitId: {
              productId: ingredient.productId,
              unitId: order.unitId,
            },
          },
          data: {
            quantidade: { decrement: ingredient.quantidade },
          },
        })
      }

      return completedOrder
    })

    // Registrar auditoria
    await createAuditLog(request, 'concluir_ordem_producao', 'ProductionOrder', id, {
      quantidadeRealizada,
      statusAnterior: 'em_andamento',
      statusAtual: 'concluida',
      ingredientesProcessados: order.ingredients.length,
    })

    return reply.status(200).send({ data: updated })
  })

  // ============================================================
  // PATCH /:id/cancel — Cancelar ordem de producao
  // ============================================================
  app.patch('/:id/cancel', { preHandler: [requirePermission('producao', 'cancelar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar parametro ID
    const paramParsed = productionOrderIdParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramParsed.data

    // Buscar ordem de producao
    const order = await prisma.productionOrder.findUnique({ where: { id } })

    if (!order) {
      return reply.status(404).send({
        error: 'Ordem de producao nao encontrada',
        code: 'NOT_FOUND',
      })
    }

    // Validar que a ordem pode ser cancelada (nao pode cancelar concluida)
    if (order.status === 'concluida') {
      return reply.status(400).send({
        error: 'Ordens concluidas nao podem ser canceladas',
        code: 'INVALID_STATUS_TRANSITION',
      })
    }

    if (order.status === 'cancelada') {
      return reply.status(400).send({
        error: 'Ordem ja esta cancelada',
        code: 'ALREADY_CANCELLED',
      })
    }

    // Cancelar ordem
    const updated = await prisma.productionOrder.update({
      where: { id },
      data: { status: 'cancelada' },
      include: {
        unit: { select: { id: true, nome: true, codigo: true } },
        recipe: { select: { id: true, nome: true, versao: true } },
        responsavel: { select: { id: true, nome: true } },
        ingredients: true,
      },
    })

    // Registrar auditoria
    await createAuditLog(request, 'cancelar_ordem_producao', 'ProductionOrder', id, {
      statusAnterior: order.status,
      statusAtual: 'cancelada',
    })

    return reply.status(200).send({ data: updated })
  })
}
