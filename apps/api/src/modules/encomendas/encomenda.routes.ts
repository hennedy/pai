import type { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import { buildReceiptBuffer } from '../../lib/escpos'
import { sendToPrinter } from '../../lib/print-tcp'
import {
  listEncomendasQuerySchema,
  createEncomendaSchema,
  updateEncomendaStatusSchema,
  encomendaIdParamSchema,
} from './encomenda.schemas'

export async function encomendasRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // =====================================================
  // GET / - Listar encomendas com filtros e paginacao
  // =====================================================
  app.get('/', { preHandler: [requireUnit()] }, async (request, reply) => {
    const query = listEncomendasQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)
    const unitFilter = getUnitFilter(request)

    const where: any = { ...unitFilter }

    if (query.pendentes) {
      where.status = { in: ['pendente', 'pronta'] }
    } else if (query.status) {
      where.status = query.status
    }

    if (query.search) {
      where.OR = [
        { clienteNome: { contains: query.search, mode: 'insensitive' } },
        { clienteTelefone: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    if (query.dataInicio || query.dataFim) {
      where.dataRetirada = {}
      if (query.dataInicio) where.dataRetirada.gte = query.dataInicio
      if (query.dataFim)    where.dataRetirada.lte = query.dataFim
    }

    const [encomendas, total] = await Promise.all([
      prisma.encomenda.findMany({
        where,
        include: {
          itens:       true,
          criadoPor:   { select: { id: true, nome: true } },
          concluidoPor: { select: { id: true, nome: true } },
          unit:        { select: { id: true, nome: true, codigo: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.encomenda.count({ where }),
    ])

    return reply.send({
      data: encomendas,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
    })
  })

  // =====================================================
  // POST / - Criar nova encomenda
  // =====================================================
  app.post('/', { preHandler: [requireUnit()] }, async (request, reply) => {
    const body = createEncomendaSchema.parse(request.body)
    const user = request.user as any

    const encomenda = await prisma.encomenda.create({
      data: {
        unitId:          body.unitId,
        clienteNome:     body.clienteNome,
        clienteTelefone: body.clienteTelefone,
        dataRetirada:    body.dataRetirada,
        horaRetirada:    body.horaRetirada,
        observacoes:     body.observacoes,
        valorCaucao:     body.valorCaucao,
        valorTotal:      body.valorTotal,
        criadoPorId:     user.userId,
        itens: {
          create: body.itens.map((item) => ({
            descricao:  item.descricao,
            quantidade: item.quantidade,
            unidade:    item.unidade,
            observacao: item.observacao,
          })),
        },
      },
      include: {
        itens:       true,
        criadoPor:   { select: { id: true, nome: true } },
        unit:        { select: { id: true, nome: true, codigo: true, endereco: true, telefone: true } },
      },
    })

    await createAuditLog(request, 'criar_encomenda', 'Encomenda', encomenda.id, {
      clienteNome: body.clienteNome,
      dataRetirada: body.dataRetirada,
      totalItens: body.itens.length,
    })

    return reply.status(201).send(encomenda)
  })

  // =====================================================
  // GET /:id - Detalhe da encomenda
  // =====================================================
  app.get('/:id', { preHandler: [requireUnit()] }, async (request, reply) => {
    const { id } = encomendaIdParamSchema.parse(request.params)

    const encomenda = await prisma.encomenda.findUnique({
      where: { id },
      include: {
        itens:       true,
        criadoPor:   { select: { id: true, nome: true } },
        concluidoPor: { select: { id: true, nome: true } },
        unit:        { select: { id: true, nome: true, codigo: true, endereco: true, telefone: true } },
      },
    })

    if (!encomenda) {
      return reply.status(404).send({ error: 'Encomenda nao encontrada', code: 'ENCOMENDA_NOT_FOUND' })
    }

    return reply.send(encomenda)
  })

  // =====================================================
  // PATCH /:id/status - Atualizar status da encomenda
  // =====================================================
  app.patch('/:id/status', { preHandler: [requireUnit()] }, async (request, reply) => {
    const { id } = encomendaIdParamSchema.parse(request.params)
    const body = updateEncomendaStatusSchema.parse(request.body)
    const user = request.user as any

    const existing = await prisma.encomenda.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Encomenda nao encontrada', code: 'ENCOMENDA_NOT_FOUND' })
    }

    const data: any = { status: body.status }

    if (body.status === 'retirada') {
      data.concluidoPorId = user.userId
      data.concluidoEm    = new Date()
    }

    const updated = await prisma.encomenda.update({
      where: { id },
      data,
      include: {
        itens:       true,
        criadoPor:   { select: { id: true, nome: true } },
        concluidoPor: { select: { id: true, nome: true } },
        unit:        { select: { id: true, nome: true, codigo: true } },
      },
    })

    await createAuditLog(request, 'alterar_status_encomenda', 'Encomenda', id, {
      statusAnterior: existing.status,
      statusNovo: body.status,
    })

    return reply.send(updated)
  })

  // =====================================================
  // GET /:id/receipt-buffer - Retorna buffer ESC/POS em base64 (para agente local)
  // =====================================================
  app.get('/:id/receipt-buffer', { preHandler: [requireUnit()] }, async (request, reply) => {
    const { id } = encomendaIdParamSchema.parse(request.params)

    const encomenda = await prisma.encomenda.findUnique({
      where: { id },
      include: {
        itens:     true,
        criadoPor: { select: { id: true, nome: true } },
        unit:      { select: { id: true, nome: true, razaoSocial: true, cnpj: true, endereco: true, telefone: true } },
      },
    })

    if (!encomenda) {
      return reply.status(404).send({ error: 'Encomenda nao encontrada', code: 'ENCOMENDA_NOT_FOUND' })
    }

    const impressora = await prisma.impressora.findFirst({
      where: { unitId: encomenda.unitId, setores: { has: 'encomendas' }, ativo: true },
      select: { ip: true, porta: true, agentUrl: true },
    })

    const buffer = buildReceiptBuffer({
      numeroOrdem:     encomenda.numeroOrdem,
      clienteNome:     encomenda.clienteNome,
      clienteTelefone: encomenda.clienteTelefone,
      dataRetirada:    encomenda.dataRetirada,
      horaRetirada:    encomenda.horaRetirada,
      observacoes:     encomenda.observacoes,
      valorCaucao:     Number(encomenda.valorCaucao),
      valorTotal:      Number(encomenda.valorTotal),
      itens:           encomenda.itens,
      criadoPor:       encomenda.criadoPor,
      criadoPorNome:   encomenda.criadoPorNome,
      criadoEm:        encomenda.createdAt,
      unit: {
        nome:        encomenda.unit.nome,
        razaoSocial: encomenda.unit.razaoSocial,
        cnpj:        encomenda.unit.cnpj,
        endereco:    encomenda.unit.endereco,
        telefone:    encomenda.unit.telefone,
      },
    })

    return reply.send({
      buffer:     buffer.toString('base64'),
      impressora: impressora ? { ip: impressora.ip, porta: impressora.porta, agentUrl: impressora.agentUrl ?? null } : null,
    })
  })

  // =====================================================
  // POST /:id/print - Impressao direta via TCP/ESC/POS
  // =====================================================
  app.post('/:id/print', { preHandler: [requireUnit()] }, async (request, reply) => {
    const { id } = encomendaIdParamSchema.parse(request.params)

    const encomenda = await prisma.encomenda.findUnique({
      where: { id },
      include: {
        itens:     true,
        criadoPor: { select: { id: true, nome: true } },
        unit:      { select: { id: true, nome: true, razaoSocial: true, cnpj: true, endereco: true, telefone: true } },
      },
    })

    if (!encomenda) {
      return reply.status(404).send({ error: 'Encomenda nao encontrada', code: 'ENCOMENDA_NOT_FOUND' })
    }

    const impressora = await prisma.impressora.findFirst({
      where: { unitId: encomenda.unitId, setores: { has: 'encomendas' }, ativo: true },
    })

    if (!impressora) {
      return reply.status(422).send({
        error: 'Nenhuma impressora ativa configurada para encomendas nesta unidade.',
        code: 'PRINTER_NOT_CONFIGURED',
      })
    }

    const buffer = buildReceiptBuffer({
      numeroOrdem:     encomenda.numeroOrdem,
      clienteNome:     encomenda.clienteNome,
      clienteTelefone: encomenda.clienteTelefone,
      dataRetirada:    encomenda.dataRetirada,
      horaRetirada:    encomenda.horaRetirada,
      observacoes:     encomenda.observacoes,
      valorCaucao:     Number(encomenda.valorCaucao),
      valorTotal:      Number(encomenda.valorTotal),
      itens:           encomenda.itens,
      criadoPor:       encomenda.criadoPor,
      criadoPorNome:   encomenda.criadoPorNome,
      criadoEm:        encomenda.createdAt,
      unit: {
        nome:        encomenda.unit.nome,
        razaoSocial: encomenda.unit.razaoSocial,
        cnpj:        encomenda.unit.cnpj,
        endereco:    encomenda.unit.endereco,
        telefone:    encomenda.unit.telefone,
      },
    })

    try {
      await sendToPrinter(impressora.ip, impressora.porta, buffer)
      return reply.send({ ok: true })
    } catch (err: any) {
      return reply.status(502).send({
        error: `Erro ao comunicar com a impressora: ${err.message}`,
        code: 'PRINTER_ERROR',
      })
    }
  })

  // =====================================================
  // DELETE /:id - Cancelar/remover encomenda
  // =====================================================
  app.delete('/:id', { preHandler: [requireUnit()] }, async (request, reply) => {
    const { id } = encomendaIdParamSchema.parse(request.params)

    const existing = await prisma.encomenda.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Encomenda nao encontrada', code: 'ENCOMENDA_NOT_FOUND' })
    }

    if (existing.status === 'retirada') {
      return reply.status(400).send({
        error: 'Nao e possivel excluir encomenda ja retirada',
        code: 'ENCOMENDA_JA_RETIRADA',
      })
    }

    await prisma.encomenda.delete({ where: { id } })

    await createAuditLog(request, 'excluir_encomenda', 'Encomenda', id, {})

    return reply.status(204).send()
  })
}
