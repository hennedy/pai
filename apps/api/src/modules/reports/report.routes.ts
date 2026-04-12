import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireRole, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'

// Schema base de filtros para relatorios
const reportQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  unitId: z.string().uuid('ID de unidade invalido').optional(),
  periodoInicio: z.coerce.date().optional(),
  periodoFim: z.coerce.date().optional(),
  format: z.enum(['json', 'csv']).optional().default('json'),
})

/**
 * Converte array de objetos para CSV.
 * Usa as chaves do primeiro item como cabecalho.
 */
function toCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0])
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h]
      // Escapar valores com virgula ou aspas
      const str = val === null || val === undefined ? '' : String(val)
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

/**
 * Monta filtro de periodo para campo createdAt.
 */
function buildPeriodFilter(periodoInicio?: Date, periodoFim?: Date) {
  if (!periodoInicio && !periodoFim) return {}
  const filter: any = {}
  if (periodoInicio) filter.gte = periodoInicio
  if (periodoFim) filter.lte = periodoFim
  return { createdAt: filter }
}

/**
 * Modulo de relatorios da API.
 * Registra rotas de relatorios com suporte a exportacao CSV.
 */
export async function reportRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticacao e role de gestao
  app.addHook('onRequest', authenticate)

  // =====================================================
  // GET /purchases - Relatorio de compras por ciclo/unidade/produto
  // =====================================================
  app.get('/purchases', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'administrativo'), requireUnit()],
  }, async (request, reply) => {
    const query = reportQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)
    const unitFilter = getUnitFilter(request)
    const periodFilter = buildPeriodFilter(query.periodoInicio, query.periodoFim)

    const where: any = { ...unitFilter, ...periodFilter }

    const [data, total] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        include: {
          product: { select: { id: true, nome: true, sku: true, unidadeMedida: true } },
          unit: { select: { id: true, nome: true, codigo: true } },
          cycle: { select: { id: true, titulo: true, status: true } },
          solicitadoPor: { select: { id: true, nome: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.purchaseRequest.count({ where }),
    ])

    // Exportar CSV se solicitado
    if (query.format === 'csv') {
      const csvData = data.map((r) => ({
        ciclo: r.cycle.titulo,
        unidade: r.unit.nome,
        produto: r.product.nome,
        sku: r.product.sku,
        quantidade: r.quantidade,
        unidade_medida: r.product.unidadeMedida,
        marca: r.marca || '',
        observacao: r.observacao || '',
        solicitado_por: r.solicitadoPor.nome,
        data: r.createdAt.toISOString(),
      }))

      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', 'attachment; filename="relatorio_compras.csv"')
      return reply.send(toCsv(csvData))
    }

    return reply.send({
      data,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
    })
  })

  // =====================================================
  // GET /stock - Relatorio de movimentacoes de estoque e saldos
  // =====================================================
  app.get('/stock', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'administrativo'), requireUnit()],
  }, async (request, reply) => {
    const query = reportQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)
    const unitFilter = getUnitFilter(request)
    const periodFilter = buildPeriodFilter(query.periodoInicio, query.periodoFim)

    const where: any = { ...unitFilter, ...periodFilter }

    const [data, total, losses] = await Promise.all([
      prisma.stockEntry.findMany({
        where,
        include: {
          product: { select: { id: true, nome: true, sku: true, unidadeMedida: true } },
          unit: { select: { id: true, nome: true, codigo: true } },
          responsavel: { select: { id: true, nome: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.stockEntry.count({ where }),
      // Total de perdas no periodo
      prisma.stockEntry.aggregate({
        where: { ...where, tipo: 'perda' },
        _sum: { quantidade: true },
        _count: { id: true },
      }),
    ])

    // Exportar CSV se solicitado
    if (query.format === 'csv') {
      const csvData = data.map((r) => ({
        produto: r.product.nome,
        sku: r.product.sku,
        unidade: r.unit.nome,
        tipo: r.tipo,
        quantidade: r.quantidade,
        lote: r.lote || '',
        motivo: r.motivo || '',
        responsavel: r.responsavel.nome,
        data: r.createdAt.toISOString(),
      }))

      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', 'attachment; filename="relatorio_estoque.csv"')
      return reply.send(toCsv(csvData))
    }

    return reply.send({
      data,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
      resumo: {
        totalPerdas: losses._sum.quantidade || 0,
        countPerdas: losses._count.id,
      },
    })
  })

  // =====================================================
  // GET /production - Relatorio planejado vs realizado por unidade/turno
  // =====================================================
  app.get('/production', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'supervisor'), requireUnit()],
  }, async (request, reply) => {
    const query = reportQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)
    const unitFilter = getUnitFilter(request)
    const periodFilter = buildPeriodFilter(query.periodoInicio, query.periodoFim)

    const where: any = { ...unitFilter, ...periodFilter }

    const [data, total] = await Promise.all([
      prisma.productionOrder.findMany({
        where,
        include: {
          unit: { select: { id: true, nome: true, codigo: true } },
          recipe: { select: { id: true, nome: true } },
          responsavel: { select: { id: true, nome: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.productionOrder.count({ where }),
    ])

    // Exportar CSV se solicitado
    if (query.format === 'csv') {
      const csvData = data.map((r) => ({
        unidade: r.unit.nome,
        receita: r.recipe.nome,
        turno: r.turno,
        status: r.status,
        planejado: r.quantidadePlanejada,
        realizado: r.quantidadeRealizada ?? '',
        responsavel: r.responsavel.nome,
        data: r.createdAt.toISOString(),
      }))

      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', 'attachment; filename="relatorio_producao.csv"')
      return reply.send(toCsv(csvData))
    }

    return reply.send({
      data,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
    })
  })

  // =====================================================
  // GET /checklists - Relatorio de taxa de conclusao por unidade/template
  // =====================================================
  app.get('/checklists', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'supervisor'), requireUnit()],
  }, async (request, reply) => {
    const query = reportQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)
    const unitFilter = getUnitFilter(request)

    const where: any = { ...unitFilter }

    // Filtro de periodo pelo campo 'data' do checklist
    if (query.periodoInicio || query.periodoFim) {
      where.data = {}
      if (query.periodoInicio) where.data.gte = query.periodoInicio
      if (query.periodoFim) where.data.lte = query.periodoFim
    }

    const [data, total, concluidos, totalExecutions] = await Promise.all([
      prisma.checklistExecution.findMany({
        where,
        include: {
          template: { select: { id: true, nome: true, setor: true } },
          unit: { select: { id: true, nome: true, codigo: true } },
          executadoPor: { select: { id: true, nome: true } },
        },
        skip,
        take,
        orderBy: { data: 'desc' },
      }),
      prisma.checklistExecution.count({ where }),
      prisma.checklistExecution.count({ where: { ...where, status: 'concluido' } }),
      prisma.checklistExecution.count({ where }),
    ])

    const taxaConclusao = totalExecutions > 0
      ? Math.round((concluidos / totalExecutions) * 100)
      : 0

    // Exportar CSV se solicitado
    if (query.format === 'csv') {
      const csvData = data.map((r) => ({
        template: r.template.nome,
        setor: r.template.setor || '',
        unidade: r.unit.nome,
        turno: r.turno,
        status: r.status,
        executado_por: r.executadoPor.nome,
        data: r.data.toISOString(),
      }))

      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', 'attachment; filename="relatorio_checklists.csv"')
      return reply.send(toCsv(csvData))
    }

    return reply.send({
      data,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
      resumo: {
        taxaConclusao,
        totalConcluidos: concluidos,
        totalExecutions,
      },
    })
  })

  // =====================================================
  // GET /occurrences - Relatorio de ocorrencias por tipo/setor/prioridade/status
  // =====================================================
  app.get('/occurrences', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'supervisor'), requireUnit()],
  }, async (request, reply) => {
    const extendedQuery = reportQuerySchema.extend({
      tipo: z.enum(['operacional', 'equipamento', 'pessoal', 'qualidade', 'seguranca', 'outro']).optional(),
      setor: z.string().optional(),
      prioridade: z.enum(['baixa', 'media', 'alta', 'critica']).optional(),
      status: z.enum(['aberta', 'em_andamento', 'resolvida', 'encerrada']).optional(),
    })

    const query = extendedQuery.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)
    const unitFilter = getUnitFilter(request)
    const periodFilter = buildPeriodFilter(query.periodoInicio, query.periodoFim)

    const where: any = { ...unitFilter, ...periodFilter }

    if (query.tipo) where.tipo = query.tipo
    if (query.setor) where.setor = { contains: query.setor, mode: 'insensitive' }
    if (query.prioridade) where.prioridade = query.prioridade
    if (query.status) where.status = query.status

    const [data, total] = await Promise.all([
      prisma.occurrence.findMany({
        where,
        include: {
          unit: { select: { id: true, nome: true, codigo: true } },
          criadoPor: { select: { id: true, nome: true } },
          responsavel: { select: { id: true, nome: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.occurrence.count({ where }),
    ])

    // Exportar CSV se solicitado
    if (query.format === 'csv') {
      const csvData = data.map((r) => ({
        titulo: r.titulo,
        tipo: r.tipo,
        setor: r.setor || '',
        prioridade: r.prioridade,
        status: r.status,
        unidade: r.unit.nome,
        criado_por: r.criadoPor.nome,
        responsavel: r.responsavel?.nome || '',
        data: r.createdAt.toISOString(),
      }))

      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', 'attachment; filename="relatorio_ocorrencias.csv"')
      return reply.send(toCsv(csvData))
    }

    return reply.send({
      data,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
    })
  })
}
