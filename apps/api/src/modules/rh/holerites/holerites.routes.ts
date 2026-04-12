import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { requirePermission } from '../../../middlewares/auth.middleware'
import { createAuditLog } from '../../../lib/audit'

const itemSchema = z.object({
  descricao: z.string(),
  valor: z.number(),
})

const createSchema = z.object({
  colaboradorId: z.string().uuid(),
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM'),
  salarioBruto: z.number().positive(),
  descontos: z.array(itemSchema).default([]),
  proventos: z.array(itemSchema).default([]),
  observacoes: z.string().optional(),
  arquivoUrl: z.string().optional(),
})

const updateSchema = z.object({
  salarioBruto: z.number().positive().optional(),
  descontos: z.array(itemSchema).optional(),
  proventos: z.array(itemSchema).optional(),
  observacoes: z.string().optional(),
  arquivoUrl: z.string().optional(),
})

const listQuery = z.object({
  colaboradorId: z.string().uuid().optional(),
  competencia: z.string().optional(),
  status: z.enum(['rascunho', 'publicado', 'visualizado']).optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(30),
})

function calcularLiquido(bruto: number, descontos: any[], proventos: any[]): number {
  const totalDescontos = descontos.reduce((s, d) => s + d.valor, 0)
  const totalProventos = proventos.reduce((s, p) => s + p.valor, 0)
  return bruto + totalProventos - totalDescontos
}

export async function holeriteRoutes(app: FastifyInstance) {
  // Listar
  app.get('/', {
    preHandler: [app.authenticate, requirePermission('rh_holerites', 'visualizar')],
  }, async (request) => {
    const q = listQuery.parse(request.query)
    const skip = (q.page - 1) * q.limit
    const where: any = {}
    if (q.colaboradorId) where.colaboradorId = q.colaboradorId
    if (q.competencia) where.competencia = q.competencia
    if (q.status) where.status = q.status

    const [items, total] = await Promise.all([
      prisma.holerite.findMany({
        where, skip, take: q.limit,
        orderBy: [{ competencia: 'desc' }, { createdAt: 'desc' }],
        include: {
          colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } } } },
          geradoPor: { select: { id: true, nome: true } },
        },
      }),
      prisma.holerite.count({ where }),
    ])

    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) }
  })

  // Buscar por ID
  app.get('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_holerites', 'visualizar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const holerite = await prisma.holerite.findUnique({
      where: { id },
      include: {
        colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } }, unit: { select: { nome: true } } } },
        geradoPor: { select: { id: true, nome: true } },
      },
    })
    if (!holerite) return reply.status(404).send({ error: 'Holerite não encontrado', code: 'NOT_FOUND' })
    return holerite
  })

  // Criar
  app.post('/', {
    preHandler: [app.authenticate, requirePermission('rh_holerites', 'criar')],
  }, async (request, reply) => {
    const user = (request as any).user
    const data = createSchema.parse(request.body)

    // Verificar duplicidade
    const existing = await prisma.holerite.findUnique({
      where: { colaboradorId_competencia: { colaboradorId: data.colaboradorId, competencia: data.competencia } },
    })
    if (existing) return reply.status(409).send({ error: 'Holerite já existe para este colaborador nesta competência', code: 'CONFLICT' })

    const salarioLiquido = calcularLiquido(data.salarioBruto, data.descontos, data.proventos)

    const holerite = await prisma.holerite.create({
      data: {
        colaboradorId: data.colaboradorId,
        competencia: data.competencia,
        salarioBruto: data.salarioBruto,
        descontos: data.descontos,
        proventos: data.proventos,
        salarioLiquido,
        observacoes: data.observacoes,
        arquivoUrl: data.arquivoUrl,
        geradoPorId: user.sub,
      },
    })

    await createAuditLog(request, 'criar', 'Holerite', holerite.id, data)
    return reply.status(201).send(holerite)
  })

  // Criar em lote (todos os colaboradores de uma competência)
  app.post('/lote', {
    preHandler: [app.authenticate, requirePermission('rh_holerites', 'criar')],
  }, async (request, reply) => {
    const user = (request as any).user
    const { competencia, unitId } = request.body as { competencia: string; unitId?: string }

    if (!competencia?.match(/^\d{4}-\d{2}$/)) {
      return reply.status(400).send({ error: 'Formato inválido. Use YYYY-MM', code: 'INVALID_FORMAT' })
    }

    const where: any = { status: 'ativo' }
    if (unitId) where.unitId = unitId

    const colaboradores = await prisma.colaborador.findMany({
      where,
      select: { id: true, salarioBase: true, nome: true },
    })

    let criados = 0
    let ignorados = 0

    for (const col of colaboradores) {
      const existing = await prisma.holerite.findUnique({
        where: { colaboradorId_competencia: { colaboradorId: col.id, competencia } },
      })
      if (existing) { ignorados++; continue }

      const salarioBruto = col.salarioBase ?? 0
      await prisma.holerite.create({
        data: {
          colaboradorId: col.id,
          competencia,
          salarioBruto,
          descontos: [],
          proventos: [],
          salarioLiquido: salarioBruto,
          geradoPorId: user.sub,
        },
      })
      criados++
    }

    await createAuditLog(request, 'criar_lote', 'Holerite', competencia, { criados, ignorados })
    return { message: `${criados} holerites criados, ${ignorados} já existiam`, criados, ignorados }
  })

  // Atualizar
  app.put('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_holerites', 'editar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = updateSchema.parse(request.body)

    const holerite = await prisma.holerite.findUnique({ where: { id } })
    if (!holerite) return reply.status(404).send({ error: 'Holerite não encontrado', code: 'NOT_FOUND' })
    if (holerite.status !== 'rascunho') {
      return reply.status(400).send({ error: 'Apenas rascunhos podem ser editados', code: 'INVALID_STATUS' })
    }

    const bruto = data.salarioBruto ?? holerite.salarioBruto
    const descontos = data.descontos ?? (holerite.descontos as any[])
    const proventos = data.proventos ?? (holerite.proventos as any[])
    const salarioLiquido = calcularLiquido(bruto, descontos, proventos)

    const updated = await prisma.holerite.update({
      where: { id },
      data: { ...data, salarioLiquido },
    })

    await createAuditLog(request, 'editar', 'Holerite', id, data)
    return updated
  })

  // Publicar (disponibiliza para o colaborador)
  app.patch('/:id/publicar', {
    preHandler: [app.authenticate, requirePermission('rh_holerites', 'publicar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const holerite = await prisma.holerite.findUnique({ where: { id } })
    if (!holerite) return reply.status(404).send({ error: 'Holerite não encontrado', code: 'NOT_FOUND' })
    if (holerite.status !== 'rascunho') {
      return reply.status(400).send({ error: 'Apenas rascunhos podem ser publicados', code: 'INVALID_STATUS' })
    }

    const updated = await prisma.holerite.update({
      where: { id },
      data: { status: 'publicado', publicadoEm: new Date() },
    })

    await createAuditLog(request, 'publicar', 'Holerite', id, {})
    return updated
  })

  // Excluir (apenas rascunhos)
  app.delete('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_holerites', 'excluir')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const holerite = await prisma.holerite.findUnique({ where: { id } })
    if (!holerite) return reply.status(404).send({ error: 'Holerite não encontrado', code: 'NOT_FOUND' })
    if (holerite.status !== 'rascunho') {
      return reply.status(400).send({ error: 'Apenas rascunhos podem ser excluídos', code: 'INVALID_STATUS' })
    }

    await prisma.holerite.delete({ where: { id } })
    await createAuditLog(request, 'excluir', 'Holerite', id, {})
    return { message: 'Holerite excluído' }
  })
}
