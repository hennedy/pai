import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@pai/database'
import { z } from 'zod'
import { authenticateTotem } from '../../middlewares/auth.middleware'
import { uploadFile } from '../../lib/storage'
import { randomUUID } from 'crypto'
import { buildReceiptBuffer } from '../../lib/escpos'
import { sendToPrinter } from '../../lib/print-tcp'

/**
 * Rotas públicas do Totem de autoatendimento.
 * Não requerem autenticação — usam PIN do funcionário.
 */
export async function totemRoutes(app: FastifyInstance) {
  // ============================================================
  // GET /totem/unit/:unitId — Dados públicos da unidade (por UUID)
  // ============================================================
  app.get('/unit/:unitId', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = z.object({ unitId: z.string().uuid('ID invalido') }).safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'ID de unidade invalido', code: 'INVALID_ID' })
    }

    const unit = await prisma.unit.findUnique({
      where: { id: parsed.data.unitId },
      select: { id: true, nome: true, codigo: true, status: true },
    })

    if (!unit || unit.status !== 'ativo') {
      return reply.status(404).send({ error: 'Unidade nao encontrada ou inativa', code: 'UNIT_NOT_FOUND' })
    }

    return reply.send(unit)
  })

  // ============================================================
  // GET /totem/unit/by-code/:codigo — Resolver codigo amigavel → dados da unidade
  // ============================================================
  app.get('/unit/by-code/:codigo', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = z.object({ codigo: z.string().min(1).max(50) }).safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Codigo invalido', code: 'INVALID_CODE' })
    }

    const unit = await prisma.unit.findUnique({
      where: { codigo: parsed.data.codigo.toUpperCase() },
      select: { id: true, nome: true, codigo: true, status: true },
    })

    if (!unit || unit.status !== 'ativo') {
      return reply.status(404).send({ error: 'Unidade nao encontrada ou inativa', code: 'UNIT_NOT_FOUND' })
    }

    return reply.send(unit)
  })

  // ============================================================
  // POST /totem/verify-pin — Verificar PIN e emitir token de turno
  // ============================================================
  app.post('/verify-pin', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = z
      .object({
        pin: z.string().min(1).max(6),
        unitId: z.string().uuid('ID invalido'),
      })
      .safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR' })
    }

    const { pin, unitId } = parsed.data

    // Busca colaborador pelo PIN com status ativo + permissões da unidade
    const colaborador = await prisma.colaborador.findFirst({
      where: { pin, status: 'ativo' },
      select: {
        id: true,
        nome: true,
        primeiroNome: true,
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            userUnits: {
              include: {
                unit: { select: { id: true, codigo: true } },
                role: { select: { nome: true } },
              },
            },
          },
        },
        unidades: {
          where: { unitId },
          select: {
            permissoes: { select: { permissao: true } },
          },
        },
      },
    })

    if (!colaborador) {
      return reply.status(401).send({ error: 'PIN invalido', code: 'INVALID_PIN' })
    }

    // Permissões desta unidade (vazio = sem acesso configurado)
    const colaboradorUnit = colaborador.unidades[0] ?? null
    const permissoes = colaboradorUnit ? colaboradorUnit.permissoes.map((p) => p.permissao) : []

    const userId = (colaborador.user && colaborador.user.status === 'ativo') ? colaborador.user.id : null
    const roles = (colaborador.user && colaborador.user.status === 'ativo')
      ? colaborador.user.userUnits.map((uu) => ({ unitId: uu.unitId, unitCode: uu.unit.codigo, role: uu.role.nome }))
      : [{ unitId, unitCode: unitId, role: 'colaborador' }]

    const token = app.jwt.sign(
      { type: 'totem', colaboradorId: colaborador.id, userId, unitId, permissoes, roles },
      { expiresIn: '8h' },
    )

    return reply.send({
      token,
      user: {
        id: userId ?? colaborador.id,
        colaboradorId: colaborador.id,
        nome: colaborador.primeiroNome || colaborador.nome.split(' ')[0],
        unitId,
        permissoes,
        hasUserAccount: !!userId,
        roles: roles.filter((r) => r.unitId === unitId),
      },
    })
  })

  // ============================================================
  // GET /totem/purchase-cycles/ativos — Ciclos abertos/reabertos para totem
  // ============================================================
  app.get('/purchase-cycles/ativos', { onRequest: [authenticateTotem] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const ciclos = await prisma.purchaseCycle.findMany({
      where: { status: { in: ['aberto', 'reaberto'] } },
      orderBy: { dataAbertura: 'desc' },
      select: {
        id: true,
        titulo: true,
        status: true,
        dataAbertura: true,
        dataFechamento: true,
      },
    })
    return reply.send(ciclos)
  })

  // ============================================================
  // GET /totem/products — Buscar produtos para requisição no totem
  // ============================================================
  app.get('/products', { onRequest: [authenticateTotem] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.query as any)
    const search = typeof query.search === 'string' ? query.search.trim() : ''

    const where: any = { status: 'ativo' }
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ]
    }

    const products = await prisma.product.findMany({
      where,
      take: 20,
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, unidadeMedida: true, sku: true },
    })

    return reply.send(products)
  })

  // ============================================================
  // POST /totem/purchase-cycles/:id/requests — Criar solicitação via totem
  // ============================================================
  app.post('/purchase-cycles/:id/requests', { onRequest: [authenticateTotem] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = (request.params as any)
    const body = (request.body as any)
    const user = (request as any).user

    if (!id || !body?.productId || !body?.quantidade) {
      return reply.status(400).send({ error: 'Dados incompletos', code: 'VALIDATION_ERROR' })
    }

    const ciclo = await prisma.purchaseCycle.findUnique({ where: { id } })
    if (!ciclo) return reply.status(404).send({ error: 'Ciclo nao encontrado', code: 'CYCLE_NOT_FOUND' })
    if (ciclo.status === 'fechado' || ciclo.status === 'consolidado') {
      return reply.status(400).send({ error: 'Ciclo nao esta aberto', code: 'CYCLE_CLOSED' })
    }
    if (ciclo.dataFechamento && new Date() > ciclo.dataFechamento) {
      return reply.status(400).send({ error: 'Prazo encerrado', code: 'CYCLE_DEADLINE_PASSED' })
    }

    const product = await prisma.product.findUnique({ where: { id: body.productId } })
    if (!product) return reply.status(404).send({ error: 'Produto nao encontrado', code: 'PRODUCT_NOT_FOUND' })

    const unitId = user.unitId
    if (!unitId) return reply.status(400).send({ error: 'Unidade nao identificada', code: 'UNIT_REQUIRED' })

    const solicitacao = await prisma.purchaseRequest.create({
      data: {
        cycleId: id,
        unitId,
        productId: body.productId,
        quantidade: Number(body.quantidade),
        observacao: body.observacao || null,
        marca: body.marca || null,
        ...(user.userId
          ? { solicitadoPorId: user.userId }
          : { solicitadoColaboradorId: user.colaboradorId }),
      },
      include: {
        product: { select: { id: true, nome: true, unidadeMedida: true } },
      },
    })

    return reply.status(201).send(solicitacao)
  })

  // ============================================================
  // POST /totem/encomendas — Criar encomenda via totem
  // ============================================================
  app.post('/encomendas', { onRequest: [authenticateTotem] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user
    const body = (request.body as any)

    if (!user.unitId) {
      return reply.status(400).send({ error: 'Unidade nao identificada', code: 'UNIT_REQUIRED' })
    }
    if (!body?.clienteNome || !body?.dataRetirada || !body?.horaRetirada) {
      return reply.status(400).send({ error: 'Dados obrigatorios ausentes', code: 'VALIDATION_ERROR' })
    }
    if (!Array.isArray(body.itens) || body.itens.length === 0) {
      return reply.status(400).send({ error: 'Adicione pelo menos 1 item', code: 'VALIDATION_ERROR' })
    }

    // Buscar nome do colaborador para registro quando nao ha conta de usuario
    let criadoPorNome: string | null = null
    if (!user.userId) {
      const colab = await prisma.colaborador.findUnique({
        where: { id: user.colaboradorId },
        select: { nome: true, primeiroNome: true },
      })
      criadoPorNome = colab?.primeiroNome || colab?.nome || 'Colaborador'
    }

    const encomenda = await prisma.encomenda.create({
      data: {
        unitId:          user.unitId,
        clienteNome:     String(body.clienteNome).trim(),
        clienteTelefone: body.clienteTelefone ? String(body.clienteTelefone) : null,
        dataRetirada:    new Date(body.dataRetirada),
        horaRetirada:    String(body.horaRetirada),
        observacoes:     body.observacoes ? String(body.observacoes) : null,
        valorCaucao:     Number(body.valorCaucao ?? 0),
        valorTotal:      Number(body.valorTotal ?? 0),
        criadoPorId:     user.userId ?? undefined,
        criadoPorNome:   criadoPorNome,
        itens: {
          create: body.itens.map((item: any) => ({
            descricao:  String(item.descricao).trim(),
            quantidade: Number(item.quantidade),
            unidade:    String(item.unidade ?? 'un'),
            observacao: item.observacao ? String(item.observacao) : null,
          })),
        },
      },
      include: {
        itens:     true,
        criadoPor: { select: { id: true, nome: true } },
        unit:      { select: { id: true, nome: true, codigo: true, endereco: true, telefone: true } },
      },
    })

    return reply.status(201).send(encomenda)
  })

  // ============================================================
  // GET /totem/encomendas — Listar encomendas pendentes/prontas do totem
  // ============================================================
  app.get('/encomendas', { onRequest: [authenticateTotem] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user
    if (!user.unitId) {
      return reply.status(400).send({ error: 'Unidade nao identificada', code: 'UNIT_REQUIRED' })
    }

    const encomendas = await prisma.encomenda.findMany({
      where: {
        unitId: user.unitId,
        status: { in: ['pendente', 'pronta'] },
      },
      include: {
        itens:     true,
        criadoPor: { select: { id: true, nome: true } },
        unit:      { select: { id: true, nome: true, codigo: true, endereco: true, telefone: true } },
      },
      orderBy: { dataRetirada: 'asc' },
    })

    return reply.send(encomendas)
  })

  // ============================================================
  // PATCH /totem/encomendas/:id/status — Atualizar status via totem
  // ============================================================
  app.patch('/encomendas/:id/status', { onRequest: [authenticateTotem] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user
    const { id } = (request.params as any)
    const body = (request.body as any)

    if (!id) return reply.status(400).send({ error: 'ID obrigatorio', code: 'VALIDATION_ERROR' })

    const status = body?.status
    if (!['pendente', 'pronta', 'retirada', 'cancelada'].includes(status)) {
      return reply.status(400).send({ error: 'Status invalido', code: 'VALIDATION_ERROR' })
    }

    const existing = await prisma.encomenda.findUnique({
      where: { id },
      select: { id: true, unitId: true, status: true },
    })

    if (!existing) return reply.status(404).send({ error: 'Encomenda nao encontrada', code: 'ENCOMENDA_NOT_FOUND' })
    if (existing.unitId !== user.unitId) return reply.status(403).send({ error: 'Sem permissao', code: 'FORBIDDEN' })

    const data: any = { status }
    if (status === 'retirada') {
      data.concluidoEm = new Date()
      if (user.userId) data.concluidoPorId = user.userId
    }

    const updated = await prisma.encomenda.update({
      where: { id },
      data,
      include: {
        itens:     true,
        criadoPor: { select: { id: true, nome: true } },
        unit:      { select: { id: true, nome: true, codigo: true, endereco: true, telefone: true } },
      },
    })

    return reply.send(updated)
  })

  // ============================================================
  // GET /totem/encomendas/:id/receipt-buffer — Buffer ESC/POS base64 (para agente local)
  // ============================================================
  app.get('/encomendas/:id/receipt-buffer', { onRequest: [authenticateTotem] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user
    const { id } = (request.params as any)

    if (!id) return reply.status(400).send({ error: 'ID obrigatorio', code: 'VALIDATION_ERROR' })

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

    if (encomenda.unitId !== user.unitId) {
      return reply.status(403).send({ error: 'Sem permissao', code: 'FORBIDDEN' })
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
      itens:           encomenda.itens.map((i) => ({ ...i, quantidade: Number(i.quantidade) })),
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

  // ============================================================
  // POST /totem/encomendas/:id/print — Impressao direta via TCP/ESC/POS
  // ============================================================
  app.post('/encomendas/:id/print', { onRequest: [authenticateTotem] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user
    const { id } = (request.params as any)

    if (!id) return reply.status(400).send({ error: 'ID obrigatorio', code: 'VALIDATION_ERROR' })

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

    if (encomenda.unitId !== user.unitId) {
      return reply.status(403).send({ error: 'Sem permissao', code: 'FORBIDDEN' })
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
      itens:           encomenda.itens.map((i) => ({ ...i, quantidade: Number(i.quantidade) })),
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

  // ============================================================
  // POST /totem/upload-foto — Upload de foto do checklist via totem
  // ============================================================
  app.post('/upload-foto', { onRequest: [authenticateTotem] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file()
    if (!data) {
      return reply.status(400).send({ error: 'Nenhum arquivo enviado', code: 'NO_FILE' })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!allowedTypes.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Tipo de arquivo invalido. Envie uma imagem.', code: 'INVALID_FILE_TYPE' })
    }

    const ext = data.mimetype.split('/')[1].replace('jpeg', 'jpg')
    const key = `checklist/fotos/${randomUUID()}.${ext}`
    const buffer = await data.toBuffer()

    const url = await uploadFile(key, buffer, data.mimetype)

    return reply.status(201).send({ url })
  })
}
