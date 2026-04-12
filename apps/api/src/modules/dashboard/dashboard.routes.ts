import type { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { authenticate, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'

/**
 * Modulo de dashboard da API.
 * Registra rotas de resumo e graficos para o painel principal.
 */
export async function dashboardRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticacao
  app.addHook('onRequest', authenticate)

  // =====================================================
  // GET /summary - Cards de resumo do dashboard
  // =====================================================
  app.get('/summary', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const unitFilter = getUnitFilter(request)

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)

    const [
      totalUnidadesAtivas,
      ocorrenciasAbertas,
      checklistsPendentesHoje,
      alertasEstoque,
    ] = await Promise.all([
      // Total de unidades ativas
      prisma.unit.count({
        where: { status: 'ativo' },
      }),

      // Ocorrencias abertas (filtradas por unidade)
      prisma.occurrence.count({
        where: {
          ...unitFilter,
          status: { in: ['aberta', 'em_andamento'] },
        },
      }),

      // Checklists pendentes para hoje
      prisma.checklistExecution.count({
        where: {
          ...unitFilter,
          status: 'pendente',
          data: { gte: hoje, lt: amanha },
        },
      }),

      // Alertas de estoque (saldo abaixo do minimo)
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count
        FROM "StockBalance" sb
        INNER JOIN "Product" p ON p.id = sb."productId"
        WHERE sb.quantidade < p."estoqueMinimo"
          AND p.status = 'ativo'
          ${unitFilter.unitId
            ? (typeof unitFilter.unitId === 'string'
              ? prisma.$queryRaw`AND sb."unitId" = ${unitFilter.unitId}`
              : prisma.$queryRaw``)
            : prisma.$queryRaw``
          }
      `.catch(() => [{ count: BigInt(0) }]),
    ])

    // Contar alertas de estoque de forma segura
    let countAlertas = 0
    try {
      // Busca alternativa para alertas de estoque
      const balances = await prisma.stockBalance.findMany({
        where: unitFilter.unitId ? { unitId: unitFilter.unitId as string } : {},
        include: { product: { select: { estoqueMinimo: true, status: true } } },
      })
      countAlertas = balances.filter(
        (b) => b.product.status === 'ativo' && b.quantidade < b.product.estoqueMinimo
      ).length
    } catch {
      countAlertas = 0
    }

    return reply.send({
      totalUnidadesAtivas,
      ocorrenciasAbertas,
      checklistsPendentesHoje,
      alertasEstoque: countAlertas,
    })
  })

  // =====================================================
  // GET /charts/production - Grafico planejado vs realizado (ultimos 30 dias)
  // =====================================================
  app.get('/charts/production', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const unitFilter = getUnitFilter(request)

    const dataInicio = new Date()
    dataInicio.setDate(dataInicio.getDate() - 30)
    dataInicio.setHours(0, 0, 0, 0)

    // Buscar ordens de producao dos ultimos 30 dias
    const orders = await prisma.productionOrder.findMany({
      where: {
        ...unitFilter,
        createdAt: { gte: dataInicio },
      },
      select: {
        quantidadePlanejada: true,
        quantidadeRealizada: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    // Agrupar por dia
    const grouped: Record<string, { planejado: number; realizado: number }> = {}

    for (const order of orders) {
      const key = order.createdAt.toISOString().split('T')[0]
      if (!grouped[key]) {
        grouped[key] = { planejado: 0, realizado: 0 }
      }
      grouped[key].planejado += order.quantidadePlanejada
      grouped[key].realizado += order.quantidadeRealizada || 0
    }

    const data = Object.entries(grouped).map(([label, values]) => ({
      label,
      planejado: values.planejado,
      realizado: values.realizado,
    }))

    return reply.send({ data })
  })

  // =====================================================
  // GET /charts/occurrences - Grafico de ocorrencias por tipo (ultimos 30 dias)
  // =====================================================
  app.get('/charts/occurrences', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const unitFilter = getUnitFilter(request)

    const dataInicio = new Date()
    dataInicio.setDate(dataInicio.getDate() - 30)
    dataInicio.setHours(0, 0, 0, 0)

    const result = await prisma.occurrence.groupBy({
      by: ['tipo'],
      where: {
        ...unitFilter,
        createdAt: { gte: dataInicio },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })

    const data = result.map((r) => ({
      label: r.tipo,
      valor: r._count.id,
    }))

    return reply.send({ data })
  })

  // =====================================================
  // GET /charts/checklists - Taxa de conclusao por unidade
  // =====================================================
  app.get('/charts/checklists', {
    preHandler: [requireUnit()],
  }, async (request, reply) => {
    const unitFilter = getUnitFilter(request)

    // Buscar execucoes agrupadas por unidade
    const executions = await prisma.checklistExecution.findMany({
      where: unitFilter,
      select: {
        status: true,
        unit: { select: { id: true, nome: true } },
      },
    })

    // Calcular taxa de conclusao por unidade
    const unitStats: Record<string, { nome: string; total: number; concluidos: number }> = {}

    for (const exec of executions) {
      const key = exec.unit.id
      if (!unitStats[key]) {
        unitStats[key] = { nome: exec.unit.nome, total: 0, concluidos: 0 }
      }
      unitStats[key].total++
      if (exec.status === 'concluido') {
        unitStats[key].concluidos++
      }
    }

    const data = Object.values(unitStats).map((stat) => ({
      label: stat.nome,
      valor: stat.total > 0 ? Math.round((stat.concluidos / stat.total) * 100) : 0,
    }))

    return reply.send({ data })
  })
}
