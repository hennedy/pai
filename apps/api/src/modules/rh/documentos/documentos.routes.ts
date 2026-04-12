import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { requirePermission } from '../../../middlewares/auth.middleware'
import { createAuditLog } from '../../../lib/audit'

const createSchema = z.object({
  colaboradorId: z.string().uuid(),
  tipo: z.enum(['contrato_trabalho', 'contrato_experiencia', 'termo_confidencialidade', 'atestado', 'declaracao', 'comprovante_residencia', 'identidade', 'cnh', 'certificado', 'outros']),
  nome: z.string().min(1),
  descricao: z.string().optional(),
  arquivoUrl: z.string().optional(),
  tamanhoBytes: z.number().int().optional(),
  mimeType: z.string().optional(),
  vencimento: z.string().datetime().optional(),
})

const updateSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().optional(),
  arquivoUrl: z.string().optional(),
  vencimento: z.string().datetime().optional().nullable(),
  status: z.enum(['ativo', 'vencido', 'cancelado', 'pendente_assinatura']).optional(),
})

const listQuery = z.object({
  colaboradorId: z.string().uuid().optional(),
  tipo: z.string().optional(),
  status: z.string().optional(),
  vencendoEm: z.coerce.number().optional(), // dias
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(30),
})

export async function documentosRoutes(app: FastifyInstance) {
  // Listar
  app.get('/', {
    preHandler: [app.authenticate, requirePermission('rh_documentos', 'visualizar')],
  }, async (request) => {
    const q = listQuery.parse(request.query)
    const skip = (q.page - 1) * q.limit
    const where: any = {}
    if (q.colaboradorId) where.colaboradorId = q.colaboradorId
    if (q.tipo) where.tipo = q.tipo
    if (q.status) where.status = q.status
    if (q.vencendoEm) {
      const limite = new Date()
      limite.setDate(limite.getDate() + q.vencendoEm)
      where.vencimento = { lte: limite, gte: new Date() }
    }

    const [items, total] = await Promise.all([
      prisma.documentoColaborador.findMany({
        where, skip, take: q.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          colaborador: { select: { id: true, nome: true, matricula: true } },
          uploadPor: { select: { id: true, nome: true } },
        },
      }),
      prisma.documentoColaborador.count({ where }),
    ])

    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) }
  })

  // Buscar por ID
  app.get('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_documentos', 'visualizar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const doc = await prisma.documentoColaborador.findUnique({
      where: { id },
      include: {
        colaborador: { select: { id: true, nome: true, matricula: true } },
        uploadPor: { select: { id: true, nome: true } },
      },
    })
    if (!doc) return reply.status(404).send({ error: 'Documento não encontrado', code: 'NOT_FOUND' })
    return doc
  })

  // Criar
  app.post('/', {
    preHandler: [app.authenticate, requirePermission('rh_documentos', 'criar')],
  }, async (request, reply) => {
    const user = (request as any).user
    const data = createSchema.parse(request.body)

    const doc = await prisma.documentoColaborador.create({
      data: {
        ...data,
        vencimento: data.vencimento ? new Date(data.vencimento) : undefined,
        uploadPorId: user.sub,
      },
    })

    await createAuditLog(request, 'criar', 'DocumentoColaborador', doc.id, data)
    return reply.status(201).send(doc)
  })

  // Atualizar
  app.put('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_documentos', 'editar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = updateSchema.parse(request.body)

    const doc = await prisma.documentoColaborador.findUnique({ where: { id } })
    if (!doc) return reply.status(404).send({ error: 'Documento não encontrado', code: 'NOT_FOUND' })

    const updated = await prisma.documentoColaborador.update({
      where: { id },
      data: {
        ...data,
        vencimento: data.vencimento !== undefined
          ? (data.vencimento ? new Date(data.vencimento) : null)
          : undefined,
      },
    })

    await createAuditLog(request, 'editar', 'DocumentoColaborador', id, data)
    return updated
  })

  // Excluir
  app.delete('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_documentos', 'excluir')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const doc = await prisma.documentoColaborador.findUnique({ where: { id } })
    if (!doc) return reply.status(404).send({ error: 'Documento não encontrado', code: 'NOT_FOUND' })

    await prisma.documentoColaborador.delete({ where: { id } })
    await createAuditLog(request, 'excluir', 'DocumentoColaborador', id, {})
    return { message: 'Documento excluído' }
  })

  // Documentos próximos do vencimento (alerta)
  app.get('/alertas/vencimento', {
    preHandler: [app.authenticate, requirePermission('rh_documentos', 'visualizar')],
  }, async (request) => {
    const { dias = 30 } = request.query as { dias?: number }
    const limite = new Date()
    limite.setDate(limite.getDate() + Number(dias))

    const docs = await prisma.documentoColaborador.findMany({
      where: {
        status: 'ativo',
        vencimento: { lte: limite, gte: new Date() },
      },
      include: {
        colaborador: { select: { id: true, nome: true, matricula: true } },
      },
      orderBy: { vencimento: 'asc' },
    })

    return docs
  })
}
