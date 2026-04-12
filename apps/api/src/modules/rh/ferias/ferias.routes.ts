import { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { requirePermission } from '../../../middlewares/auth.middleware'
import { createAuditLog } from '../../../lib/audit'
import {
  criarPeriodoAquisitivoSchema,
  solicitarFeriasSchema,
  aprovarFeriasSchema,
  reprovarFeriasSchema,
  feriasIdParamSchema,
  periodoIdParamSchema,
  listFeriasQuerySchema,
  listPeriodosQuerySchema,
} from './ferias.schemas'

// Gera períodos aquisitivos automaticamente com base na admissão
async function gerarPeriodosAquisitivos(colaboradorId: string, dataAdmissao: Date) {
  const hoje = new Date()
  const periods = []
  let inicio = new Date(dataAdmissao)
  let numero = 1

  while (inicio < hoje) {
    const fim = new Date(inicio)
    fim.setFullYear(fim.getFullYear() + 1)
    fim.setDate(fim.getDate() - 1)

    const diasAteVencer = Math.floor((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))

    let status: 'em_curso' | 'adquirido' | 'vencendo' | 'vencido' = 'em_curso'
    if (fim < hoje) {
      status = diasAteVencer < -365 ? 'vencido' : 'adquirido'
    } else if (diasAteVencer <= 60) {
      status = 'vencendo'
    }

    periods.push({ colaboradorId, numero, dataInicio: new Date(inicio), dataFim: new Date(fim), status })
    inicio = new Date(fim)
    inicio.setDate(inicio.getDate() + 1)
    numero++
  }

  return periods
}

export async function feriasRoutes(app: FastifyInstance) {
  // ============ PERÍODOS AQUISITIVOS ============

  // Listar períodos de um colaborador
  app.get('/periodos', {
    preHandler: [app.authenticate, requirePermission('rh_ferias', 'visualizar')],
  }, async (request, reply) => {
    const query = listPeriodosQuerySchema.parse(request.query)
    const where: any = {}
    if (query.colaboradorId) where.colaboradorId = query.colaboradorId
    if (query.status) where.status = query.status

    const periodos = await prisma.periodoAquisitivo.findMany({
      where,
      orderBy: [{ colaboradorId: 'asc' }, { numero: 'asc' }],
      include: {
        colaborador: { select: { id: true, nome: true, matricula: true } },
        ferias: { select: { id: true, status: true, dataInicio: true, dataFim: true, diasSolicitados: true } },
      },
    })

    return periodos
  })

  // Gerar períodos automaticamente para um colaborador
  app.post('/periodos/gerar', {
    preHandler: [app.authenticate, requirePermission('rh_ferias', 'criar')],
  }, async (request, reply) => {
    const { colaboradorId } = request.body as { colaboradorId: string }

    const colaborador = await prisma.colaborador.findUnique({ where: { id: colaboradorId } })
    if (!colaborador) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })
    if (!colaborador.dataAdmissao) return reply.status(400).send({ error: 'Colaborador não possui data de admissão', code: 'NO_ADMISSION_DATE' })

    const periods = await gerarPeriodosAquisitivos(colaboradorId, colaborador.dataAdmissao)

    // Inserir apenas períodos que ainda não existem
    const existentes = await prisma.periodoAquisitivo.findMany({ where: { colaboradorId }, select: { numero: true } })
    const numerosExistentes = new Set(existentes.map((p) => p.numero))
    const novos = periods.filter((p) => !numerosExistentes.has(p.numero))

    if (novos.length === 0) return { message: 'Todos os períodos já estão gerados', periodos: existentes.length }

    await prisma.periodoAquisitivo.createMany({ data: novos })
    await createAuditLog(request, 'gerar_periodos', 'PeriodoAquisitivo', colaboradorId, { total: novos.length })

    return { message: `${novos.length} período(s) gerado(s)`, total: novos.length }
  })

  // Criar período manualmente
  app.post('/periodos', {
    preHandler: [app.authenticate, requirePermission('rh_ferias', 'criar')],
  }, async (request, reply) => {
    const data = criarPeriodoAquisitivoSchema.parse(request.body)

    const existing = await prisma.periodoAquisitivo.findUnique({
      where: { colaboradorId_numero: { colaboradorId: data.colaboradorId, numero: data.numero } },
    })
    if (existing) return reply.status(409).send({ error: 'Período já existe', code: 'CONFLICT' })

    const periodo = await prisma.periodoAquisitivo.create({
      data: {
        colaboradorId: data.colaboradorId,
        numero: data.numero,
        dataInicio: new Date(data.dataInicio),
        dataFim: new Date(data.dataFim),
      },
    })

    return reply.status(201).send(periodo)
  })

  // ============ FÉRIAS ============

  // Listar férias
  app.get('/', {
    preHandler: [app.authenticate, requirePermission('rh_ferias', 'visualizar')],
  }, async (request, reply) => {
    const query = listFeriasQuerySchema.parse(request.query)
    const skip = (query.page - 1) * query.limit

    const where: any = {}
    if (query.status) where.status = query.status
    if (query.colaboradorId) where.colaboradorId = query.colaboradorId
    if (query.search) {
      where.colaborador = { nome: { contains: query.search, mode: 'insensitive' } }
    }

    const [items, total] = await Promise.all([
      prisma.ferias.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } }, unit: { select: { nome: true } } } },
          periodoAquisitivo: { select: { numero: true, dataInicio: true, dataFim: true } },
          solicitadoPor: { select: { id: true, nome: true } },
          aprovadoPor: { select: { id: true, nome: true } },
        },
      }),
      prisma.ferias.count({ where }),
    ])

    return { items, total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) }
  })

  // Buscar por ID
  app.get('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_ferias', 'visualizar')],
  }, async (request, reply) => {
    const { id } = feriasIdParamSchema.parse(request.params)

    const ferias = await prisma.ferias.findUnique({
      where: { id },
      include: {
        colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } }, unit: { select: { nome: true } } } },
        periodoAquisitivo: true,
        solicitadoPor: { select: { id: true, nome: true } },
        aprovadoPor: { select: { id: true, nome: true } },
      },
    })

    if (!ferias) return reply.status(404).send({ error: 'Férias não encontradas', code: 'NOT_FOUND' })

    return ferias
  })

  // Solicitar férias
  app.post('/', {
    preHandler: [app.authenticate, requirePermission('rh_ferias', 'criar')],
  }, async (request, reply) => {
    const user = (request as any).user
    const data = solicitarFeriasSchema.parse(request.body)

    // Verificar período aquisitivo
    const periodo = await prisma.periodoAquisitivo.findUnique({ where: { id: data.periodoAquisitivoId } })
    if (!periodo) return reply.status(404).send({ error: 'Período aquisitivo não encontrado', code: 'NOT_FOUND' })
    if (periodo.colaboradorId !== data.colaboradorId) {
      return reply.status(400).send({ error: 'Período não pertence a este colaborador', code: 'INVALID_PERIOD' })
    }

    // Verificar saldo
    const diasJaSolicitados = await prisma.ferias.aggregate({
      where: {
        periodoAquisitivoId: data.periodoAquisitivoId,
        status: { notIn: ['reprovado', 'cancelado'] },
      },
      _sum: { diasSolicitados: true },
    })
    const saldoUsado = (diasJaSolicitados._sum.diasSolicitados ?? 0) + data.abonoPecuniario
    const saldoDisponivel = periodo.diasDisponiveis - saldoUsado

    if (data.diasSolicitados > saldoDisponivel) {
      return reply.status(400).send({
        error: `Saldo insuficiente. Disponível: ${saldoDisponivel} dias`,
        code: 'INSUFFICIENT_BALANCE',
      })
    }

    // Verificar abono pecuniário (máximo 1/3 das férias)
    if (data.abonoPecuniario > Math.floor(data.diasSolicitados / 3)) {
      return reply.status(400).send({
        error: 'Abono pecuniário não pode exceder 1/3 dos dias de férias',
        code: 'INVALID_ABONO',
      })
    }

    const ferias = await prisma.ferias.create({
      data: {
        colaboradorId: data.colaboradorId,
        periodoAquisitivoId: data.periodoAquisitivoId,
        dataInicio: new Date(data.dataInicio),
        dataFim: new Date(data.dataFim),
        diasSolicitados: data.diasSolicitados,
        abonoPecuniario: data.abonoPecuniario,
        observacoes: data.observacoes,
        solicitadoPorId: user.sub,
      },
      include: {
        colaborador: { select: { nome: true, matricula: true } },
      },
    })

    await createAuditLog(request, 'solicitar', 'Ferias', ferias.id, data)
    return reply.status(201).send(ferias)
  })

  // Aprovar
  app.patch('/:id/aprovar', {
    preHandler: [app.authenticate, requirePermission('rh_ferias', 'aprovar')],
  }, async (request, reply) => {
    const { id } = feriasIdParamSchema.parse(request.params)
    const user = (request as any).user
    const data = aprovarFeriasSchema.parse(request.body)

    const ferias = await prisma.ferias.findUnique({ where: { id } })
    if (!ferias) return reply.status(404).send({ error: 'Férias não encontradas', code: 'NOT_FOUND' })
    if (ferias.status !== 'solicitado') {
      return reply.status(400).send({ error: 'Férias não estão aguardando aprovação', code: 'INVALID_STATUS' })
    }

    await prisma.$transaction([
      prisma.ferias.update({
        where: { id },
        data: {
          status: 'aprovado',
          aprovadoPorId: user.sub,
          dataAprovacao: new Date(),
          observacoes: data.observacoes ?? ferias.observacoes,
        },
      }),
      prisma.periodoAquisitivo.update({
        where: { id: ferias.periodoAquisitivoId },
        data: {
          diasGozados: { increment: ferias.diasSolicitados },
          diasVendidos: { increment: ferias.abonoPecuniario },
        },
      }),
    ])

    await createAuditLog(request, 'aprovar', 'Ferias', id, data)
    return { message: 'Férias aprovadas' }
  })

  // Reprovar
  app.patch('/:id/reprovar', {
    preHandler: [app.authenticate, requirePermission('rh_ferias', 'reprovar')],
  }, async (request, reply) => {
    const { id } = feriasIdParamSchema.parse(request.params)
    const data = reprovarFeriasSchema.parse(request.body)

    const ferias = await prisma.ferias.findUnique({ where: { id } })
    if (!ferias) return reply.status(404).send({ error: 'Férias não encontradas', code: 'NOT_FOUND' })
    if (ferias.status !== 'solicitado') {
      return reply.status(400).send({ error: 'Apenas férias com status "solicitado" podem ser reprovadas', code: 'INVALID_STATUS' })
    }

    await prisma.ferias.update({
      where: { id },
      data: { status: 'reprovado', motivoReprovacao: data.motivoReprovacao },
    })

    await createAuditLog(request, 'reprovar', 'Ferias', id, data)
    return { message: 'Férias reprovadas' }
  })

  // Iniciar gozo (marcar como gozando)
  app.patch('/:id/iniciar', {
    preHandler: [app.authenticate, requirePermission('rh_ferias', 'aprovar')],
  }, async (request, reply) => {
    const { id } = feriasIdParamSchema.parse(request.params)

    const ferias = await prisma.ferias.findUnique({ where: { id } })
    if (!ferias) return reply.status(404).send({ error: 'Férias não encontradas', code: 'NOT_FOUND' })
    if (!['aprovado', 'programado'].includes(ferias.status)) {
      return reply.status(400).send({ error: 'Férias não estão aprovadas ou programadas', code: 'INVALID_STATUS' })
    }

    await prisma.$transaction([
      prisma.ferias.update({ where: { id }, data: { status: 'gozando' } }),
      prisma.colaborador.update({ where: { id: ferias.colaboradorId }, data: { status: 'ferias' } }),
    ])

    await createAuditLog(request, 'iniciar_gozo', 'Ferias', id, {})
    return { message: 'Férias iniciadas' }
  })

  // Concluir gozo
  app.patch('/:id/concluir', {
    preHandler: [app.authenticate, requirePermission('rh_ferias', 'aprovar')],
  }, async (request, reply) => {
    const { id } = feriasIdParamSchema.parse(request.params)

    const ferias = await prisma.ferias.findUnique({ where: { id } })
    if (!ferias) return reply.status(404).send({ error: 'Férias não encontradas', code: 'NOT_FOUND' })
    if (ferias.status !== 'gozando') {
      return reply.status(400).send({ error: 'Férias não estão em gozo', code: 'INVALID_STATUS' })
    }

    await prisma.$transaction([
      prisma.ferias.update({ where: { id }, data: { status: 'concluido' } }),
      prisma.colaborador.update({ where: { id: ferias.colaboradorId }, data: { status: 'ativo' } }),
    ])

    await createAuditLog(request, 'concluir_gozo', 'Ferias', id, {})
    return { message: 'Férias concluídas. Colaborador retornou ao ativo.' }
  })

  // Cancelar
  app.patch('/:id/cancelar', {
    preHandler: [app.authenticate, requirePermission('rh_ferias', 'cancelar')],
  }, async (request, reply) => {
    const { id } = feriasIdParamSchema.parse(request.params)

    const ferias = await prisma.ferias.findUnique({ where: { id } })
    if (!ferias) return reply.status(404).send({ error: 'Férias não encontradas', code: 'NOT_FOUND' })
    if (['concluido', 'cancelado'].includes(ferias.status)) {
      return reply.status(400).send({ error: 'Férias não podem ser canceladas no status atual', code: 'INVALID_STATUS' })
    }

    // Se estavam aprovadas, estornar o saldo
    const updates: any[] = [prisma.ferias.update({ where: { id }, data: { status: 'cancelado' } })]
    if (['aprovado', 'programado', 'gozando'].includes(ferias.status)) {
      updates.push(prisma.periodoAquisitivo.update({
        where: { id: ferias.periodoAquisitivoId },
        data: {
          diasGozados: { decrement: ferias.diasSolicitados },
          diasVendidos: { decrement: ferias.abonoPecuniario },
        },
      }))
    }
    if (ferias.status === 'gozando') {
      updates.push(prisma.colaborador.update({ where: { id: ferias.colaboradorId }, data: { status: 'ativo' } }))
    }

    await prisma.$transaction(updates)
    await createAuditLog(request, 'cancelar', 'Ferias', id, {})
    return { message: 'Férias canceladas' }
  })
}
