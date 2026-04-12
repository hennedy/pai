import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { requirePermission } from '../../../middlewares/auth.middleware'
import { createAuditLog } from '../../../lib/audit'

const createSchema = z.object({
  colaboradorId: z.string().uuid(),
  tipo: z.enum(['admissional', 'periodico', 'retorno_trabalho', 'mudanca_funcao', 'demissional']),
  dataExame: z.string().datetime(),
  dataVencimento: z.string().datetime().optional(),
  medico: z.string().optional(),
  crmMedico: z.string().optional(),
  resultado: z.enum(['apto', 'apto_com_restricoes', 'inapto']).optional(),
  restricoes: z.string().optional(),
  observacoes: z.string().optional(),
  arquivoUrl: z.string().optional(),
})

const updateSchema = z.object({
  dataExame: z.string().datetime().optional(),
  dataVencimento: z.string().datetime().optional().nullable(),
  medico: z.string().optional(),
  crmMedico: z.string().optional(),
  resultado: z.enum(['apto', 'apto_com_restricoes', 'inapto']).optional().nullable(),
  restricoes: z.string().optional(),
  observacoes: z.string().optional(),
  arquivoUrl: z.string().optional(),
  status: z.enum(['agendado', 'realizado', 'vencido', 'cancelado']).optional(),
})

const listQuery = z.object({
  colaboradorId: z.string().uuid().optional(),
  tipo: z.string().optional(),
  resultado: z.string().optional(),
  status: z.string().optional(),
  vencendoEm: z.coerce.number().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(30),
})

export async function asoRoutes(app: FastifyInstance) {
  // Listar
  app.get('/', {
    preHandler: [app.authenticate, requirePermission('rh_aso', 'visualizar')],
  }, async (request) => {
    const q = listQuery.parse(request.query)
    const skip = (q.page - 1) * q.limit
    const where: any = {}
    if (q.colaboradorId) where.colaboradorId = q.colaboradorId
    if (q.tipo) where.tipo = q.tipo
    if (q.resultado) where.resultado = q.resultado
    if (q.status) where.status = q.status
    if (q.vencendoEm) {
      const limite = new Date()
      limite.setDate(limite.getDate() + q.vencendoEm)
      where.dataVencimento = { lte: limite, gte: new Date() }
      where.status = 'realizado'
    }

    const [items, total] = await Promise.all([
      prisma.exameOcupacional.findMany({
        where, skip, take: q.limit,
        orderBy: { dataExame: 'desc' },
        include: {
          colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } }, unit: { select: { nome: true } } } },
          agendadoPor: { select: { id: true, nome: true } },
        },
      }),
      prisma.exameOcupacional.count({ where }),
    ])

    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) }
  })

  // Buscar por ID
  app.get('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_aso', 'visualizar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const exame = await prisma.exameOcupacional.findUnique({
      where: { id },
      include: {
        colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } }, unit: { select: { nome: true } } } },
        agendadoPor: { select: { id: true, nome: true } },
      },
    })
    if (!exame) return reply.status(404).send({ error: 'Exame não encontrado', code: 'NOT_FOUND' })
    return exame
  })

  // Criar / Agendar
  app.post('/', {
    preHandler: [app.authenticate, requirePermission('rh_aso', 'criar')],
  }, async (request, reply) => {
    const user = (request as any).user
    const data = createSchema.parse(request.body)

    const exame = await prisma.exameOcupacional.create({
      data: {
        colaboradorId: data.colaboradorId,
        tipo: data.tipo,
        dataExame: new Date(data.dataExame),
        dataVencimento: data.dataVencimento ? new Date(data.dataVencimento) : null,
        medico: data.medico,
        crmMedico: data.crmMedico,
        resultado: data.resultado ?? null,
        restricoes: data.restricoes,
        observacoes: data.observacoes,
        arquivoUrl: data.arquivoUrl,
        status: data.resultado ? 'realizado' : 'agendado',
        agendadoPorId: user.sub,
      },
      include: {
        colaborador: { select: { nome: true, matricula: true } },
      },
    })

    await createAuditLog(request, 'criar', 'ExameOcupacional', exame.id, data)
    return reply.status(201).send(exame)
  })

  // Atualizar
  app.put('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_aso', 'editar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = updateSchema.parse(request.body)

    const exame = await prisma.exameOcupacional.findUnique({ where: { id } })
    if (!exame) return reply.status(404).send({ error: 'Exame não encontrado', code: 'NOT_FOUND' })

    // Auto-status: se resultado definido → realizado
    let status = data.status ?? exame.status
    if (data.resultado && !data.status) status = 'realizado'

    const updated = await prisma.exameOcupacional.update({
      where: { id },
      data: {
        dataExame: data.dataExame ? new Date(data.dataExame) : undefined,
        dataVencimento: data.dataVencimento !== undefined
          ? (data.dataVencimento ? new Date(data.dataVencimento) : null)
          : undefined,
        medico: data.medico,
        crmMedico: data.crmMedico,
        resultado: data.resultado !== undefined ? data.resultado : undefined,
        restricoes: data.restricoes,
        observacoes: data.observacoes,
        arquivoUrl: data.arquivoUrl,
        status,
      },
    })

    await createAuditLog(request, 'editar', 'ExameOcupacional', id, data)
    return updated
  })

  // Excluir
  app.delete('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_aso', 'excluir')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const exame = await prisma.exameOcupacional.findUnique({ where: { id } })
    if (!exame) return reply.status(404).send({ error: 'Exame não encontrado', code: 'NOT_FOUND' })

    await prisma.exameOcupacional.delete({ where: { id } })
    await createAuditLog(request, 'excluir', 'ExameOcupacional', id, {})
    return { message: 'Exame excluído' }
  })

  // Alertas de vencimento + inaptos
  app.get('/alertas/vencimento', {
    preHandler: [app.authenticate, requirePermission('rh_aso', 'visualizar')],
  }, async (request) => {
    const { dias = 60 } = request.query as { dias?: number }
    const limite = new Date()
    limite.setDate(limite.getDate() + Number(dias))

    const [vencendo, inaptos, semExame] = await Promise.all([
      // Exames vencendo
      prisma.exameOcupacional.findMany({
        where: {
          status: 'realizado',
          dataVencimento: { lte: limite, gte: new Date() },
        },
        include: {
          colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } } } },
        },
        orderBy: { dataVencimento: 'asc' },
      }),
      // Colaboradores inaptos
      prisma.exameOcupacional.findMany({
        where: { resultado: 'inapto', status: 'realizado' },
        include: {
          colaborador: { select: { id: true, nome: true, matricula: true } },
        },
      }),
      // Colaboradores ativos sem exame admissional
      prisma.colaborador.findMany({
        where: {
          status: 'ativo',
          examesOcupacionais: { none: { tipo: 'admissional' } },
        },
        select: { id: true, nome: true, matricula: true, dataAdmissao: true, cargo: { select: { nome: true } } },
        take: 50,
      }),
    ])

    return { vencendo, inaptos, semExameAdmissional: semExame }
  })

  // Histórico de exames de um colaborador
  app.get('/colaborador/:colaboradorId', {
    preHandler: [app.authenticate, requirePermission('rh_aso', 'visualizar')],
  }, async (request) => {
    const { colaboradorId } = request.params as { colaboradorId: string }

    const exames = await prisma.exameOcupacional.findMany({
      where: { colaboradorId },
      orderBy: { dataExame: 'desc' },
      include: { agendadoPor: { select: { id: true, nome: true } } },
    })

    return exames
  })
}
