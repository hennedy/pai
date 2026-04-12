import { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { requirePermission } from '../../../middlewares/auth.middleware'
import { createAuditLog } from '../../../lib/audit'
import {
  criarDesligamentoSchema,
  updateDesligamentoSchema,
  atualizarChecklistSchema,
  concluirDesligamentoSchema,
  desligamentoIdParamSchema,
  listDesligamentosQuerySchema,
} from './desligamento.schemas'

const DEFAULT_CHECKLIST = [
  { descricao: 'Comunicar ao colaborador', concluido: false },
  { descricao: 'Calcular verbas rescisórias', concluido: false },
  { descricao: 'Emitir Termo de Rescisão (TRCT)', concluido: false },
  { descricao: 'Solicitar homologação (se aplicável)', concluido: false },
  { descricao: 'Recolher equipamentos / EPI', concluido: false },
  { descricao: 'Revogar acessos ao sistema', concluido: false },
  { descricao: 'Realizar entrevista de desligamento', concluido: false },
  { descricao: 'Comunicar benefícios (plano de saúde, VT, VR)', concluido: false },
  { descricao: 'Emitir Seguro-Desemprego (se aplicável)', concluido: false },
  { descricao: 'Arquivar documentação', concluido: false },
]

export async function desligamentoRoutes(app: FastifyInstance) {
  // Listar
  app.get('/', {
    preHandler: [app.authenticate, requirePermission('rh_desligamento', 'visualizar')],
  }, async (request, reply) => {
    const query = listDesligamentosQuerySchema.parse(request.query)
    const skip = (query.page - 1) * query.limit

    const where: any = {}
    if (query.status) where.status = query.status
    if (query.search) {
      where.colaborador = { nome: { contains: query.search, mode: 'insensitive' } }
    }

    const [items, total] = await Promise.all([
      prisma.processoDesligamento.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { dataDesligamento: 'desc' },
        include: {
          colaborador: {
            select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } }, unit: { select: { nome: true } } },
          },
          registradoPor: { select: { id: true, nome: true } },
        },
      }),
      prisma.processoDesligamento.count({ where }),
    ])

    return { items, total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) }
  })

  // Buscar por ID
  app.get('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_desligamento', 'visualizar')],
  }, async (request, reply) => {
    const { id } = desligamentoIdParamSchema.parse(request.params)

    const desligamento = await prisma.processoDesligamento.findUnique({
      where: { id },
      include: {
        colaborador: {
          select: {
            id: true, nome: true, matricula: true, tipoContrato: true, dataAdmissao: true, salarioBase: true,
            cargo: { select: { nome: true, nivel: true } },
            unit: { select: { nome: true } },
          },
        },
        registradoPor: { select: { id: true, nome: true } },
      },
    })

    if (!desligamento) return reply.status(404).send({ error: 'Processo não encontrado', code: 'NOT_FOUND' })

    return desligamento
  })

  // Buscar por colaboradorId
  app.get('/colaborador/:colaboradorId', {
    preHandler: [app.authenticate, requirePermission('rh_desligamento', 'visualizar')],
  }, async (request, reply) => {
    const { colaboradorId } = request.params as { colaboradorId: string }

    const desligamento = await prisma.processoDesligamento.findUnique({
      where: { colaboradorId },
      include: {
        colaborador: { select: { id: true, nome: true, matricula: true } },
        registradoPor: { select: { id: true, nome: true } },
      },
    })

    if (!desligamento) return reply.status(404).send({ error: 'Nenhum processo de desligamento encontrado', code: 'NOT_FOUND' })

    return desligamento
  })

  // Criar processo de desligamento
  app.post('/', {
    preHandler: [app.authenticate, requirePermission('rh_desligamento', 'criar')],
  }, async (request, reply) => {
    const user = (request as any).user
    const data = criarDesligamentoSchema.parse(request.body)

    const colaborador = await prisma.colaborador.findUnique({ where: { id: data.colaboradorId } })
    if (!colaborador) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })
    if (colaborador.status === 'desligado') {
      return reply.status(400).send({ error: 'Colaborador já está desligado', code: 'ALREADY_DESLIGADO' })
    }

    const existing = await prisma.processoDesligamento.findUnique({ where: { colaboradorId: data.colaboradorId } })
    if (existing && existing.status !== 'cancelado') {
      return reply.status(409).send({ error: 'Já existe um processo de desligamento ativo para este colaborador', code: 'CONFLICT' })
    }

    const checklistItems = data.checklistItems?.length ? data.checklistItems : DEFAULT_CHECKLIST

    const processo = await prisma.processoDesligamento.create({
      data: {
        colaboradorId: data.colaboradorId,
        tipo: data.tipo,
        status: 'pendente',
        dataAviso: data.dataAviso ? new Date(data.dataAviso) : null,
        dataDesligamento: new Date(data.dataDesligamento),
        motivoDetalhado: data.motivoDetalhado,
        entrevistaDeRetencao: data.entrevistaDeRetencao,
        observacoes: data.observacoes,
        checklistItems: checklistItems,
        registradoPorId: user.sub,
      },
      include: {
        colaborador: { select: { nome: true, matricula: true } },
      },
    })

    // Atualiza status do colaborador
    await prisma.colaborador.update({
      where: { id: data.colaboradorId },
      data: { status: 'inativo' },
    })

    await createAuditLog(request, 'criar', 'ProcessoDesligamento', processo.id, data)
    return reply.status(201).send(processo)
  })

  // Atualizar dados do processo
  app.put('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_desligamento', 'editar')],
  }, async (request, reply) => {
    const { id } = desligamentoIdParamSchema.parse(request.params)
    const data = updateDesligamentoSchema.parse(request.body)

    const processo = await prisma.processoDesligamento.findUnique({ where: { id } })
    if (!processo) return reply.status(404).send({ error: 'Processo não encontrado', code: 'NOT_FOUND' })
    if (processo.status === 'concluido') {
      return reply.status(400).send({ error: 'Processo já concluído não pode ser editado', code: 'INVALID_STATUS' })
    }

    const updated = await prisma.processoDesligamento.update({
      where: { id },
      data: {
        tipo: data.tipo,
        dataAviso: data.dataAviso !== undefined ? (data.dataAviso ? new Date(data.dataAviso) : null) : undefined,
        dataDesligamento: data.dataDesligamento ? new Date(data.dataDesligamento) : undefined,
        motivoDetalhado: data.motivoDetalhado,
        entrevistaDeRetencao: data.entrevistaDeRetencao,
        observacoes: data.observacoes,
        status: 'em_andamento',
      },
    })

    await createAuditLog(request, 'editar', 'ProcessoDesligamento', id, data)
    return updated
  })

  // Atualizar checklist
  app.patch('/:id/checklist', {
    preHandler: [app.authenticate, requirePermission('rh_desligamento', 'editar')],
  }, async (request, reply) => {
    const { id } = desligamentoIdParamSchema.parse(request.params)
    const data = atualizarChecklistSchema.parse(request.body)

    const processo = await prisma.processoDesligamento.findUnique({ where: { id } })
    if (!processo) return reply.status(404).send({ error: 'Processo não encontrado', code: 'NOT_FOUND' })

    const updated = await prisma.processoDesligamento.update({
      where: { id },
      data: {
        checklistItems: data.checklistItems,
        status: 'em_andamento',
      },
    })

    return updated
  })

  // Concluir processo (efetiva o desligamento)
  app.patch('/:id/concluir', {
    preHandler: [app.authenticate, requirePermission('rh_desligamento', 'concluir')],
  }, async (request, reply) => {
    const { id } = desligamentoIdParamSchema.parse(request.params)
    const data = concluirDesligamentoSchema.parse(request.body)

    const processo = await prisma.processoDesligamento.findUnique({ where: { id } })
    if (!processo) return reply.status(404).send({ error: 'Processo não encontrado', code: 'NOT_FOUND' })
    if (processo.status === 'concluido') {
      return reply.status(400).send({ error: 'Processo já concluído', code: 'INVALID_STATUS' })
    }

    await prisma.$transaction([
      prisma.processoDesligamento.update({
        where: { id },
        data: {
          status: 'concluido',
          observacoes: data.observacoes ?? processo.observacoes,
        },
      }),
      prisma.colaborador.update({
        where: { id: processo.colaboradorId },
        data: {
          status: 'desligado',
          dataDemissao: processo.dataDesligamento,
        },
      }),
    ])

    await createAuditLog(request, 'concluir', 'ProcessoDesligamento', id, data)
    return { message: 'Desligamento concluído com sucesso' }
  })

  // Cancelar processo
  app.patch('/:id/cancelar', {
    preHandler: [app.authenticate, requirePermission('rh_desligamento', 'cancelar')],
  }, async (request, reply) => {
    const { id } = desligamentoIdParamSchema.parse(request.params)

    const processo = await prisma.processoDesligamento.findUnique({ where: { id } })
    if (!processo) return reply.status(404).send({ error: 'Processo não encontrado', code: 'NOT_FOUND' })
    if (processo.status === 'concluido') {
      return reply.status(400).send({ error: 'Processo concluído não pode ser cancelado', code: 'INVALID_STATUS' })
    }

    await prisma.$transaction([
      prisma.processoDesligamento.update({
        where: { id },
        data: { status: 'cancelado' },
      }),
      prisma.colaborador.update({
        where: { id: processo.colaboradorId },
        data: { status: 'ativo' },
      }),
    ])

    await createAuditLog(request, 'cancelar', 'ProcessoDesligamento', id, {})
    return { message: 'Processo de desligamento cancelado' }
  })
}
