import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'

export async function portalRoutes(app: FastifyInstance) {
  // Helper: obtém o colaborador vinculado ao usuário autenticado
  async function getColabOrFail(userId: string, reply: any) {
    const colab = await prisma.colaborador.findFirst({
      where: { userId },
      select: {
        id: true, nome: true, nomeSocial: true, matricula: true, fotoUrl: true,
        email: true, emailCorporativo: true, telefone: true, celular: true,
        tipoContrato: true, dataAdmissao: true, status: true, cargaHorariaSemanal: true,
        salarioBase: true,
        cargo: { select: { nome: true, nivel: true } },
        unit: { select: { nome: true } },
        gestorDireto: { select: { id: true, nome: true, fotoUrl: true, cargo: { select: { nome: true } } } },
      },
    })
    if (!colab) {
      reply.status(404).send({ error: 'Você não possui um perfil de colaborador vinculado a este login.', code: 'NO_COLABORADOR' })
      return null
    }
    return colab
  }

  // Perfil do colaborador autenticado
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const colab = await getColabOrFail(user.sub, reply)
    if (!colab) return

    const [endereco, contatos, dependentes, formacoes] = await Promise.all([
      prisma.enderecoColaborador.findUnique({ where: { colaboradorId: colab.id } }),
      prisma.contatoEmergencia.findMany({ where: { colaboradorId: colab.id } }),
      prisma.dependente.findMany({ where: { colaboradorId: colab.id } }),
      prisma.formacaoAcademica.findMany({ where: { colaboradorId: colab.id }, orderBy: { anoConclusao: 'desc' } }),
    ])

    return { ...colab, endereco, contatosEmergencia: contatos, dependentes, formacoes }
  })

  // Holerites do colaborador
  app.get('/me/holerites', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const colab = await prisma.colaborador.findFirst({ where: { userId: user.sub }, select: { id: true } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    const { page = 1, limit = 12 } = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(12),
    }).parse(request.query)

    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      prisma.holerite.findMany({
        where: { colaboradorId: colab.id, status: 'publicado' },
        skip, take: limit,
        orderBy: { competencia: 'desc' },
        select: {
          id: true, competencia: true, salarioBruto: true, salarioLiquido: true,
          totalDescontos: true, totalProventos: true, arquivoUrl: true,
          status: true, createdAt: true,
        },
      }),
      prisma.holerite.count({ where: { colaboradorId: colab.id, status: 'publicado' } }),
    ])

    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  })

  // Férias do colaborador
  app.get('/me/ferias', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const colab = await prisma.colaborador.findFirst({ where: { userId: user.sub }, select: { id: true } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    const [periodos, ferias] = await Promise.all([
      prisma.periodoAquisitivo.findMany({
        where: { colaboradorId: colab.id },
        orderBy: { numero: 'desc' },
      }),
      prisma.ferias.findMany({
        where: { colaboradorId: colab.id },
        orderBy: { dataInicio: 'desc' },
        include: { aprovadoPor: { select: { nome: true } } },
      }),
    ])

    return { periodos, ferias }
  })

  // Solicitar férias
  app.post('/me/ferias', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const colab = await prisma.colaborador.findFirst({ where: { userId: user.sub }, select: { id: true } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    const data = z.object({
      periodoAquisitivoId: z.string().uuid(),
      dataInicio: z.string().datetime(),
      dataFim: z.string().datetime(),
      diasVendidos: z.number().int().min(0).max(10).default(0),
      observacoes: z.string().optional(),
    }).parse(request.body)

    const periodo = await prisma.periodoAquisitivo.findUnique({ where: { id: data.periodoAquisitivoId } })
    if (!periodo || periodo.colaboradorId !== colab.id) {
      return reply.status(404).send({ error: 'Período aquisitivo não encontrado', code: 'NOT_FOUND' })
    }

    const dias = Math.ceil((new Date(data.dataFim).getTime() - new Date(data.dataInicio).getTime()) / 86400000) + 1
    const ferias = await prisma.ferias.create({
      data: {
        colaboradorId: colab.id,
        periodoAquisitivoId: data.periodoAquisitivoId,
        dataInicio: new Date(data.dataInicio),
        dataFim: new Date(data.dataFim),
        diasGozados: dias,
        diasVendidos: data.diasVendidos,
        observacoes: data.observacoes,
        solicitadoPorId: user.sub,
      },
    })

    return reply.status(201).send(ferias)
  })

  // Documentos do colaborador
  app.get('/me/documentos', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const colab = await prisma.colaborador.findFirst({ where: { userId: user.sub }, select: { id: true } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    const documentos = await prisma.documentoColaborador.findMany({
      where: { colaboradorId: colab.id, status: 'ativo' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, tipo: true, titulo: true, descricao: true,
        arquivoUrl: true, dataVencimento: true, status: true, createdAt: true,
      },
    })

    return documentos
  })

  // Comunicados publicados (visíveis para o colaborador)
  app.get('/me/comunicados', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const colab = await prisma.colaborador.findFirst({
      where: { userId: user.sub },
      select: { id: true, unitId: true },
    })
    if (!colab) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    const { page = 1, limit = 20 } = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(20),
    }).parse(request.query)

    const now = new Date()
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      prisma.comunicado.findMany({
        where: {
          publicadoEm: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
          OR: [
            { destinatarios: { has: 'todos' } },
            { destinatarios: { has: colab.unitId } },
          ],
        },
        skip, take: limit,
        orderBy: [{ fixado: 'desc' }, { publicadoEm: 'desc' }],
        include: {
          criadoPor: { select: { nome: true } },
          visualizacoes: {
            where: { colaboradorId: colab.id },
            select: { visualizadoEm: true },
          },
        },
      }),
      prisma.comunicado.count({
        where: {
          publicadoEm: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
      }),
    ])

    const withLido = items.map((c) => ({
      ...c,
      lido: c.visualizacoes.length > 0,
      lidoEm: c.visualizacoes[0]?.visualizadoEm ?? null,
      visualizacoes: undefined,
    }))

    return { items: withLido, total, page, limit, pages: Math.ceil(total / limit) }
  })

  // Marcar comunicado como lido
  app.post('/me/comunicados/:id/ler', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const { id } = request.params as { id: string }

    const colab = await prisma.colaborador.findFirst({ where: { userId: user.sub }, select: { id: true } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    await prisma.comunicadoVisualizacao.upsert({
      where: { comunicadoId_colaboradorId: { comunicadoId: id, colaboradorId: colab.id } },
      create: { comunicadoId: id, colaboradorId: colab.id },
      update: { visualizadoEm: new Date() },
    })

    return { message: 'Marcado como lido' }
  })

  // Metas do colaborador
  app.get('/me/metas', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const colab = await prisma.colaborador.findFirst({ where: { userId: user.sub }, select: { id: true } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    const metas = await prisma.metaColaborador.findMany({
      where: { colaboradorId: colab.id },
      orderBy: { createdAt: 'desc' },
      include: { ciclo: { select: { nome: true, periodoRef: true, status: true } } },
    })

    return metas
  })

  // Avaliações do colaborador
  app.get('/me/avaliacoes', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const colab = await prisma.colaborador.findFirst({ where: { userId: user.sub }, select: { id: true } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    const avaliacoes = await prisma.avaliacaoDesempenho.findMany({
      where: { colaboradorId: colab.id },
      orderBy: { createdAt: 'desc' },
      include: {
        ciclo: { select: { nome: true, periodoRef: true, status: true } },
        avaliador: { select: { nome: true } },
      },
    })

    return avaliacoes
  })

  // Registros de ponto do colaborador (últimos 30 dias)
  app.get('/me/ponto', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const colab = await prisma.colaborador.findFirst({ where: { userId: user.sub }, select: { id: true } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    const { competencia } = z.object({
      competencia: z.string().optional(),
    }).parse(request.query)

    const now = new Date()
    const comp = competencia ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const [year, month] = comp.split('-').map(Number)
    const inicio = new Date(year, month - 1, 1)
    const fim = new Date(year, month, 0, 23, 59, 59)

    const [registros, fechamento, escala] = await Promise.all([
      prisma.registroPonto.findMany({
        where: { colaboradorId: colab.id, dataHora: { gte: inicio, lte: fim } },
        orderBy: { dataHora: 'desc' },
      }),
      prisma.fechamentoPonto.findUnique({
        where: { colaboradorId_competencia: { colaboradorId: colab.id, competencia: comp } },
      }),
      prisma.escalaPonto.findUnique({ where: { colaboradorId: colab.id } }),
    ])

    return { competencia: comp, registros, fechamento, escala }
  })

  // Exames do colaborador
  app.get('/me/exames', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const colab = await prisma.colaborador.findFirst({ where: { userId: user.sub }, select: { id: true } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    const exames = await prisma.exameOcupacional.findMany({
      where: { colaboradorId: colab.id },
      orderBy: { dataExame: 'desc' },
      select: {
        id: true, tipo: true, dataExame: true, dataVencimento: true,
        resultado: true, status: true, medico: true, restricoes: true, arquivoUrl: true,
      },
    })

    return exames
  })

  // Benefícios do colaborador
  app.get('/me/beneficios', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user
    const colab = await prisma.colaborador.findFirst({ where: { userId: user.sub }, select: { id: true } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    const beneficios = await prisma.beneficioColaborador.findMany({
      where: { colaboradorId: colab.id, ativo: true },
      include: {
        beneficio: { select: { nome: true, tipo: true, descricao: true, operadora: true } },
      },
      orderBy: { dataInicio: 'desc' },
    })

    return beneficios
  })
}
