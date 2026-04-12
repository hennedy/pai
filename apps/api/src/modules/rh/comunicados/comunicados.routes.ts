import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { requirePermission } from '../../../middlewares/auth.middleware'
import { createAuditLog } from '../../../lib/audit'

const createSchema = z.object({
  titulo: z.string().min(1),
  conteudo: z.string().min(1),
  tipo: z.enum(['aviso', 'comunicado', 'politica', 'treinamento', 'outro']).default('comunicado'),
  prioridade: z.enum(['normal', 'importante', 'urgente']).default('normal'),
  fixado: z.boolean().optional(),
  arquivoUrl: z.string().optional(),
  destinatarios: z.array(z.string()).default(['todos']),
  publicadoEm: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
})

const updateSchema = z.object({
  titulo: z.string().optional(),
  conteudo: z.string().optional(),
  tipo: z.enum(['aviso', 'comunicado', 'politica', 'treinamento', 'outro']).optional(),
  prioridade: z.enum(['normal', 'importante', 'urgente']).optional(),
  fixado: z.boolean().optional(),
  arquivoUrl: z.string().optional().nullable(),
  destinatarios: z.array(z.string()).optional(),
  publicadoEm: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
})

const listQuery = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  tipo: z.string().optional(),
  prioridade: z.string().optional(),
  search: z.string().optional(),
  publicados: z.coerce.boolean().optional(),
})

export async function comunicadosRoutes(app: FastifyInstance) {
  // Listar comunicados
  app.get('/', {
    preHandler: [app.authenticate, requirePermission('rh_comunicados', 'visualizar')],
  }, async (request) => {
    const q = listQuery.parse(request.query)
    const skip = (q.page - 1) * q.limit
    const where: any = {}
    if (q.tipo) where.tipo = q.tipo
    if (q.prioridade) where.prioridade = q.prioridade
    if (q.search) where.titulo = { contains: q.search, mode: 'insensitive' }
    if (q.publicados !== undefined) {
      where.publicadoEm = q.publicados ? { not: null, lte: new Date() } : null
    }

    const [items, total] = await Promise.all([
      prisma.comunicado.findMany({
        where, skip, take: q.limit,
        orderBy: [{ fixado: 'desc' }, { publicadoEm: 'desc' }, { createdAt: 'desc' }],
        include: {
          criadoPor: { select: { id: true, nome: true } },
          _count: { select: { visualizacoes: true } },
        },
      }),
      prisma.comunicado.count({ where }),
    ])

    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) }
  })

  // Buscar por ID
  app.get('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_comunicados', 'visualizar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const comunicado = await prisma.comunicado.findUnique({
      where: { id },
      include: {
        criadoPor: { select: { id: true, nome: true } },
        _count: { select: { visualizacoes: true } },
      },
    })
    if (!comunicado) return reply.status(404).send({ error: 'Comunicado não encontrado', code: 'NOT_FOUND' })
    return comunicado
  })

  // Criar comunicado
  app.post('/', {
    preHandler: [app.authenticate, requirePermission('rh_comunicados', 'criar')],
  }, async (request, reply) => {
    const user = (request as any).user
    const data = createSchema.parse(request.body)

    const comunicado = await prisma.comunicado.create({
      data: {
        titulo: data.titulo,
        conteudo: data.conteudo,
        tipo: data.tipo,
        prioridade: data.prioridade,
        fixado: data.fixado ?? false,
        arquivoUrl: data.arquivoUrl,
        destinatarios: data.destinatarios,
        publicadoEm: data.publicadoEm ? new Date(data.publicadoEm) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        criadoPorId: user.sub,
      },
      include: { criadoPor: { select: { nome: true } } },
    })

    await createAuditLog(request, 'criar', 'Comunicado', comunicado.id, data)
    return reply.status(201).send(comunicado)
  })

  // Atualizar comunicado
  app.put('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_comunicados', 'editar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = updateSchema.parse(request.body)

    const comunicado = await prisma.comunicado.findUnique({ where: { id } })
    if (!comunicado) return reply.status(404).send({ error: 'Comunicado não encontrado', code: 'NOT_FOUND' })

    const updated = await prisma.comunicado.update({
      where: { id },
      data: {
        titulo: data.titulo,
        conteudo: data.conteudo,
        tipo: data.tipo,
        prioridade: data.prioridade,
        fixado: data.fixado,
        arquivoUrl: data.arquivoUrl !== undefined ? data.arquivoUrl : undefined,
        destinatarios: data.destinatarios,
        publicadoEm: data.publicadoEm !== undefined
          ? (data.publicadoEm ? new Date(data.publicadoEm) : null)
          : undefined,
        expiresAt: data.expiresAt !== undefined
          ? (data.expiresAt ? new Date(data.expiresAt) : null)
          : undefined,
      },
    })

    await createAuditLog(request, 'editar', 'Comunicado', id, data)
    return updated
  })

  // Publicar comunicado (atalho)
  app.patch('/:id/publicar', {
    preHandler: [app.authenticate, requirePermission('rh_comunicados', 'publicar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const comunicado = await prisma.comunicado.findUnique({ where: { id } })
    if (!comunicado) return reply.status(404).send({ error: 'Comunicado não encontrado', code: 'NOT_FOUND' })

    const updated = await prisma.comunicado.update({
      where: { id },
      data: { publicadoEm: new Date() },
    })

    await createAuditLog(request, 'publicar', 'Comunicado', id, {})
    return updated
  })

  // Despublicar
  app.patch('/:id/despublicar', {
    preHandler: [app.authenticate, requirePermission('rh_comunicados', 'editar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const comunicado = await prisma.comunicado.findUnique({ where: { id } })
    if (!comunicado) return reply.status(404).send({ error: 'Comunicado não encontrado', code: 'NOT_FOUND' })

    const updated = await prisma.comunicado.update({ where: { id }, data: { publicadoEm: null } })
    await createAuditLog(request, 'editar', 'Comunicado', id, { acao: 'despublicar' })
    return updated
  })

  // Excluir comunicado
  app.delete('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_comunicados', 'excluir')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const comunicado = await prisma.comunicado.findUnique({ where: { id } })
    if (!comunicado) return reply.status(404).send({ error: 'Comunicado não encontrado', code: 'NOT_FOUND' })

    await prisma.comunicado.delete({ where: { id } })
    await createAuditLog(request, 'excluir', 'Comunicado', id, {})
    return { message: 'Comunicado excluído' }
  })

  // Marcar como lido (por colaborador)
  app.post('/:id/visualizar', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { colaboradorId } = z.object({ colaboradorId: z.string().uuid() }).parse(request.body)

    const comunicado = await prisma.comunicado.findUnique({ where: { id } })
    if (!comunicado) return reply.status(404).send({ error: 'Comunicado não encontrado', code: 'NOT_FOUND' })

    await prisma.comunicadoVisualizacao.upsert({
      where: { comunicadoId_colaboradorId: { comunicadoId: id, colaboradorId } },
      create: { comunicadoId: id, colaboradorId },
      update: { visualizadoEm: new Date() },
    })

    return { message: 'Visualização registrada' }
  })

  // Leitores de um comunicado
  app.get('/:id/leitores', {
    preHandler: [app.authenticate, requirePermission('rh_comunicados', 'visualizar')],
  }, async (request) => {
    const { id } = request.params as { id: string }

    const leitores = await prisma.comunicadoVisualizacao.findMany({
      where: { comunicadoId: id },
      include: {
        colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } } } },
      },
      orderBy: { visualizadoEm: 'desc' },
    })

    return leitores
  })
}
