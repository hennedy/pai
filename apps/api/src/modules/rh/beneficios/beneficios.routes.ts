import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { requirePermission } from '../../../middlewares/auth.middleware'
import { createAuditLog } from '../../../lib/audit'

const tipoBeneficio = z.enum(['vale_transporte', 'vale_refeicao', 'vale_alimentacao', 'plano_saude', 'plano_odontologico', 'seguro_vida', 'gympass', 'auxilio_creche', 'outros'])

const createBeneficioSchema = z.object({
  nome: z.string().min(1),
  tipo: tipoBeneficio,
  descricao: z.string().optional(),
  valorPadrao: z.number().positive().optional(),
})

const updateBeneficioSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().optional(),
  valorPadrao: z.number().positive().optional().nullable(),
  status: z.enum(['ativo', 'inativo']).optional(),
})

const vincularSchema = z.object({
  colaboradorId: z.string().uuid(),
  beneficioId: z.string().uuid(),
  valorMensal: z.number().positive().optional(),
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime().optional(),
  observacoes: z.string().optional(),
})

const updateVinculoSchema = z.object({
  valorMensal: z.number().positive().optional().nullable(),
  dataFim: z.string().datetime().optional().nullable(),
  status: z.enum(['ativo', 'inativo', 'suspenso']).optional(),
  observacoes: z.string().optional(),
})

export async function beneficiosRoutes(app: FastifyInstance) {
  // ============ BENEFÍCIOS MASTER ============

  app.get('/', {
    preHandler: [app.authenticate, requirePermission('rh_beneficios', 'visualizar')],
  }, async (request) => {
    const { status } = request.query as { status?: string }
    const where: any = {}
    if (status) where.status = status

    const items = await prisma.beneficio.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: { _count: { select: { colaboradores: { where: { status: 'ativo' } } } } },
    })

    return items
  })

  app.get('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_beneficios', 'visualizar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const item = await prisma.beneficio.findUnique({
      where: { id },
      include: {
        colaboradores: {
          where: { status: 'ativo' },
          include: { colaborador: { select: { id: true, nome: true, matricula: true } } },
        },
      },
    })
    if (!item) return reply.status(404).send({ error: 'Benefício não encontrado', code: 'NOT_FOUND' })
    return item
  })

  app.post('/', {
    preHandler: [app.authenticate, requirePermission('rh_beneficios', 'criar')],
  }, async (request, reply) => {
    const data = createBeneficioSchema.parse(request.body)
    const beneficio = await prisma.beneficio.create({ data })
    await createAuditLog(request, 'criar', 'Beneficio', beneficio.id, data)
    return reply.status(201).send(beneficio)
  })

  app.put('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_beneficios', 'editar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = updateBeneficioSchema.parse(request.body)

    const item = await prisma.beneficio.findUnique({ where: { id } })
    if (!item) return reply.status(404).send({ error: 'Benefício não encontrado', code: 'NOT_FOUND' })

    const updated = await prisma.beneficio.update({ where: { id }, data })
    await createAuditLog(request, 'editar', 'Beneficio', id, data)
    return updated
  })

  // ============ VÍNCULOS COLABORADOR-BENEFÍCIO ============

  // Listar vínculos de um colaborador
  app.get('/colaborador/:colaboradorId', {
    preHandler: [app.authenticate, requirePermission('rh_beneficios', 'visualizar')],
  }, async (request) => {
    const { colaboradorId } = request.params as { colaboradorId: string }
    const { status } = request.query as { status?: string }

    const where: any = { colaboradorId }
    if (status) where.status = status

    const items = await prisma.beneficioColaborador.findMany({
      where,
      include: { beneficio: true },
      orderBy: { dataInicio: 'desc' },
    })

    return items
  })

  // Vincular benefício a colaborador
  app.post('/vincular', {
    preHandler: [app.authenticate, requirePermission('rh_beneficios', 'editar')],
  }, async (request, reply) => {
    const data = vincularSchema.parse(request.body)

    const existing = await prisma.beneficioColaborador.findUnique({
      where: { colaboradorId_beneficioId: { colaboradorId: data.colaboradorId, beneficioId: data.beneficioId } },
    })
    if (existing && existing.status === 'ativo') {
      return reply.status(409).send({ error: 'Colaborador já possui este benefício ativo', code: 'CONFLICT' })
    }

    // Se existe mas inativo, reativar
    if (existing) {
      const updated = await prisma.beneficioColaborador.update({
        where: { colaboradorId_beneficioId: { colaboradorId: data.colaboradorId, beneficioId: data.beneficioId } },
        data: {
          valorMensal: data.valorMensal,
          dataInicio: new Date(data.dataInicio),
          dataFim: data.dataFim ? new Date(data.dataFim) : null,
          status: 'ativo',
          observacoes: data.observacoes,
        },
        include: { beneficio: true },
      })
      await createAuditLog(request, 'reativar_beneficio', 'BeneficioColaborador', updated.id, data)
      return updated
    }

    const vinculo = await prisma.beneficioColaborador.create({
      data: {
        colaboradorId: data.colaboradorId,
        beneficioId: data.beneficioId,
        valorMensal: data.valorMensal,
        dataInicio: new Date(data.dataInicio),
        dataFim: data.dataFim ? new Date(data.dataFim) : null,
        observacoes: data.observacoes,
      },
      include: { beneficio: true },
    })

    await createAuditLog(request, 'vincular_beneficio', 'BeneficioColaborador', vinculo.id, data)
    return reply.status(201).send(vinculo)
  })

  // Atualizar vínculo
  app.put('/vinculo/:id', {
    preHandler: [app.authenticate, requirePermission('rh_beneficios', 'editar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = updateVinculoSchema.parse(request.body)

    const vinculo = await prisma.beneficioColaborador.findUnique({ where: { id } })
    if (!vinculo) return reply.status(404).send({ error: 'Vínculo não encontrado', code: 'NOT_FOUND' })

    const updated = await prisma.beneficioColaborador.update({
      where: { id },
      data: {
        valorMensal: data.valorMensal !== undefined ? data.valorMensal : undefined,
        dataFim: data.dataFim !== undefined ? (data.dataFim ? new Date(data.dataFim) : null) : undefined,
        status: data.status,
        observacoes: data.observacoes,
      },
      include: { beneficio: true },
    })

    await createAuditLog(request, 'editar_vinculo_beneficio', 'BeneficioColaborador', id, data)
    return updated
  })

  // Resumo de benefícios (por tipo, total de colaboradores)
  app.get('/resumo/tipos', {
    preHandler: [app.authenticate, requirePermission('rh_beneficios', 'visualizar')],
  }, async () => {
    const beneficios = await prisma.beneficio.findMany({
      where: { status: 'ativo' },
      include: {
        _count: { select: { colaboradores: { where: { status: 'ativo' } } } },
        colaboradores: {
          where: { status: 'ativo' },
          select: { valorMensal: true },
        },
      },
    })

    return beneficios.map((b) => ({
      id: b.id,
      nome: b.nome,
      tipo: b.tipo,
      totalColaboradores: b._count.colaboradores,
      custoMensalTotal: b.colaboradores.reduce((s, v) => s + (v.valorMensal ?? b.valorPadrao ?? 0), 0),
    }))
  })
}
