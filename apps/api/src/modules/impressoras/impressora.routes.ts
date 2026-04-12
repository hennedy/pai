import type { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'
import { buildTestBuffer } from '../../lib/escpos'
import { sendToPrinter } from '../../lib/print-tcp'
import {
  listImpressorasQuerySchema,
  createImpressoraSchema,
  updateImpressoraSchema,
  impressoraIdParamSchema,
} from './impressora.schemas'

const impressoraInclude = {
  unit: { select: { id: true, nome: true, codigo: true } },
}

export async function impressoraRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // =====================================================
  // GET / - Listar impressoras
  // =====================================================
  app.get('/', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'supervisor', 'administrativo')],
  }, async (request, reply) => {
    const query = listImpressorasQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)

    const where: any = {}
    if (query.unitId) where.unitId = query.unitId
    if (typeof query.ativo === 'boolean') where.ativo = query.ativo
    if (query.search) {
      where.OR = [
        { nome: { contains: query.search, mode: 'insensitive' } },
        { ip:   { contains: query.search } },
      ]
    }

    const [impressoras, total] = await Promise.all([
      prisma.impressora.findMany({
        where,
        include: impressoraInclude,
        orderBy: [{ unit: { nome: 'asc' } }, { nome: 'asc' }],
        skip,
        take,
      }),
      prisma.impressora.count({ where }),
    ])

    return reply.send({
      data: impressoras,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
    })
  })

  // =====================================================
  // POST / - Criar impressora
  // =====================================================
  app.post('/', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const body = createImpressoraSchema.parse(request.body)

    const unit = await prisma.unit.findUnique({ where: { id: body.unitId }, select: { id: true } })
    if (!unit) {
      return reply.status(404).send({ error: 'Unidade nao encontrada', code: 'UNIT_NOT_FOUND' })
    }

    const impressora = await prisma.impressora.create({
      data: {
        nome:    body.nome,
        ip:      body.ip,
        porta:   body.porta,
        setores: body.setores,
        unitId:  body.unitId,
        ativo:   body.ativo,
      },
      include: impressoraInclude,
    })

    return reply.status(201).send(impressora)
  })

  // =====================================================
  // GET /:id - Detalhe
  // =====================================================
  app.get('/:id', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'supervisor', 'administrativo')],
  }, async (request, reply) => {
    const { id } = impressoraIdParamSchema.parse(request.params)

    const impressora = await prisma.impressora.findUnique({
      where: { id },
      include: impressoraInclude,
    })

    if (!impressora) {
      return reply.status(404).send({ error: 'Impressora nao encontrada', code: 'IMPRESSORA_NOT_FOUND' })
    }

    return reply.send(impressora)
  })

  // =====================================================
  // PUT /:id - Atualizar impressora
  // =====================================================
  app.put('/:id', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { id } = impressoraIdParamSchema.parse(request.params)
    const body    = updateImpressoraSchema.parse(request.body)

    const existing = await prisma.impressora.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return reply.status(404).send({ error: 'Impressora nao encontrada', code: 'IMPRESSORA_NOT_FOUND' })
    }

    if (body.unitId) {
      const unit = await prisma.unit.findUnique({ where: { id: body.unitId }, select: { id: true } })
      if (!unit) {
        return reply.status(404).send({ error: 'Unidade nao encontrada', code: 'UNIT_NOT_FOUND' })
      }
    }

    const impressora = await prisma.impressora.update({
      where: { id },
      data:  body,
      include: impressoraInclude,
    })

    return reply.send(impressora)
  })

  // =====================================================
  // PATCH /:id/status - Ativar/desativar
  // =====================================================
  app.patch('/:id/status', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { id } = impressoraIdParamSchema.parse(request.params)

    const existing = await prisma.impressora.findUnique({ where: { id }, select: { id: true, ativo: true } })
    if (!existing) {
      return reply.status(404).send({ error: 'Impressora nao encontrada', code: 'IMPRESSORA_NOT_FOUND' })
    }

    const impressora = await prisma.impressora.update({
      where: { id },
      data:  { ativo: !existing.ativo },
      include: impressoraInclude,
    })

    return reply.send(impressora)
  })

  // =====================================================
  // DELETE /:id - Remover impressora
  // =====================================================
  app.delete('/:id', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { id } = impressoraIdParamSchema.parse(request.params)

    const existing = await prisma.impressora.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
      return reply.status(404).send({ error: 'Impressora nao encontrada', code: 'IMPRESSORA_NOT_FOUND' })
    }

    await prisma.impressora.delete({ where: { id } })
    return reply.status(204).send()
  })

  // =====================================================
  // POST /:id/test - Teste de impressao (envia pagina de teste)
  // =====================================================
  app.post('/:id/test', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade')],
  }, async (request, reply) => {
    const { id } = impressoraIdParamSchema.parse(request.params)

    const impressora = await prisma.impressora.findUnique({
      where: { id },
      include: { unit: { select: { nome: true } } },
    })

    if (!impressora) {
      return reply.status(404).send({ error: 'Impressora nao encontrada', code: 'IMPRESSORA_NOT_FOUND' })
    }

    const testBuffer = buildTestBuffer(impressora.unit.nome)

    try {
      await sendToPrinter(impressora.ip, impressora.porta, testBuffer)
      return reply.send({ ok: true, message: 'Impressora respondeu com sucesso' })
    } catch (err: any) {
      return reply.status(502).send({
        ok: false,
        error: `Erro ao conectar: ${err.message}`,
        code: 'PRINTER_ERROR',
      })
    }
  })

  // =====================================================
  // POST /:id/ping - Teste de conectividade TCP puro (sem impressao)
  // =====================================================
  app.post('/:id/ping', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade')],
  }, async (request, reply) => {
    const { id } = impressoraIdParamSchema.parse(request.params)

    const impressora = await prisma.impressora.findUnique({
      where: { id },
      select: { id: true, ip: true, porta: true },
    })

    if (!impressora) {
      return reply.status(404).send({ error: 'Impressora nao encontrada', code: 'IMPRESSORA_NOT_FOUND' })
    }

    const net = await import('net')
    const start = Date.now()

    const result = await new Promise<{ ok: boolean; ms?: number; error?: string }>((resolve) => {
      const socket = new net.Socket()
      socket.setTimeout(5000)

      socket.connect(impressora.porta, impressora.ip, () => {
        const ms = Date.now() - start
        socket.destroy()
        resolve({ ok: true, ms })
      })

      socket.on('error', (err: Error) => {
        socket.destroy()
        resolve({ ok: false, error: err.message })
      })

      socket.on('timeout', () => {
        socket.destroy()
        resolve({
          ok: false,
          error: `Sem resposta em 5s — verifique: (1) IP correto, (2) impressora ligada, (3) RAW TCP habilitado na impressora, (4) API na mesma rede local`,
        })
      })
    })

    return reply.status(result.ok ? 200 : 502).send(result)
  })
}
