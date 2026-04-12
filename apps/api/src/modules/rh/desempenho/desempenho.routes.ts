import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { requirePermission } from '../../../middlewares/auth.middleware'
import { createAuditLog } from '../../../lib/audit'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const cicloCreateSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  periodoRef: z.string().min(1),
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime(),
})

const cicloUpdateSchema = z.object({
  nome: z.string().optional(),
  descricao: z.string().optional(),
  periodoRef: z.string().optional(),
  dataInicio: z.string().datetime().optional(),
  dataFim: z.string().datetime().optional(),
  status: z.enum(['planejamento', 'em_andamento', 'encerrado']).optional(),
})

const avaliacaoCreateSchema = z.object({
  cicloId: z.string().uuid(),
  colaboradorId: z.string().uuid(),
  avaliadorId: z.string().uuid().optional(),
  tipo: z.enum(['autoavaliacao', 'gestor', 'par', 'subordinado', 'cliente_interno']),
})

const avaliacaoUpdateSchema = z.object({
  status: z.enum(['pendente', 'em_andamento', 'concluida', 'cancelada']).optional(),
  pontuacaoTotal: z.number().optional(),
  respostas: z.record(z.any()).optional(),
  comentarios: z.string().optional(),
  planoDesenvolvimento: z.string().optional(),
})

const metaCreateSchema = z.object({
  colaboradorId: z.string().uuid(),
  cicloId: z.string().uuid().optional(),
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  categoria: z.string().optional(),
  indicador: z.string().optional(),
  metaValor: z.number().optional(),
  valorAtual: z.number().optional(),
  unidade: z.string().optional(),
  dataLimite: z.string().optional(),
})

const metaUpdateSchema = z.object({
  titulo: z.string().optional(),
  descricao: z.string().optional(),
  categoria: z.string().optional(),
  indicador: z.string().optional(),
  metaValor: z.number().optional(),
  valorAtual: z.number().optional(),
  unidade: z.string().optional(),
  dataLimite: z.string().optional().nullable(),
  status: z.enum(['em_andamento', 'concluida', 'nao_atingida', 'cancelada']).optional(),
})

const listQuery = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  status: z.string().optional(),
  colaboradorId: z.string().uuid().optional(),
  cicloId: z.string().uuid().optional(),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function desempenhoRoutes(app: FastifyInstance) {
  // ══ CICLOS ══

  // Listar ciclos
  app.get('/ciclos', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'visualizar')],
  }, async (request) => {
    const q = listQuery.parse(request.query)
    const skip = (q.page - 1) * q.limit
    const where: any = {}
    if (q.status) where.status = q.status

    const [items, total] = await Promise.all([
      prisma.cicloAvaliacao.findMany({
        where, skip, take: q.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          criadoPor: { select: { id: true, nome: true } },
          _count: { select: { avaliacoes: true, metas: true } },
        },
      }),
      prisma.cicloAvaliacao.count({ where }),
    ])

    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) }
  })

  // Buscar ciclo por ID
  app.get('/ciclos/:id', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'visualizar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const ciclo = await prisma.cicloAvaliacao.findUnique({
      where: { id },
      include: {
        criadoPor: { select: { id: true, nome: true } },
        _count: { select: { avaliacoes: true, metas: true } },
      },
    })
    if (!ciclo) return reply.status(404).send({ error: 'Ciclo não encontrado', code: 'NOT_FOUND' })
    return ciclo
  })

  // Criar ciclo
  app.post('/ciclos', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'gerenciar')],
  }, async (request, reply) => {
    const user = (request as any).user
    const data = cicloCreateSchema.parse(request.body)

    const ciclo = await prisma.cicloAvaliacao.create({
      data: {
        nome: data.nome,
        descricao: data.descricao,
        periodoRef: data.periodoRef,
        dataInicio: new Date(data.dataInicio),
        dataFim: new Date(data.dataFim),
        criadoPorId: user.sub,
      },
    })

    await createAuditLog(request, 'criar', 'CicloAvaliacao', ciclo.id, data)
    return reply.status(201).send(ciclo)
  })

  // Atualizar ciclo
  app.put('/ciclos/:id', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'gerenciar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = cicloUpdateSchema.parse(request.body)

    const ciclo = await prisma.cicloAvaliacao.findUnique({ where: { id } })
    if (!ciclo) return reply.status(404).send({ error: 'Ciclo não encontrado', code: 'NOT_FOUND' })

    const updated = await prisma.cicloAvaliacao.update({
      where: { id },
      data: {
        nome: data.nome,
        descricao: data.descricao,
        periodoRef: data.periodoRef,
        dataInicio: data.dataInicio ? new Date(data.dataInicio) : undefined,
        dataFim: data.dataFim ? new Date(data.dataFim) : undefined,
        status: data.status,
      },
    })

    await createAuditLog(request, 'editar', 'CicloAvaliacao', id, data)
    return updated
  })

  // Iniciar/Encerrar ciclo (atalho de status)
  app.patch('/ciclos/:id/status', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'gerenciar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = z.object({ status: z.enum(['planejamento', 'em_andamento', 'encerrado']) }).parse(request.body)

    const ciclo = await prisma.cicloAvaliacao.findUnique({ where: { id } })
    if (!ciclo) return reply.status(404).send({ error: 'Ciclo não encontrado', code: 'NOT_FOUND' })

    const updated = await prisma.cicloAvaliacao.update({ where: { id }, data: { status } })
    await createAuditLog(request, 'editar', 'CicloAvaliacao', id, { status })
    return updated
  })

  // Excluir ciclo (somente em planejamento)
  app.delete('/ciclos/:id', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'gerenciar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const ciclo = await prisma.cicloAvaliacao.findUnique({ where: { id } })
    if (!ciclo) return reply.status(404).send({ error: 'Ciclo não encontrado', code: 'NOT_FOUND' })
    if (ciclo.status !== 'planejamento') {
      return reply.status(400).send({ error: 'Só é possível excluir ciclos em planejamento', code: 'INVALID_STATUS' })
    }

    await prisma.cicloAvaliacao.delete({ where: { id } })
    await createAuditLog(request, 'excluir', 'CicloAvaliacao', id, {})
    return { message: 'Ciclo excluído' }
  })

  // ══ AVALIAÇÕES ══

  // Listar avaliações
  app.get('/avaliacoes', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'visualizar')],
  }, async (request) => {
    const q = listQuery.parse(request.query)
    const skip = (q.page - 1) * q.limit
    const where: any = {}
    if (q.status) where.status = q.status
    if (q.colaboradorId) where.colaboradorId = q.colaboradorId
    if (q.cicloId) where.cicloId = q.cicloId

    const [items, total] = await Promise.all([
      prisma.avaliacaoDesempenho.findMany({
        where, skip, take: q.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ciclo: { select: { id: true, nome: true, periodoRef: true } },
          colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } } } },
          avaliador: { select: { id: true, nome: true } },
        },
      }),
      prisma.avaliacaoDesempenho.count({ where }),
    ])

    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) }
  })

  // Buscar avaliação por ID
  app.get('/avaliacoes/:id', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'visualizar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const av = await prisma.avaliacaoDesempenho.findUnique({
      where: { id },
      include: {
        ciclo: { select: { id: true, nome: true, periodoRef: true, status: true } },
        colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } }, unit: { select: { nome: true } } } },
        avaliador: { select: { id: true, nome: true } },
      },
    })
    if (!av) return reply.status(404).send({ error: 'Avaliação não encontrada', code: 'NOT_FOUND' })
    return av
  })

  // Criar avaliação
  app.post('/avaliacoes', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'gerenciar')],
  }, async (request, reply) => {
    const data = avaliacaoCreateSchema.parse(request.body)

    const ciclo = await prisma.cicloAvaliacao.findUnique({ where: { id: data.cicloId } })
    if (!ciclo) return reply.status(404).send({ error: 'Ciclo não encontrado', code: 'NOT_FOUND' })

    const colab = await prisma.colaborador.findUnique({ where: { id: data.colaboradorId } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    const av = await prisma.avaliacaoDesempenho.create({
      data: {
        cicloId: data.cicloId,
        colaboradorId: data.colaboradorId,
        avaliadorId: data.avaliadorId ?? null,
        tipo: data.tipo,
      },
      include: {
        colaborador: { select: { nome: true, matricula: true } },
      },
    })

    await createAuditLog(request, 'criar', 'AvaliacaoDesempenho', av.id, data)
    return reply.status(201).send(av)
  })

  // Preencher/atualizar avaliação
  app.put('/avaliacoes/:id', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'avaliar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = avaliacaoUpdateSchema.parse(request.body)

    const av = await prisma.avaliacaoDesempenho.findUnique({ where: { id } })
    if (!av) return reply.status(404).send({ error: 'Avaliação não encontrada', code: 'NOT_FOUND' })
    if (av.status === 'cancelada') {
      return reply.status(400).send({ error: 'Avaliação cancelada não pode ser editada', code: 'INVALID_STATUS' })
    }

    const updated = await prisma.avaliacaoDesempenho.update({
      where: { id },
      data: {
        status: data.status,
        pontuacaoTotal: data.pontuacaoTotal,
        respostas: data.respostas as any,
        comentarios: data.comentarios,
        planoDesenvolvimento: data.planoDesenvolvimento,
        dataEnvio: data.status === 'concluida' ? new Date() : undefined,
      },
    })

    await createAuditLog(request, 'editar', 'AvaliacaoDesempenho', id, data)
    return updated
  })

  // Gerar avaliações em lote para um ciclo
  app.post('/ciclos/:id/gerar-avaliacoes', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'gerenciar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { tipos = ['autoavaliacao', 'gestor'] } = z.object({
      tipos: z.array(z.enum(['autoavaliacao', 'gestor', 'par', 'subordinado', 'cliente_interno'])).optional(),
    }).parse(request.body)

    const ciclo = await prisma.cicloAvaliacao.findUnique({ where: { id } })
    if (!ciclo) return reply.status(404).send({ error: 'Ciclo não encontrado', code: 'NOT_FOUND' })

    const colaboradores = await prisma.colaborador.findMany({
      where: { status: 'ativo' },
      select: { id: true, gestorDiretoId: true },
    })

    const toCreate: any[] = []

    for (const colab of colaboradores) {
      for (const tipo of tipos) {
        if (tipo === 'gestor' && colab.gestorDiretoId) {
          toCreate.push({ cicloId: id, colaboradorId: colab.id, avaliadorId: colab.gestorDiretoId, tipo })
        } else if (tipo !== 'gestor') {
          toCreate.push({ cicloId: id, colaboradorId: colab.id, avaliadorId: null, tipo })
        }
      }
    }

    // Cria apenas as que ainda não existem
    let criadas = 0
    for (const av of toCreate) {
      const exists = await prisma.avaliacaoDesempenho.findFirst({
        where: { cicloId: av.cicloId, colaboradorId: av.colaboradorId, tipo: av.tipo, avaliadorId: av.avaliadorId },
      })
      if (!exists) {
        await prisma.avaliacaoDesempenho.create({ data: av })
        criadas++
      }
    }

    await createAuditLog(request, 'criar', 'CicloAvaliacao', id, { acao: 'gerar_avaliacoes', criadas })
    return { message: `${criadas} avaliações geradas`, criadas }
  })

  // ══ METAS ══

  // Listar metas
  app.get('/metas', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'visualizar')],
  }, async (request) => {
    const q = listQuery.parse(request.query)
    const skip = (q.page - 1) * q.limit
    const where: any = {}
    if (q.status) where.status = q.status
    if (q.colaboradorId) where.colaboradorId = q.colaboradorId
    if (q.cicloId) where.cicloId = q.cicloId

    const [items, total] = await Promise.all([
      prisma.metaColaborador.findMany({
        where, skip, take: q.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } } } },
          ciclo: { select: { id: true, nome: true, periodoRef: true } },
          criadoPor: { select: { id: true, nome: true } },
        },
      }),
      prisma.metaColaborador.count({ where }),
    ])

    return { items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) }
  })

  // Buscar meta por ID
  app.get('/metas/:id', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'visualizar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const meta = await prisma.metaColaborador.findUnique({
      where: { id },
      include: {
        colaborador: { select: { id: true, nome: true, matricula: true } },
        ciclo: { select: { id: true, nome: true } },
        criadoPor: { select: { id: true, nome: true } },
      },
    })
    if (!meta) return reply.status(404).send({ error: 'Meta não encontrada', code: 'NOT_FOUND' })
    return meta
  })

  // Criar meta
  app.post('/metas', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'gerenciar')],
  }, async (request, reply) => {
    const user = (request as any).user
    const data = metaCreateSchema.parse(request.body)

    const meta = await prisma.metaColaborador.create({
      data: {
        colaboradorId: data.colaboradorId,
        cicloId: data.cicloId ?? null,
        titulo: data.titulo,
        descricao: data.descricao,
        categoria: data.categoria,
        indicador: data.indicador,
        metaValor: data.metaValor,
        valorAtual: data.valorAtual ?? 0,
        unidade: data.unidade,
        dataLimite: data.dataLimite ? new Date(data.dataLimite) : null,
        criadoPorId: user.sub,
      },
      include: {
        colaborador: { select: { nome: true, matricula: true } },
      },
    })

    await createAuditLog(request, 'criar', 'MetaColaborador', meta.id, data)
    return reply.status(201).send(meta)
  })

  // Atualizar meta
  app.put('/metas/:id', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'gerenciar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const data = metaUpdateSchema.parse(request.body)

    const meta = await prisma.metaColaborador.findUnique({ where: { id } })
    if (!meta) return reply.status(404).send({ error: 'Meta não encontrada', code: 'NOT_FOUND' })

    const updated = await prisma.metaColaborador.update({
      where: { id },
      data: {
        titulo: data.titulo,
        descricao: data.descricao,
        categoria: data.categoria,
        indicador: data.indicador,
        metaValor: data.metaValor,
        valorAtual: data.valorAtual,
        unidade: data.unidade,
        dataLimite: data.dataLimite !== undefined
          ? (data.dataLimite ? new Date(data.dataLimite) : null)
          : undefined,
        status: data.status,
      },
    })

    await createAuditLog(request, 'editar', 'MetaColaborador', id, data)
    return updated
  })

  // Excluir meta
  app.delete('/metas/:id', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'gerenciar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const meta = await prisma.metaColaborador.findUnique({ where: { id } })
    if (!meta) return reply.status(404).send({ error: 'Meta não encontrada', code: 'NOT_FOUND' })

    await prisma.metaColaborador.delete({ where: { id } })
    await createAuditLog(request, 'excluir', 'MetaColaborador', id, {})
    return { message: 'Meta excluída' }
  })

  // Dashboard de desempenho (resumo por ciclo)
  app.get('/dashboard', {
    preHandler: [app.authenticate, requirePermission('rh_desempenho', 'visualizar')],
  }, async (request) => {
    const { cicloId } = z.object({ cicloId: z.string().uuid().optional() }).parse(request.query)

    const [cicloAtivo, totalAvaliacoes, pendentes, concluidas, totalMetas, metasAndamento] = await Promise.all([
      prisma.cicloAvaliacao.findFirst({
        where: { status: 'em_andamento' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.avaliacaoDesempenho.count({ where: cicloId ? { cicloId } : {} }),
      prisma.avaliacaoDesempenho.count({ where: { status: 'pendente', ...(cicloId ? { cicloId } : {}) } }),
      prisma.avaliacaoDesempenho.count({ where: { status: 'concluida', ...(cicloId ? { cicloId } : {}) } }),
      prisma.metaColaborador.count({ where: cicloId ? { cicloId } : {} }),
      prisma.metaColaborador.count({ where: { status: 'em_andamento', ...(cicloId ? { cicloId } : {}) } }),
    ])

    return {
      cicloAtivo,
      avaliacoes: { total: totalAvaliacoes, pendentes, concluidas },
      metas: { total: totalMetas, emAndamento: metasAndamento },
    }
  })
}
