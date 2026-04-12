import type { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireRole, requireUnit, getUnitFilter, requirePermission } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  createCycleSchema,
  reopenCycleSchema,
  createRequestSchema,
  updateRequestSchema,
  listCyclesQuerySchema,
  listRequestsQuerySchema,
  idParamSchema,
  requestParamSchema,
  consolidationQuerySchema,
} from './purchase.schemas'

export async function purchaseRoutes(app: FastifyInstance) {
  // Todas as rotas requerem autenticacao
  app.addHook('onRequest', authenticate)

  // ============================================================
  // POST / - Abrir ciclo de compras
  // ============================================================
  app.post('/', {
    preHandler: [requireUnit(), requirePermission('compras', 'criar_ciclo')],
  }, async (request, reply) => {
    const body = createCycleSchema.parse(request.body)
    const user = request.user as any

    // Regra: apenas 1 ciclo aberto por vez (globalmente)
    const cicloAberto = await prisma.purchaseCycle.findFirst({
      where: {
        status: { in: ['aberto', 'reaberto'] },
      },
    })

    if (cicloAberto) {
      return reply.status(409).send({
        error: 'Ja existe um ciclo de compras aberto',
        code: 'CYCLE_ALREADY_OPEN',
        cycleId: cicloAberto.id,
      })
    }

    // Normalizar dataFechamento para 23:59:59 do dia selecionado
    let dataFechamento: Date | undefined
    if (body.dataFechamento) {
      dataFechamento = new Date(body.dataFechamento)
      dataFechamento.setHours(23, 59, 59, 999)
    }

    const ciclo = await prisma.purchaseCycle.create({
      data: {
        titulo: body.titulo,
        dataFechamento,
        unitId: body.unitId || undefined,
        criadoPorId: user.userId,
        status: 'aberto',
      },
      include: {
        unit: true,
        criadoPor: { select: { id: true, nome: true, email: true } },
      },
    })

    // Registrar auditoria
    await createAuditLog(request, 'criar_ciclo_compras', 'PurchaseCycle', ciclo.id, {
      titulo: body.titulo,
      dataFechamento: body.dataFechamento,
      unitId: body.unitId,
    })

    return reply.status(201).send(ciclo)
  })

  // ============================================================
  // PATCH /:id/close - Fechar ciclo de compras
  // ============================================================
  app.patch('/:id/close', {
    preHandler: [requireUnit(), requirePermission('compras', 'fechar_ciclo')],
  }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const user = request.user as any

    const ciclo = await prisma.purchaseCycle.findUnique({ where: { id } })

    if (!ciclo) {
      return reply.status(404).send({ error: 'Ciclo nao encontrado', code: 'CYCLE_NOT_FOUND' })
    }

    // Apenas ciclos abertos ou reabertos podem ser fechados
    if (ciclo.status === 'fechado') {
      return reply.status(400).send({ error: 'Ciclo ja esta fechado', code: 'CYCLE_ALREADY_CLOSED' })
    }

    const cicloAtualizado = await prisma.purchaseCycle.update({
      where: { id },
      data: {
        status: 'fechado',
        fechadoPorId: user.userId,
        dataFechamento: new Date(),
      },
      include: {
        unit: true,
        criadoPor: { select: { id: true, nome: true, email: true } },
        fechadoPor: { select: { id: true, nome: true, email: true } },
      },
    })

    await createAuditLog(request, 'fechar_ciclo_compras', 'PurchaseCycle', id)

    return reply.send(cicloAtualizado)
  })

  // ============================================================
  // PATCH /:id/reopen - Reabrir ciclo
  // ============================================================
  app.patch('/:id/reopen', {
    preHandler: [requirePermission('compras', 'reabrir_ciclo')],
  }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const body = reopenCycleSchema.parse(request.body)

    const ciclo = await prisma.purchaseCycle.findUnique({ where: { id } })

    if (!ciclo) {
      return reply.status(404).send({ error: 'Ciclo nao encontrado', code: 'CYCLE_NOT_FOUND' })
    }

    if (ciclo.status !== 'fechado') {
      return reply.status(400).send({
        error: 'Apenas ciclos fechados podem ser reabertos',
        code: 'CYCLE_NOT_CLOSED',
      })
    }

    // Verifica se ja existe outro ciclo aberto
    const cicloAberto = await prisma.purchaseCycle.findFirst({
      where: {
        status: { in: ['aberto', 'reaberto'] },
        id: { not: id },
      },
    })

    if (cicloAberto) {
      return reply.status(409).send({
        error: 'Ja existe um ciclo de compras aberto. Feche-o antes de reabrir outro.',
        code: 'CYCLE_ALREADY_OPEN',
        cycleId: cicloAberto.id,
      })
    }

    const cicloAtualizado = await prisma.purchaseCycle.update({
      where: { id },
      data: {
        status: 'reaberto',
        motivoReabertura: body.motivo,
        dataFechamento: null,
        fechadoPorId: null,
      },
      include: {
        unit: true,
        criadoPor: { select: { id: true, nome: true, email: true } },
      },
    })

    // Registrar motivo de reabertura no AuditLog
    await createAuditLog(request, 'reabrir_ciclo_compras', 'PurchaseCycle', id, {
      motivo: body.motivo,
    })

    return reply.send(cicloAtualizado)
  })

  // ============================================================
  // GET / - Listar ciclos de compras com filtro e paginacao
  // Ciclos sao globais - todos os usuarios autenticados podem visualizar
  // ============================================================
  app.get('/', async (request, reply) => {
    const query = listCyclesQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)

    // Montar filtro por status (sem filtro de unidade - ciclos sao globais)
    const where: any = {}

    if (query.status) {
      where.status = query.status
    }

    const [ciclos, total] = await Promise.all([
      prisma.purchaseCycle.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          unit: true,
          criadoPor: { select: { id: true, nome: true, email: true } },
          fechadoPor: { select: { id: true, nome: true, email: true } },
          _count: { select: { requests: true } },
        },
      }),
      prisma.purchaseCycle.count({ where }),
    ])

    return reply.send({
      data: ciclos,
      meta: {
        total,
        page,
        limit,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // POST /:id/requests - Adicionar solicitacao de compra
  // ============================================================
  app.post('/:id/requests', {
    preHandler: [requireUnit(), requirePermission('compras', 'criar_pedido')],
  }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const body = createRequestSchema.parse(request.body)
    const user = request.user as any

    // Buscar ciclo
    const ciclo = await prisma.purchaseCycle.findUnique({ where: { id } })

    if (!ciclo) {
      return reply.status(404).send({ error: 'Ciclo nao encontrado', code: 'CYCLE_NOT_FOUND' })
    }

    // Verificar se ciclo esta aberto ou reaberto
    if (ciclo.status === 'fechado') {
      return reply.status(400).send({
        error: 'Ciclo de compras esta fechado. Nao e possivel adicionar solicitacoes.',
        code: 'CYCLE_CLOSED',
      })
    }

    // Verificar se a data de fechamento ja passou (bloqueio automatico)
    if (ciclo.dataFechamento && new Date() > ciclo.dataFechamento) {
      return reply.status(400).send({
        error: 'Prazo para solicitacoes encerrado. Data de fechamento ultrapassada.',
        code: 'CYCLE_DEADLINE_PASSED',
      })
    }

    // Determinar unitId da solicitacao (da unidade do usuario)
    const unitId = (request.body as any).unitId || user.roles?.[0]?.unitId
    if (!unitId) {
      return reply.status(400).send({
        error: 'Unidade nao identificada. Informe o unitId.',
        code: 'UNIT_REQUIRED',
      })
    }

    // Verificar se o produto existe
    const product = await prisma.product.findUnique({ where: { id: body.productId } })
    if (!product) {
      return reply.status(404).send({ error: 'Produto nao encontrado', code: 'PRODUCT_NOT_FOUND' })
    }

    const solicitacao = await prisma.purchaseRequest.create({
      data: {
        cycleId: id,
        unitId,
        productId: body.productId,
        quantidade: body.quantidade,
        observacao: body.observacao,
        marca: body.marca,
        solicitadoPorId: user.userId,
      },
      include: {
        product: { select: { id: true, nome: true, sku: true, unidadeMedida: true } },
        unit: { select: { id: true, nome: true, codigo: true } },
        solicitadoPor: { select: { id: true, nome: true, email: true } },
      },
    })

    await createAuditLog(request, 'criar_solicitacao_compra', 'PurchaseRequest', solicitacao.id, {
      cycleId: id,
      productId: body.productId,
      quantidade: body.quantidade,
    })

    return reply.status(201).send(solicitacao)
  })

  // ============================================================
  // PUT /:id/requests/:reqId - Editar solicitacao (apenas ciclo aberto)
  // ============================================================
  app.put('/:id/requests/:reqId', {
    preHandler: [requireUnit(), requirePermission('compras', 'editar_pedido')],
  }, async (request, reply) => {
    const { id, reqId } = requestParamSchema.parse(request.params)
    const body = updateRequestSchema.parse(request.body)

    // Buscar ciclo
    const ciclo = await prisma.purchaseCycle.findUnique({ where: { id } })

    if (!ciclo) {
      return reply.status(404).send({ error: 'Ciclo nao encontrado', code: 'CYCLE_NOT_FOUND' })
    }

    // Verificar se ciclo esta aberto ou reaberto
    if (ciclo.status === 'fechado') {
      return reply.status(400).send({
        error: 'Ciclo de compras esta fechado. Nao e possivel editar solicitacoes.',
        code: 'CYCLE_CLOSED',
      })
    }

    // Verificar se a data de fechamento ja passou
    if (ciclo.dataFechamento && new Date() > ciclo.dataFechamento) {
      return reply.status(400).send({
        error: 'Prazo para solicitacoes encerrado. Data de fechamento ultrapassada.',
        code: 'CYCLE_DEADLINE_PASSED',
      })
    }

    // Buscar solicitacao
    const solicitacao = await prisma.purchaseRequest.findFirst({
      where: { id: reqId, cycleId: id },
    })

    if (!solicitacao) {
      return reply.status(404).send({
        error: 'Solicitacao nao encontrada neste ciclo',
        code: 'REQUEST_NOT_FOUND',
      })
    }

    // Se trocar produto, verificar se existe
    if (body.productId) {
      const product = await prisma.product.findUnique({ where: { id: body.productId } })
      if (!product) {
        return reply.status(404).send({ error: 'Produto nao encontrado', code: 'PRODUCT_NOT_FOUND' })
      }
    }

    const solicitacaoAtualizada = await prisma.purchaseRequest.update({
      where: { id: reqId },
      data: {
        productId: body.productId,
        quantidade: body.quantidade,
        observacao: body.observacao,
        marca: body.marca,
      },
      include: {
        product: { select: { id: true, nome: true, sku: true, unidadeMedida: true } },
        unit: { select: { id: true, nome: true, codigo: true } },
        solicitadoPor: { select: { id: true, nome: true, email: true } },
      },
    })

    await createAuditLog(request, 'editar_solicitacao_compra', 'PurchaseRequest', reqId, {
      cycleId: id,
      alteracoes: body,
    })

    return reply.send(solicitacaoAtualizada)
  })

  // ============================================================
  // GET /:id/consolidation - Visao consolidada por produto
  // Agrupa por produto mostrando total + detalhe por unidade
  // ============================================================
  app.get('/:id/consolidation', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const query = consolidationQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)

    // Verificar se ciclo existe
    const ciclo = await prisma.purchaseCycle.findUnique({ where: { id } })
    if (!ciclo) {
      return reply.status(404).send({ error: 'Ciclo nao encontrado', code: 'CYCLE_NOT_FOUND' })
    }

    // Buscar todas as solicitacoes do ciclo agrupadas por produto
    const solicitacoes = await prisma.purchaseRequest.findMany({
      where: { cycleId: id },
      include: {
        product: { select: { id: true, nome: true, sku: true, unidadeMedida: true, codigoCotacao: true } },
        unit: { select: { id: true, nome: true, codigo: true } },
      },
      orderBy: { product: { nome: 'asc' } },
    })

    // Agrupar por produto
    const consolidado = new Map<string, {
      product: { id: string; nome: string; sku: string; unidadeMedida: string; codigoCotacao: string | null }
      totalQuantidade: number
      unidades: { unit: { id: string; nome: string; codigo: string }; quantidade: number; solicitacoes: number }[]
    }>()

    for (const sol of solicitacoes) {
      const key = sol.productId

      if (!consolidado.has(key)) {
        consolidado.set(key, {
          product: sol.product,
          totalQuantidade: 0,
          unidades: [],
        })
      }

      const item = consolidado.get(key)!
      item.totalQuantidade += sol.quantidade

      // Agrupar por unidade dentro do produto
      const unidadeExistente = item.unidades.find((u) => u.unit.id === sol.unitId)
      if (unidadeExistente) {
        unidadeExistente.quantidade += sol.quantidade
        unidadeExistente.solicitacoes += 1
      } else {
        item.unidades.push({
          unit: sol.unit,
          quantidade: sol.quantidade,
          solicitacoes: 1,
        })
      }
    }

    // Converter para array e paginar
    const consolidadoArray = Array.from(consolidado.values())
    const total = consolidadoArray.length
    const paginado = consolidadoArray.slice(skip, skip + take)

    return reply.send({
      data: paginado,
      meta: {
        total,
        page,
        limit,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // PATCH /:id/status - Alterar status do ciclo (fechar, reabrir, consolidar)
  // Endpoint unificado usado pelo frontend
  // ============================================================
  app.patch('/:id/status', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const { action } = request.body as { action: string }
    const user = request.user as any

    if (!action || !['fechar', 'reabrir', 'consolidar'].includes(action)) {
      return reply.status(400).send({ error: 'Acao invalida', code: 'INVALID_ACTION' })
    }

    // Verificar permissao granular por acao
    const permissionMap: Record<string, string> = {
      fechar: 'fechar_ciclo',
      reabrir: 'reabrir_ciclo',
      consolidar: 'consolidar',
    }

    // Verificar permissao (gerente_geral tem acesso total via middleware)
    const isGerenteGeral = user.roles.some((r: any) => r.role === 'gerente_geral')
    if (!isGerenteGeral) {
      const userUnits = await prisma.userUnit.findMany({
        where: { userId: user.userId },
        select: { roleId: true },
      })
      const roleIds = [...new Set(userUnits.map((uu: any) => uu.roleId))]
      const permission = await prisma.rolePermission.findFirst({
        where: { roleId: { in: roleIds }, modulo: 'compras', acao: permissionMap[action] },
      })
      if (!permission) {
        return reply.status(403).send({
          error: `Sem permissao: compras.${permissionMap[action]}`,
          code: 'PERMISSION_DENIED',
        })
      }
    }

    const ciclo = await prisma.purchaseCycle.findUnique({ where: { id } })
    if (!ciclo) {
      return reply.status(404).send({ error: 'Ciclo nao encontrado', code: 'CYCLE_NOT_FOUND' })
    }

    if (action === 'fechar') {
      if (ciclo.status !== 'aberto' && ciclo.status !== 'reaberto') {
        return reply.status(400).send({ error: 'Ciclo nao pode ser fechado neste status', code: 'INVALID_STATUS' })
      }
      const updated = await prisma.purchaseCycle.update({
        where: { id },
        data: { status: 'fechado', fechadoPorId: user.userId, dataFechamento: new Date() },
      })
      await createAuditLog(request, 'fechar_ciclo_compras', 'PurchaseCycle', id)
      return reply.send(updated)
    }

    if (action === 'reabrir') {
      if (ciclo.status !== 'fechado') {
        return reply.status(400).send({ error: 'Apenas ciclos fechados podem ser reabertos', code: 'CYCLE_NOT_CLOSED' })
      }
      const cicloAberto = await prisma.purchaseCycle.findFirst({
        where: { status: { in: ['aberto', 'reaberto'] }, id: { not: id } },
      })
      if (cicloAberto) {
        return reply.status(409).send({ error: 'Ja existe um ciclo aberto', code: 'CYCLE_ALREADY_OPEN' })
      }
      const updated = await prisma.purchaseCycle.update({
        where: { id },
        data: { status: 'reaberto', dataFechamento: null, fechadoPorId: null },
      })
      await createAuditLog(request, 'reabrir_ciclo_compras', 'PurchaseCycle', id)
      return reply.send(updated)
    }

    if (action === 'consolidar') {
      if (ciclo.status !== 'fechado') {
        return reply.status(400).send({ error: 'Apenas ciclos fechados podem ser consolidados', code: 'CYCLE_NOT_CLOSED' })
      }
      const updated = await prisma.purchaseCycle.update({
        where: { id },
        data: { status: 'consolidado' },
      })
      await createAuditLog(request, 'consolidar_ciclo_compras', 'PurchaseCycle', id)
      return reply.send(updated)
    }
  })

  // ============================================================
  // DELETE /:id - Excluir ciclo de compras (apenas aberto/reaberto)
  // ============================================================
  app.delete('/:id', {
    preHandler: [requirePermission('compras', 'excluir_ciclo')],
  }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)

    const ciclo = await prisma.purchaseCycle.findUnique({
      where: { id },
      include: { _count: { select: { requests: true } } },
    })

    if (!ciclo) {
      return reply.status(404).send({ error: 'Ciclo nao encontrado', code: 'CYCLE_NOT_FOUND' })
    }

    // Apenas ciclos abertos ou reabertos podem ser excluidos
    if (ciclo.status === 'consolidado') {
      return reply.status(400).send({
        error: 'Ciclos consolidados nao podem ser excluidos',
        code: 'CYCLE_CONSOLIDATED',
      })
    }

    // Excluir ciclo (requests sao removidas por cascade)
    await prisma.purchaseCycle.delete({ where: { id } })

    await createAuditLog(request, 'excluir_ciclo_compras', 'PurchaseCycle', id, {
      titulo: ciclo.titulo,
      status: ciclo.status,
      totalRequests: ciclo._count.requests,
    })

    return reply.send({ message: 'Ciclo excluido com sucesso' })
  })

  // ============================================================
  // GET /:id/requests - Listar solicitacoes por unidade
  // ============================================================
  app.get('/:id/requests', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const query = listRequestsQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)

    // Verificar se ciclo existe
    const ciclo = await prisma.purchaseCycle.findUnique({ where: { id } })
    if (!ciclo) {
      return reply.status(404).send({ error: 'Ciclo nao encontrado', code: 'CYCLE_NOT_FOUND' })
    }

    // Montar filtro com isolamento por unidade
    const where: any = { cycleId: id }

    const unitFilter = getUnitFilter(request)
    if (unitFilter.unitId) {
      where.unitId = unitFilter.unitId
    }

    const [solicitacoes, total] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, nome: true, sku: true, unidadeMedida: true } },
          unit: { select: { id: true, nome: true, codigo: true } },
          solicitadoPor: { select: { id: true, nome: true, email: true } },
        },
      }),
      prisma.purchaseRequest.count({ where }),
    ])

    return reply.send({
      data: solicitacoes,
      meta: {
        total,
        page,
        limit,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })
}
