import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { requirePermission } from '../../../middlewares/auth.middleware'
import { createAuditLog } from '../../../lib/audit'

// ===================== SCHEMAS =====================

const escalSchema = z.object({
  colaboradorId: z.string().uuid(),
  horarioEntrada: z.string().regex(/^\d{2}:\d{2}$/),
  horarioSaida: z.string().regex(/^\d{2}:\d{2}$/),
  intervaloMinutos: z.number().int().min(0).default(60),
  diasSemana: z.array(z.enum(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'])).min(1),
  toleranciaMinutos: z.number().int().min(0).default(10),
})

const registroSchema = z.object({
  colaboradorId: z.string().uuid(),
  tipo: z.enum(['entrada', 'saida_almoco', 'retorno_almoco', 'saida', 'entrada_extra', 'saida_extra']),
  dataHora: z.string().datetime(),
  localizacao: z.string().optional(),
  dispositivo: z.string().optional(),
  foto: z.string().optional(),
  observacoes: z.string().optional(),
})

const ajusteSchema = z.object({
  colaboradorId: z.string().uuid(),
  data: z.string(), // YYYY-MM-DD
  tipo: z.enum(['entrada', 'saida_almoco', 'retorno_almoco', 'saida', 'entrada_extra', 'saida_extra']),
  dataHoraOriginal: z.string().datetime().optional(),
  dataHoraAjuste: z.string().datetime(),
  motivo: z.string().min(1),
})

const aprovarAjusteSchema = z.object({
  status: z.enum(['aprovado', 'rejeitado']),
  observacoes: z.string().optional(),
})

const ocorrenciaSchema = z.object({
  colaboradorId: z.string().uuid(),
  data: z.string(), // YYYY-MM-DD
  tipo: z.enum(['falta', 'atraso', 'saida_antecipada', 'hora_extra', 'falta_justificada', 'folga_compensatoria', 'afastamento']),
  minutosImpacto: z.number().int().default(0),
  justificativa: z.string().optional(),
  documentoUrl: z.string().optional(),
})

const fechamentoSchema = z.object({
  colaboradorId: z.string().uuid(),
  competencia: z.string().regex(/^\d{4}-\d{2}$/),
})

const listPontoQuery = z.object({
  colaboradorId: z.string().uuid().optional(),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
})

// ===================== HELPERS =====================

function calcMinutosTrabalhados(registros: any[]): number {
  const sorted = [...registros].sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())
  let total = 0
  let entrada: Date | null = null

  for (const reg of sorted) {
    const dt = new Date(reg.dataHora)
    if (reg.tipo === 'entrada' || reg.tipo === 'retorno_almoco' || reg.tipo === 'entrada_extra') {
      entrada = dt
    } else if (entrada && (reg.tipo === 'saida_almoco' || reg.tipo === 'saida' || reg.tipo === 'saida_extra')) {
      total += (dt.getTime() - entrada.getTime()) / 60000
      entrada = null
    }
  }
  return Math.round(total)
}

async function gerarResumoFechamento(colaboradorId: string, competencia: string) {
  const [ano, mes] = competencia.split('-').map(Number)
  const inicio = new Date(ano, mes - 1, 1)
  const fim = new Date(ano, mes, 0, 23, 59, 59)

  const [registros, ocorrencias, escala] = await Promise.all([
    prisma.registroPonto.findMany({
      where: { colaboradorId, dataHora: { gte: inicio, lte: fim }, status: { in: ['aprovado', 'ajustado'] } },
      orderBy: { dataHora: 'asc' },
    }),
    prisma.ocorrenciaPonto.findMany({
      where: { colaboradorId, data: { gte: inicio, lte: fim } },
    }),
    prisma.escalaPonto.findUnique({ where: { colaboradorId } }),
  ])

  // Agrupar por dia
  const diasMap = new Map<string, any[]>()
  for (const r of registros) {
    const dia = r.dataHora.toISOString().slice(0, 10)
    if (!diasMap.has(dia)) diasMap.set(dia, [])
    diasMap.get(dia)!.push(r)
  }

  let totalDiasTrabalhados = 0
  let totalMinutosTrabalhados = 0
  let totalMinutosExtras = 0
  let totalMinutosAtraso = 0
  let totalFaltas = 0

  const jornadaDiariaMinutos = escala
    ? (() => {
        const [eh, em] = escala.horarioEntrada.split(':').map(Number)
        const [sh, sm] = escala.horarioSaida.split(':').map(Number)
        return (sh * 60 + sm) - (eh * 60 + em) - escala.intervaloMinutos
      })()
    : 8 * 60

  diasMap.forEach((regs) => {
    const minutos = calcMinutosTrabalhados(regs)
    if (minutos > 0) {
      totalDiasTrabalhados++
      totalMinutosTrabalhados += minutos
      const diff = minutos - jornadaDiariaMinutos
      if (diff > 0) totalMinutosExtras += diff
      if (diff < 0) totalMinutosAtraso += Math.abs(diff)
    }
  })

  totalFaltas = ocorrencias.filter((o) => o.tipo === 'falta').length

  return {
    totalDiasTrabalhados,
    totalHorasTrabalhadas: parseFloat((totalMinutosTrabalhados / 60).toFixed(2)),
    totalHorasExtras: parseFloat((totalMinutosExtras / 60).toFixed(2)),
    totalAtrasos: parseFloat((totalMinutosAtraso / 60).toFixed(2)),
    totalFaltas,
    resumo: { jornadaDiariaMinutos, ocorrencias: ocorrencias.length, diasComRegistro: diasMap.size },
  }
}

// ===================== ROTAS =====================

export async function pontoRoutes(app: FastifyInstance) {
  // ============ ESCALA ============

  app.get('/escala/:colaboradorId', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'visualizar')],
  }, async (request, reply) => {
    const { colaboradorId } = request.params as { colaboradorId: string }
    const escala = await prisma.escalaPonto.findUnique({
      where: { colaboradorId },
      include: { colaborador: { select: { nome: true, matricula: true } } },
    })
    if (!escala) return reply.status(404).send({ error: 'Escala não configurada', code: 'NOT_FOUND' })
    return escala
  })

  app.post('/escala', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'gerenciar')],
  }, async (request, reply) => {
    const data = escalSchema.parse(request.body)

    const escala = await prisma.escalaPonto.upsert({
      where: { colaboradorId: data.colaboradorId },
      create: { ...data, diasSemana: data.diasSemana },
      update: { ...data, diasSemana: data.diasSemana },
    })

    await createAuditLog(request, 'upsert_escala', 'EscalaPonto', escala.id, data)
    return reply.status(201).send(escala)
  })

  // ============ REGISTROS ============

  app.get('/registros', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'visualizar')],
  }, async (request) => {
    const q = listPontoQuery.parse(request.query)
    const skip = (q.page - 1) * q.limit
    const where: any = {}

    if (q.colaboradorId) where.colaboradorId = q.colaboradorId
    if (q.status) where.status = q.status
    if (q.dataInicio || q.dataFim) {
      where.dataHora = {}
      if (q.dataInicio) where.dataHora.gte = new Date(q.dataInicio)
      if (q.dataFim) where.dataHora.lte = new Date(q.dataFim + 'T23:59:59')
    }

    const [items, total] = await Promise.all([
      prisma.registroPonto.findMany({
        where, skip, take: q.limit,
        orderBy: { dataHora: 'desc' },
        include: {
          colaborador: { select: { id: true, nome: true, matricula: true, unit: { select: { nome: true } } } },
        },
      }),
      prisma.registroPonto.count({ where }),
    ])

    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) }
  })

  // Espelho diário de um colaborador
  app.get('/registros/dia', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'visualizar')],
  }, async (request) => {
    const { colaboradorId, data } = request.query as { colaboradorId: string; data: string }
    const inicio = new Date(data + 'T00:00:00')
    const fim = new Date(data + 'T23:59:59')

    const [registros, escala] = await Promise.all([
      prisma.registroPonto.findMany({
        where: { colaboradorId, dataHora: { gte: inicio, lte: fim } },
        orderBy: { dataHora: 'asc' },
      }),
      prisma.escalaPonto.findUnique({ where: { colaboradorId } }),
    ])

    const minutosTrabalhados = calcMinutosTrabalhados(registros)
    return { registros, escala, minutosTrabalhados, horasTrabalhadas: parseFloat((minutosTrabalhados / 60).toFixed(2)) }
  })

  app.post('/registros', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'registrar')],
  }, async (request, reply) => {
    const data = registroSchema.parse(request.body)

    const registro = await prisma.registroPonto.create({
      data: {
        colaboradorId: data.colaboradorId,
        tipo: data.tipo,
        dataHora: new Date(data.dataHora),
        localizacao: data.localizacao,
        dispositivo: data.dispositivo,
        foto: data.foto,
        observacoes: data.observacoes,
        status: 'aprovado', // registro manual já aprovado
      },
      include: { colaborador: { select: { nome: true, matricula: true } } },
    })

    await createAuditLog(request, 'registrar_ponto', 'RegistroPonto', registro.id, data)
    return reply.status(201).send(registro)
  })

  // ============ AJUSTES ============

  app.get('/ajustes', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'visualizar')],
  }, async (request) => {
    const q = listPontoQuery.parse(request.query)
    const skip = (q.page - 1) * q.limit
    const where: any = {}
    if (q.colaboradorId) where.colaboradorId = q.colaboradorId
    if (q.status) where.status = q.status

    const [items, total] = await Promise.all([
      prisma.ajustePonto.findMany({
        where, skip, take: q.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          colaborador: { select: { id: true, nome: true, matricula: true } },
          aprovadoPor: { select: { id: true, nome: true } },
        },
      }),
      prisma.ajustePonto.count({ where }),
    ])

    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) }
  })

  app.post('/ajustes', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'ajustar')],
  }, async (request, reply) => {
    const data = ajusteSchema.parse(request.body)

    const ajuste = await prisma.ajustePonto.create({
      data: {
        colaboradorId: data.colaboradorId,
        data: new Date(data.data),
        tipo: data.tipo,
        dataHoraOriginal: data.dataHoraOriginal ? new Date(data.dataHoraOriginal) : null,
        dataHoraAjuste: new Date(data.dataHoraAjuste),
        motivo: data.motivo,
      },
    })

    await createAuditLog(request, 'criar_ajuste', 'AjustePonto', ajuste.id, data)
    return reply.status(201).send(ajuste)
  })

  app.patch('/ajustes/:id/aprovar', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'aprovar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user
    const data = aprovarAjusteSchema.parse(request.body)

    const ajuste = await prisma.ajustePonto.findUnique({ where: { id } })
    if (!ajuste) return reply.status(404).send({ error: 'Ajuste não encontrado', code: 'NOT_FOUND' })
    if (ajuste.status !== 'pendente') return reply.status(400).send({ error: 'Ajuste já processado', code: 'INVALID_STATUS' })

    await prisma.$transaction(async (tx) => {
      await tx.ajustePonto.update({
        where: { id },
        data: { status: data.status, aprovadoPorId: user.sub },
      })

      // Se aprovado, cria/atualiza o registro de ponto correspondente
      if (data.status === 'aprovado') {
        await tx.registroPonto.create({
          data: {
            colaboradorId: ajuste.colaboradorId,
            tipo: ajuste.tipo,
            dataHora: ajuste.dataHoraAjuste,
            observacoes: `Ajuste aprovado: ${ajuste.motivo}`,
            status: 'ajustado',
            ajusteId: ajuste.id,
          },
        })
      }
    })

    await createAuditLog(request, data.status === 'aprovado' ? 'aprovar_ajuste' : 'rejeitar_ajuste', 'AjustePonto', id, data)
    return { message: data.status === 'aprovado' ? 'Ajuste aprovado' : 'Ajuste rejeitado' }
  })

  // ============ OCORRÊNCIAS ============

  app.get('/ocorrencias', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'visualizar')],
  }, async (request) => {
    const q = listPontoQuery.parse(request.query)
    const skip = (q.page - 1) * q.limit
    const where: any = {}
    if (q.colaboradorId) where.colaboradorId = q.colaboradorId
    if (q.dataInicio || q.dataFim) {
      where.data = {}
      if (q.dataInicio) where.data.gte = new Date(q.dataInicio)
      if (q.dataFim) where.data.lte = new Date(q.dataFim)
    }

    const [items, total] = await Promise.all([
      prisma.ocorrenciaPonto.findMany({
        where, skip, take: q.limit,
        orderBy: { data: 'desc' },
        include: {
          colaborador: { select: { id: true, nome: true, matricula: true } },
        },
      }),
      prisma.ocorrenciaPonto.count({ where }),
    ])

    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) }
  })

  app.post('/ocorrencias', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'gerenciar')],
  }, async (request, reply) => {
    const data = ocorrenciaSchema.parse(request.body)

    const ocorrencia = await prisma.ocorrenciaPonto.create({
      data: {
        colaboradorId: data.colaboradorId,
        data: new Date(data.data),
        tipo: data.tipo,
        minutosImpacto: data.minutosImpacto,
        justificativa: data.justificativa,
        documentoUrl: data.documentoUrl,
      },
    })

    await createAuditLog(request, 'criar_ocorrencia_ponto', 'OcorrenciaPonto', ocorrencia.id, data)
    return reply.status(201).send(ocorrencia)
  })

  app.delete('/ocorrencias/:id', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'gerenciar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const item = await prisma.ocorrenciaPonto.findUnique({ where: { id } })
    if (!item) return reply.status(404).send({ error: 'Ocorrência não encontrada', code: 'NOT_FOUND' })
    await prisma.ocorrenciaPonto.delete({ where: { id } })
    return { message: 'Ocorrência excluída' }
  })

  // ============ FECHAMENTO ============

  app.get('/fechamento', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'visualizar')],
  }, async (request) => {
    const { colaboradorId, competencia } = request.query as { colaboradorId?: string; competencia?: string }
    const where: any = {}
    if (colaboradorId) where.colaboradorId = colaboradorId
    if (competencia) where.competencia = competencia

    const items = await prisma.fechamentoPonto.findMany({
      where,
      orderBy: [{ competencia: 'desc' }],
      include: {
        colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } } } },
        aprovadoPor: { select: { id: true, nome: true } },
      },
    })

    return items
  })

  // Gerar fechamento (calcula automaticamente)
  app.post('/fechamento/gerar', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'fechar')],
  }, async (request, reply) => {
    const data = fechamentoSchema.parse(request.body)

    // Verificar duplicidade
    const existing = await prisma.fechamentoPonto.findUnique({
      where: { colaboradorId_competencia: { colaboradorId: data.colaboradorId, competencia: data.competencia } },
    })
    if (existing && existing.status !== 'aberto') {
      return reply.status(409).send({ error: 'Fechamento já existe para este período', code: 'CONFLICT' })
    }

    const calc = await gerarResumoFechamento(data.colaboradorId, data.competencia)

    if (existing) {
      // Recalcular fechamento aberto
      const updated = await prisma.fechamentoPonto.update({
        where: { colaboradorId_competencia: { colaboradorId: data.colaboradorId, competencia: data.competencia } },
        data: { ...calc },
      })
      return updated
    }

    const fechamento = await prisma.fechamentoPonto.create({
      data: {
        colaboradorId: data.colaboradorId,
        competencia: data.competencia,
        ...calc,
      },
      include: {
        colaborador: { select: { nome: true, matricula: true } },
      },
    })

    await createAuditLog(request, 'gerar_fechamento', 'FechamentoPonto', fechamento.id, data)
    return reply.status(201).send(fechamento)
  })

  // Gerar fechamento em lote para todos os colaboradores de uma competência
  app.post('/fechamento/gerar-lote', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'fechar')],
  }, async (request, reply) => {
    const { competencia, unitId } = request.body as { competencia: string; unitId?: string }

    if (!competencia?.match(/^\d{4}-\d{2}$/)) {
      return reply.status(400).send({ error: 'Formato inválido. Use YYYY-MM', code: 'INVALID_FORMAT' })
    }

    const where: any = { status: 'ativo' }
    if (unitId) where.unitId = unitId

    const colaboradores = await prisma.colaborador.findMany({
      where,
      select: { id: true, nome: true },
    })

    let gerados = 0; let atualizados = 0

    for (const col of colaboradores) {
      const calc = await gerarResumoFechamento(col.id, competencia)
      const existing = await prisma.fechamentoPonto.findUnique({
        where: { colaboradorId_competencia: { colaboradorId: col.id, competencia } },
      })

      if (existing) {
        if (existing.status === 'aberto') {
          await prisma.fechamentoPonto.update({ where: { id: existing.id }, data: { ...calc } })
          atualizados++
        }
      } else {
        await prisma.fechamentoPonto.create({ data: { colaboradorId: col.id, competencia, ...calc } })
        gerados++
      }
    }

    await createAuditLog(request, 'gerar_fechamento_lote', 'FechamentoPonto', competencia, { gerados, atualizados })
    return { message: `${gerados} gerados, ${atualizados} atualizados`, gerados, atualizados }
  })

  // Fechar/Aprovar fechamento
  app.patch('/fechamento/:id/aprovar', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'aprovar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = (request as any).user

    const item = await prisma.fechamentoPonto.findUnique({ where: { id } })
    if (!item) return reply.status(404).send({ error: 'Fechamento não encontrado', code: 'NOT_FOUND' })
    if (item.status === 'aprovado') return reply.status(400).send({ error: 'Já aprovado', code: 'INVALID_STATUS' })

    const updated = await prisma.fechamentoPonto.update({
      where: { id },
      data: { status: 'aprovado', aprovadoPorId: user.sub, dataAprovacao: new Date() },
    })

    await createAuditLog(request, 'aprovar_fechamento', 'FechamentoPonto', id, {})
    return updated
  })

  // Dashboard de ponto — resumo do dia para todos os colaboradores
  app.get('/dashboard', {
    preHandler: [app.authenticate, requirePermission('rh_ponto', 'visualizar')],
  }, async (request) => {
    const { data = new Date().toISOString().slice(0, 10), unitId } = request.query as { data?: string; unitId?: string }
    const inicio = new Date(data + 'T00:00:00')
    const fim = new Date(data + 'T23:59:59')

    const where: any = { status: 'ativo' }
    if (unitId) where.unitId = unitId

    const colaboradores = await prisma.colaborador.findMany({
      where,
      select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } }, unit: { select: { nome: true } } },
    })

    const registrosDia = await prisma.registroPonto.findMany({
      where: { dataHora: { gte: inicio, lte: fim }, colaboradorId: { in: colaboradores.map((c) => c.id) } },
      orderBy: { dataHora: 'asc' },
    })

    const registrosPorColab = new Map<string, any[]>()
    for (const r of registrosDia) {
      if (!registrosPorColab.has(r.colaboradorId)) registrosPorColab.set(r.colaboradorId, [])
      registrosPorColab.get(r.colaboradorId)!.push(r)
    }

    const resultado = colaboradores.map((col) => {
      const regs = registrosPorColab.get(col.id) ?? []
      const ultimo = regs[regs.length - 1]
      const minutos = calcMinutosTrabalhados(regs)
      const emTrabalho = regs.length > 0 && ['entrada', 'retorno_almoco', 'entrada_extra'].includes(ultimo?.tipo)
      return {
        ...col,
        registros: regs.length,
        ultimoRegistro: ultimo ? { tipo: ultimo.tipo, dataHora: ultimo.dataHora } : null,
        emTrabalho,
        horasTrabalhadas: parseFloat((minutos / 60).toFixed(2)),
      }
    })

    const presentes = resultado.filter((r) => r.emTrabalho).length
    const ausentes = resultado.filter((r) => r.registros === 0).length

    return { data, colaboradores: resultado, presentes, ausentes, total: resultado.length }
  })
}
