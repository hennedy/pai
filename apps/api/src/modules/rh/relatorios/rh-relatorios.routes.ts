import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { requirePermission } from '../../../middlewares/auth.middleware'

const periodoQuery = z.object({
  de: z.string().optional(),   // YYYY-MM-DD
  ate: z.string().optional(),  // YYYY-MM-DD
  unitId: z.string().uuid().optional(),
})

export async function rhRelatoriosRoutes(app: FastifyInstance) {
  // ── Resumo geral (dashboard) ──────────────────────────────────────────────
  app.get('/resumo', {
    preHandler: [app.authenticate, requirePermission('rh_relatorios', 'visualizar')],
  }, async (request) => {
    const { unitId } = periodoQuery.parse(request.query)
    const where: any = unitId ? { unitId } : {}
    const now = new Date()
    const limite30d = new Date(now.getTime() - 30 * 86400000)
    const limite60d = new Date(now.getTime() + 60 * 86400000)

    const [
      totalAtivos, totalInativos, totalFerias, totalAfastados,
      admissoesUltimos30, desligamentosUltimos30,
      examesVencendo, examesInaptos,
      ajustesPendentes, fechamentosPendentes,
    ] = await Promise.all([
      prisma.colaborador.count({ where: { ...where, status: 'ativo' } }),
      prisma.colaborador.count({ where: { ...where, status: 'inativo' } }),
      prisma.colaborador.count({ where: { ...where, status: 'ferias' } }),
      prisma.colaborador.count({ where: { ...where, status: 'afastado' } }),
      prisma.colaborador.count({ where: { ...where, dataAdmissao: { gte: limite30d } } }),
      prisma.colaborador.count({ where: { ...where, dataDemissao: { gte: limite30d } } }),
      prisma.exameOcupacional.count({
        where: { status: 'realizado', dataVencimento: { lte: limite60d, gte: now } },
      }),
      prisma.exameOcupacional.count({
        where: { resultado: 'inapto', status: 'realizado' },
      }),
      prisma.ajustePonto.count({ where: { status: 'pendente' } }),
      prisma.fechamentoPonto.count({ where: { status: 'fechado' } }),
    ])

    return {
      headcount: { ativos: totalAtivos, inativos: totalInativos, ferias: totalFerias, afastados: totalAfastados },
      movimentacao30d: { admissoes: admissoesUltimos30, desligamentos: desligamentosUltimos30 },
      alertas: { examesVencendo, examesInaptos, ajustesPendentes, fechamentosPendentes },
    }
  })

  // ── Headcount por período ────────────────────────────────────────────────
  app.get('/headcount', {
    preHandler: [app.authenticate, requirePermission('rh_relatorios', 'visualizar')],
  }, async (request) => {
    const { unitId } = periodoQuery.parse(request.query)
    const where: any = unitId ? { unitId } : {}

    const [porStatus, porTipoContrato, porUnidade, porCargo] = await Promise.all([
      prisma.colaborador.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      prisma.colaborador.groupBy({
        by: ['tipoContrato'],
        where: { ...where, status: 'ativo' },
        _count: { id: true },
      }),
      // Por unidade com nome
      prisma.unit.findMany({
        select: {
          id: true, nome: true,
          _count: { select: { colaboradores: { where: { status: 'ativo' } } } },
        },
      }),
      // Top 10 cargos por headcount
      prisma.cargo.findMany({
        select: {
          id: true, nome: true,
          _count: { select: { colaboradores: { where: { status: 'ativo' } } } },
        },
        orderBy: { colaboradores: { _count: 'desc' } },
        take: 10,
      }),
    ])

    return { porStatus, porTipoContrato, porUnidade, porCargo }
  })

  // ── Turnover ─────────────────────────────────────────────────────────────
  app.get('/turnover', {
    preHandler: [app.authenticate, requirePermission('rh_relatorios', 'visualizar')],
  }, async (request) => {
    const { de, ate, unitId } = periodoQuery.parse(request.query)
    const now = new Date()
    const dataInicio = de ? new Date(de) : new Date(now.getFullYear(), 0, 1)
    const dataFim = ate ? new Date(ate) : now
    const where: any = unitId ? { unitId } : {}

    // Admissões mês a mês
    const admissoes = await prisma.colaborador.findMany({
      where: {
        ...where,
        dataAdmissao: { gte: dataInicio, lte: dataFim },
      },
      select: { dataAdmissao: true, tipoContrato: true },
      orderBy: { dataAdmissao: 'asc' },
    })

    // Desligamentos mês a mês
    const desligamentos = await prisma.colaborador.findMany({
      where: {
        ...where,
        dataDemissao: { gte: dataInicio, lte: dataFim },
      },
      select: { dataDemissao: true, tipoContrato: true },
      orderBy: { dataDemissao: 'asc' },
    })

    // Agrupa por mês (YYYY-MM)
    function agruparPorMes(items: { dataAdmissao?: Date | null; dataDemissao?: Date | null }[], campo: 'dataAdmissao' | 'dataDemissao') {
      const map: Record<string, number> = {}
      items.forEach((item) => {
        const d = item[campo]
        if (!d) return
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        map[key] = (map[key] ?? 0) + 1
      })
      return map
    }

    const admissoesPorMes = agruparPorMes(admissoes as any, 'dataAdmissao')
    const desligamentosPorMes = agruparPorMes(desligamentos as any, 'dataDemissao')

    // Tipos de desligamento
    const tiposDesligamento = await prisma.processoDesligamento.groupBy({
      by: ['tipo'],
      where: { createdAt: { gte: dataInicio, lte: dataFim } },
      _count: { id: true },
    })

    const totalAtivos = await prisma.colaborador.count({ where: { ...where, status: 'ativo' } })
    const totalDesligados = desligamentos.length
    const taxaTurnover = totalAtivos > 0 ? ((totalDesligados / totalAtivos) * 100).toFixed(1) : '0.0'

    return {
      periodo: { de: dataInicio, ate: dataFim },
      admissoes: admissoesPorMes,
      desligamentos: desligamentosPorMes,
      tiposDesligamento,
      taxaTurnover: `${taxaTurnover}%`,
      totalAdmissoes: admissoes.length,
      totalDesligamentos: desligamentos.length,
    }
  })

  // ── Absenteísmo ──────────────────────────────────────────────────────────
  app.get('/absenteismo', {
    preHandler: [app.authenticate, requirePermission('rh_relatorios', 'visualizar')],
  }, async (request) => {
    const { de, ate, unitId } = periodoQuery.parse(request.query)
    const now = new Date()
    const dataInicio = de ? new Date(de) : new Date(now.getFullYear(), now.getMonth(), 1)
    const dataFim = ate ? new Date(ate) : now

    const [porTipo, topColaboradores, totalOcorrencias] = await Promise.all([
      prisma.ocorrenciaPonto.groupBy({
        by: ['tipo'],
        where: { data: { gte: dataInicio, lte: dataFim } },
        _count: { id: true },
        _sum: { minutosImpacto: true },
      }),
      // Top 10 colaboradores com mais ocorrências
      prisma.ocorrenciaPonto.groupBy({
        by: ['colaboradorId'],
        where: { data: { gte: dataInicio, lte: dataFim } },
        _count: { id: true },
        _sum: { minutosImpacto: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.ocorrenciaPonto.count({
        where: { data: { gte: dataInicio, lte: dataFim } },
      }),
    ])

    // Enriquece colaboradores com nome
    const colabIds = topColaboradores.map((c) => c.colaboradorId)
    const colabs = await prisma.colaborador.findMany({
      where: { id: { in: colabIds } },
      select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } } },
    })
    const colabMap = Object.fromEntries(colabs.map((c) => [c.id, c]))

    const topEnriquecido = topColaboradores.map((c) => ({
      ...c,
      colaborador: colabMap[c.colaboradorId] ?? null,
    }))

    return {
      periodo: { de: dataInicio, ate: dataFim },
      porTipo,
      topColaboradores: topEnriquecido,
      totalOcorrencias,
    }
  })

  // ── Desempenho ───────────────────────────────────────────────────────────
  app.get('/desempenho', {
    preHandler: [app.authenticate, requirePermission('rh_relatorios', 'visualizar')],
  }, async (request) => {
    const { cicloId } = z.object({ cicloId: z.string().uuid().optional() }).parse(request.query)
    const where: any = { status: 'concluida' }
    if (cicloId) where.cicloId = cicloId

    const [porTipo, concluidas, pendentes, mediaPontuacao] = await Promise.all([
      prisma.avaliacaoDesempenho.groupBy({
        by: ['tipo'],
        where,
        _count: { id: true },
        _avg: { pontuacaoTotal: true },
      }),
      prisma.avaliacaoDesempenho.count({ where }),
      prisma.avaliacaoDesempenho.count({ where: { status: 'pendente', ...(cicloId ? { cicloId } : {}) } }),
      prisma.avaliacaoDesempenho.aggregate({
        where,
        _avg: { pontuacaoTotal: true },
      }),
    ])

    const [metasStatus, cicloAtivo] = await Promise.all([
      prisma.metaColaborador.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.cicloAvaliacao.findFirst({
        where: { status: 'em_andamento' },
        select: { id: true, nome: true, periodoRef: true, dataInicio: true, dataFim: true },
      }),
    ])

    return {
      cicloAtivo,
      avaliacoes: { porTipo, concluidas, pendentes, mediaPontuacao: mediaPontuacao._avg.pontuacaoTotal },
      metas: metasStatus,
    }
  })

  // ── Benefícios ───────────────────────────────────────────────────────────
  app.get('/beneficios', {
    preHandler: [app.authenticate, requirePermission('rh_relatorios', 'visualizar')],
  }, async () => {
    const [porTipo, custoTotal, adesao] = await Promise.all([
      prisma.beneficio.findMany({
        select: {
          id: true, nome: true, tipo: true,
          _count: { select: { colaboradores: { where: { status: 'ativo' } } } },
        },
        orderBy: { colaboradores: { _count: 'desc' } },
      }),
      prisma.beneficioColaborador.aggregate({
        where: { status: 'ativo' },
        _sum: { valorMensal: true },
      }),
      prisma.beneficioColaborador.count({ where: { status: 'ativo' } }),
    ])

    return {
      porBeneficio: porTipo,
      custoTotal: {
        colaborador: custoTotal._sum?.valorMensal ?? 0,
        empresa: 0,
      },
      totalAdesoes: adesao,
    }
  })

  // ── Folha de pagamento (resumo holerites) ─────────────────────────────────
  app.get('/folha', {
    preHandler: [app.authenticate, requirePermission('rh_relatorios', 'visualizar')],
  }, async (request) => {
    const { competencia } = z.object({
      competencia: z.string().optional(),
    }).parse(request.query)

    const now = new Date()
    const comp = competencia ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const [resumo, ultimas6] = await Promise.all([
      prisma.holerite.aggregate({
        where: { competencia: comp },
        _sum: { salarioBruto: true, salarioLiquido: true },
        _count: { id: true },
        _avg: { salarioBruto: true, salarioLiquido: true },
      }),
      // Últimas 6 competências com total
      prisma.holerite.groupBy({
        by: ['competencia'],
        _sum: { salarioBruto: true, salarioLiquido: true },
        _count: { id: true },
        orderBy: { competencia: 'desc' },
        take: 6,
      }),
    ])

    return {
      competencia: comp,
      resumo: {
        totalBruto: resumo._sum?.salarioBruto ?? 0,
        totalLiquido: resumo._sum?.salarioLiquido ?? 0,
        totalDescontos: 0,
        totalProventos: 0,
        qtdHolerites: resumo._count?.id ?? 0,
        mediaBruto: resumo._avg?.salarioBruto ?? 0,
      },
      historico: ultimas6.map((h) => ({
        competencia: h.competencia,
        totalBruto: h._sum.salarioBruto ?? 0,
        totalLiquido: h._sum.salarioLiquido ?? 0,
        qtd: h._count.id,
      })),
    }
  })
}
