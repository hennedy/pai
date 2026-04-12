import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireUnit, getUnitFilter, requirePermission } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  stockEntrySchema,
  stockExitSchema,
  stockAdjustmentSchema,
  stockLossSchema,
  stockBalanceQuerySchema,
  stockMovementsQuerySchema,
  physicalInventorySchema,
  stockAlertsQuerySchema,
} from './stock.schemas'

/**
 * Modulo de estoque da API.
 * Registra rotas de entrada, saida, ajuste, perda, saldo,
 * movimentacoes, inventario fisico e alertas de estoque minimo.
 */
export async function stockRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticacao e unidade
  app.addHook('onRequest', authenticate)
  app.addHook('onRequest', requireUnit())

  // ============================================================
  // POST /entry — Registrar entrada de estoque
  // ============================================================
  app.post('/entry', { preHandler: [requirePermission('estoque', 'entrada')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar corpo da requisicao
    const parsed = stockEntrySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { productId, unitId, quantidade, lote, vencimento } = parsed.data
    const user = request.user as any

    // Verificar se o produto existe
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      return reply.status(404).send({
        error: 'Produto nao encontrado',
        code: 'PRODUCT_NOT_FOUND',
      })
    }

    // Usar transacao para garantir consistencia entre entrada e saldo
    const result = await prisma.$transaction(async (tx) => {
      // Criar registro de entrada
      const entry = await tx.stockEntry.create({
        data: {
          productId,
          unitId,
          quantidade,
          tipo: 'entrada',
          lote: lote ?? undefined,
          vencimento: vencimento ? new Date(vencimento) : undefined,
          responsavelId: user.userId,
        },
        include: {
          product: { select: { id: true, nome: true, sku: true } },
          unit: { select: { id: true, nome: true, codigo: true } },
        },
      })

      // Atualizar ou criar saldo do produto na unidade
      await tx.stockBalance.upsert({
        where: {
          productId_unitId: { productId, unitId },
        },
        create: {
          productId,
          unitId,
          quantidade,
        },
        update: {
          quantidade: { increment: quantidade },
        },
      })

      return entry
    })

    // Registrar no audit log
    await createAuditLog(request, 'entrada_estoque', 'StockEntry', result.id, {
      productId,
      unitId,
      quantidade,
      lote,
    })

    return reply.status(201).send({ data: result })
  })

  // ============================================================
  // POST /exit — Registrar saida de estoque
  // ============================================================
  app.post('/exit', { preHandler: [requirePermission('estoque', 'saida')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar corpo da requisicao
    const parsed = stockExitSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { productId, unitId, quantidade, motivo } = parsed.data
    const user = request.user as any

    // Verificar se o produto existe
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      return reply.status(404).send({
        error: 'Produto nao encontrado',
        code: 'PRODUCT_NOT_FOUND',
      })
    }

    // Verificar saldo atual antes de permitir saida
    const currentBalance = await prisma.stockBalance.findUnique({
      where: {
        productId_unitId: { productId, unitId },
      },
    })

    const saldoAtual = currentBalance?.quantidade ?? 0

    // Regra de negocio: saldo NUNCA pode ficar negativo
    if (saldoAtual < quantidade) {
      return reply.status(422).send({
        error: `Saldo insuficiente. Saldo atual: ${saldoAtual}, quantidade solicitada: ${quantidade}`,
        code: 'INSUFFICIENT_BALANCE',
        saldoAtual,
        quantidadeSolicitada: quantidade,
      })
    }

    // Usar transacao para garantir consistencia entre saida e saldo
    const result = await prisma.$transaction(async (tx) => {
      // Criar registro de saida
      const entry = await tx.stockEntry.create({
        data: {
          productId,
          unitId,
          quantidade,
          tipo: 'saida',
          motivo: motivo ?? undefined,
          responsavelId: user.userId,
        },
        include: {
          product: { select: { id: true, nome: true, sku: true } },
          unit: { select: { id: true, nome: true, codigo: true } },
        },
      })

      // Decrementar saldo
      await tx.stockBalance.update({
        where: {
          productId_unitId: { productId, unitId },
        },
        data: {
          quantidade: { decrement: quantidade },
        },
      })

      return entry
    })

    // Registrar no audit log
    await createAuditLog(request, 'saida_estoque', 'StockEntry', result.id, {
      productId,
      unitId,
      quantidade,
      motivo,
    })

    return reply.status(201).send({ data: result })
  })

  // ============================================================
  // POST /adjustment — Registrar ajuste de estoque (auditado)
  // ============================================================
  app.post('/adjustment', { preHandler: [requirePermission('estoque', 'ajuste')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar corpo da requisicao
    const parsed = stockAdjustmentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { productId, unitId, quantidade, motivo } = parsed.data
    const user = request.user as any

    // Verificar se o produto existe
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      return reply.status(404).send({
        error: 'Produto nao encontrado',
        code: 'PRODUCT_NOT_FOUND',
      })
    }

    // Buscar saldo atual para calcular novo saldo apos ajuste
    const currentBalance = await prisma.stockBalance.findUnique({
      where: {
        productId_unitId: { productId, unitId },
      },
    })

    const saldoAtual = currentBalance?.quantidade ?? 0
    const novoSaldo = saldoAtual + quantidade

    // Regra de negocio: saldo NUNCA pode ficar negativo
    if (novoSaldo < 0) {
      return reply.status(422).send({
        error: `Ajuste resultaria em saldo negativo. Saldo atual: ${saldoAtual}, ajuste: ${quantidade}`,
        code: 'NEGATIVE_BALANCE_NOT_ALLOWED',
        saldoAtual,
        ajuste: quantidade,
        saldoResultante: novoSaldo,
      })
    }

    // Usar transacao para garantir consistencia entre ajuste e saldo
    const result = await prisma.$transaction(async (tx) => {
      // Criar registro de ajuste
      const entry = await tx.stockEntry.create({
        data: {
          productId,
          unitId,
          quantidade,
          tipo: 'ajuste',
          motivo,
          responsavelId: user.userId,
        },
        include: {
          product: { select: { id: true, nome: true, sku: true } },
          unit: { select: { id: true, nome: true, codigo: true } },
        },
      })

      // Atualizar ou criar saldo
      await tx.stockBalance.upsert({
        where: {
          productId_unitId: { productId, unitId },
        },
        create: {
          productId,
          unitId,
          quantidade: Math.max(0, quantidade),
        },
        update: {
          quantidade: { increment: quantidade },
        },
      })

      return entry
    })

    // Registrar no audit log (ajustes sempre sao auditados)
    await createAuditLog(request, 'ajuste_estoque', 'StockEntry', result.id, {
      productId,
      unitId,
      quantidade,
      motivo,
      saldoAnterior: saldoAtual,
      saldoNovo: novoSaldo,
    })

    return reply.status(201).send({ data: result })
  })

  // ============================================================
  // POST /loss — Registrar perda de estoque
  // ============================================================
  app.post('/loss', { preHandler: [requirePermission('estoque', 'perda')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar corpo da requisicao
    const parsed = stockLossSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { productId, unitId, quantidade, lossType, motivo } = parsed.data
    const user = request.user as any

    // Verificar se o produto existe
    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      return reply.status(404).send({
        error: 'Produto nao encontrado',
        code: 'PRODUCT_NOT_FOUND',
      })
    }

    // Verificar saldo atual antes de registrar perda
    const currentBalance = await prisma.stockBalance.findUnique({
      where: {
        productId_unitId: { productId, unitId },
      },
    })

    const saldoAtual = currentBalance?.quantidade ?? 0

    // Regra de negocio: saldo NUNCA pode ficar negativo
    if (saldoAtual < quantidade) {
      return reply.status(422).send({
        error: `Saldo insuficiente para registrar perda. Saldo atual: ${saldoAtual}, perda: ${quantidade}`,
        code: 'INSUFFICIENT_BALANCE',
        saldoAtual,
        quantidadePerda: quantidade,
      })
    }

    // Usar transacao para garantir consistencia entre perda e saldo
    const result = await prisma.$transaction(async (tx) => {
      // Criar registro de perda com tipo categorizado
      const entry = await tx.stockEntry.create({
        data: {
          productId,
          unitId,
          quantidade,
          tipo: 'perda',
          lossType,
          motivo: motivo ?? undefined,
          responsavelId: user.userId,
        },
        include: {
          product: { select: { id: true, nome: true, sku: true } },
          unit: { select: { id: true, nome: true, codigo: true } },
        },
      })

      // Decrementar saldo
      await tx.stockBalance.update({
        where: {
          productId_unitId: { productId, unitId },
        },
        data: {
          quantidade: { decrement: quantidade },
        },
      })

      return entry
    })

    // Registrar no audit log
    await createAuditLog(request, 'perda_estoque', 'StockEntry', result.id, {
      productId,
      unitId,
      quantidade,
      lossType,
      motivo,
    })

    return reply.status(201).send({ data: result })
  })

  // ============================================================
  // GET /balance — Consultar saldo atual por unidade
  // ============================================================
  app.get('/balance', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar query params
    const parsed = stockBalanceQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, productId, categoriaId, search } = parsed.data
    const { skip, take } = calcPagination(page, limit)

    // Filtro de unidade baseado nas permissoes do usuario
    const unitFilter = getUnitFilter(request)

    // Montar filtro dinamico
    const where: any = {
      ...unitFilter,
    }

    if (productId) {
      where.productId = productId
    }

    // Filtros pelo produto relacionado
    if (categoriaId || search) {
      where.product = {}
      if (categoriaId) {
        where.product.categoriaId = categoriaId
      }
      if (search) {
        where.product.OR = [
          { nome: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ]
      }
    }

    // Buscar saldos e total em paralelo
    const [balances, total] = await Promise.all([
      prisma.stockBalance.findMany({
        where,
        skip,
        take,
        orderBy: { product: { nome: 'asc' } },
        include: {
          product: {
            select: {
              id: true,
              nome: true,
              sku: true,
              unidadeMedida: true,
              estoqueMinimo: true,
              categoria: { select: { id: true, nome: true } },
            },
          },
          unit: { select: { id: true, nome: true, codigo: true } },
        },
      }),
      prisma.stockBalance.count({ where }),
    ])

    return reply.status(200).send({
      data: balances,
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // GET /movements — Historico de movimentacoes
  // ============================================================
  app.get('/movements', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar query params
    const parsed = stockMovementsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, productId, tipo, dataInicio, dataFim } = parsed.data
    const { skip, take } = calcPagination(page, limit)

    // Filtro de unidade baseado nas permissoes do usuario
    const unitFilter = getUnitFilter(request)

    // Montar filtro dinamico
    const where: any = {
      ...unitFilter,
    }

    if (productId) {
      where.productId = productId
    }

    if (tipo) {
      where.tipo = tipo
    }

    // Filtro por periodo
    if (dataInicio || dataFim) {
      where.createdAt = {}
      if (dataInicio) {
        where.createdAt.gte = new Date(dataInicio)
      }
      if (dataFim) {
        where.createdAt.lte = new Date(dataFim)
      }
    }

    // Buscar movimentacoes e total em paralelo
    const [movements, total] = await Promise.all([
      prisma.stockEntry.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, nome: true, sku: true, unidadeMedida: true } },
          unit: { select: { id: true, nome: true, codigo: true } },
          responsavel: { select: { id: true, nome: true } },
        },
      }),
      prisma.stockEntry.count({ where }),
    ])

    return reply.status(200).send({
      data: movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // POST /inventory — Inventario fisico (contagem e ajuste automatico)
  // ============================================================
  app.post('/inventory', { preHandler: [requirePermission('estoque', 'inventario')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar corpo da requisicao
    const parsed = physicalInventorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { unitId, itens, motivo } = parsed.data
    const user = request.user as any

    // Verificar se todos os produtos existem
    const productIds = itens.map((item) => item.productId)
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, nome: true },
    })

    if (existingProducts.length !== productIds.length) {
      const foundIds = existingProducts.map((p) => p.id)
      const missingIds = productIds.filter((id) => !foundIds.includes(id))
      return reply.status(404).send({
        error: 'Um ou mais produtos nao foram encontrados',
        code: 'PRODUCTS_NOT_FOUND',
        missingIds,
      })
    }

    // Usar transacao para processar todo o inventario de forma atomica
    const adjustments = await prisma.$transaction(async (tx) => {
      const results: Array<{
        productId: string
        productName: string
        saldoSistema: number
        contagem: number
        diferenca: number
        ajusteId: string | null
      }> = []

      for (const item of itens) {
        // Buscar saldo atual no sistema
        const balance = await tx.stockBalance.findUnique({
          where: {
            productId_unitId: { productId: item.productId, unitId },
          },
        })

        const saldoSistema = balance?.quantidade ?? 0
        const diferenca = item.contagem - saldoSistema
        const productName = existingProducts.find((p) => p.id === item.productId)?.nome ?? ''

        let ajusteId: string | null = null

        // Criar ajuste apenas se houver diferenca
        if (diferenca !== 0) {
          const entry = await tx.stockEntry.create({
            data: {
              productId: item.productId,
              unitId,
              quantidade: diferenca,
              tipo: 'ajuste',
              motivo: `Inventario fisico: ${motivo}. Contagem: ${item.contagem}, Sistema: ${saldoSistema}`,
              responsavelId: user.userId,
            },
          })

          ajusteId = entry.id

          // Atualizar saldo para refletir a contagem fisica
          await tx.stockBalance.upsert({
            where: {
              productId_unitId: { productId: item.productId, unitId },
            },
            create: {
              productId: item.productId,
              unitId,
              quantidade: item.contagem,
            },
            update: {
              quantidade: item.contagem,
            },
          })
        }

        results.push({
          productId: item.productId,
          productName,
          saldoSistema,
          contagem: item.contagem,
          diferenca,
          ajusteId,
        })
      }

      return results
    })

    // Resumo do inventario
    const totalAjustes = adjustments.filter((a) => a.diferenca !== 0).length
    const semDiferenca = adjustments.filter((a) => a.diferenca === 0).length

    // Registrar no audit log
    await createAuditLog(request, 'inventario_fisico', 'StockEntry', undefined, {
      unitId,
      motivo,
      totalItens: itens.length,
      totalAjustes,
      semDiferenca,
      detalhes: adjustments,
    })

    return reply.status(201).send({
      data: {
        resumo: {
          totalItens: itens.length,
          totalAjustes,
          semDiferenca,
        },
        itens: adjustments,
      },
    })
  })

  // ============================================================
  // GET /alerts — Produtos abaixo do estoque minimo
  // ============================================================
  app.get('/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar query params
    const parsed = stockAlertsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit } = parsed.data
    const { skip, take } = calcPagination(page, limit)

    // Filtro de unidade baseado nas permissoes do usuario
    const unitFilter = getUnitFilter(request)

    // Buscar saldos onde quantidade esta abaixo do estoque minimo do produto
    // Utilizamos rawQuery-style com where para comparar campos relacionados
    const where: any = {
      ...unitFilter,
      product: {
        estoqueMinimo: { gt: 0 },
        status: 'ativo',
      },
    }

    // Buscar todos os saldos com produtos que tem estoque minimo configurado
    const allBalances = await prisma.stockBalance.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            nome: true,
            sku: true,
            unidadeMedida: true,
            estoqueMinimo: true,
            categoria: { select: { id: true, nome: true } },
          },
        },
        unit: { select: { id: true, nome: true, codigo: true } },
      },
      orderBy: { product: { nome: 'asc' } },
    })

    // Filtrar no app: quantidade abaixo do estoque minimo
    const alertBalances = allBalances.filter(
      (b) => b.quantidade < b.product.estoqueMinimo
    )

    // Paginar resultado filtrado
    const total = alertBalances.length
    const paginatedAlerts = alertBalances.slice(skip, skip + take)

    return reply.status(200).send({
      data: paginatedAlerts.map((b) => ({
        ...b,
        deficit: b.product.estoqueMinimo - b.quantidade,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })
}
