import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requirePermission } from '../../../middlewares/auth.middleware'
import { createAuditLog } from '../../../lib/audit'
import {
  createColaboradorSchema,
  updateColaboradorSchema,
  colaboradorIdParamSchema,
  colaboradorStatusSchema,
  listColaboradoresQuerySchema,
  enderecoSchema,
  contatoEmergenciaSchema,
  dependenteSchema,
  formacaoSchema,
  historicoSalarioSchema,
  historicoCargSchema,
  vincularUsuarioSchema,
  subIdParamSchema,
} from './colaborador.schemas'

// Campos de listagem — sem dados sensíveis
const colaboradorListSelect = {
  id: true,
  matricula: true,
  nome: true,
  primeiroNome: true,
  nomeSocial: true,
  email: true,
  emailCorporativo: true,
  telefone: true,
  celular: true,
  tipoContrato: true,
  dataAdmissao: true,
  status: true,
  fotoUrl: true,
  departamento: true,
  createdAt: true,
  unit: { select: { id: true, nome: true, codigo: true } },
  cargo: { select: { id: true, nome: true, nivel: true } },
  gestorDireto: { select: { id: true, nome: true, fotoUrl: true } },
}

// Gerador de PIN único de 6 dígitos para o totem
async function gerarPinUnico(): Promise<string> {
  let attempts = 0
  while (attempts < 20) {
    const pin = String(Math.floor(100000 + Math.random() * 900000))
    const exists = await prisma.colaborador.findUnique({ where: { pin }, select: { id: true } })
    if (!exists) return pin
    attempts++
  }
  throw new Error('Nao foi possivel gerar um PIN unico')
}

// Gerador de matrícula: COL-YYYYMMDD-XXXX
async function gerarMatricula(): Promise<string> {
  const hoje = new Date()
  const dataPart = hoje.toISOString().slice(0, 10).replace(/-/g, '')
  const count = await prisma.colaborador.count()
  const seq = String(count + 1).padStart(4, '0')
  return `COL-${dataPart}-${seq}`
}

export async function colaboradorRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // ============================================================
  // GET /lookup — Lista mínima para dropdowns (qualquer user autenticado)
  // ============================================================
  app.get('/lookup', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = z.object({
      unitId: z.string().uuid().optional(),
      status: z.enum(['ativo', 'inativo']).optional().default('ativo'),
    }).safeParse(request.query)

    if (!parsed.success) return reply.status(400).send({ error: 'Parametros invalidos', code: 'VALIDATION_ERROR' })

    const where: any = { status: parsed.data.status }
    if (parsed.data.unitId) where.unitId = parsed.data.unitId

    const colaboradores = await prisma.colaborador.findMany({
      where,
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        nomeSocial: true,
        matricula: true,
        cargo: { select: { nome: true } },
      },
      take: 300,
    })

    return reply.send({ data: colaboradores })
  })

  // ============================================================
  // GET / — Listar colaboradores
  // ============================================================
  app.get('/', { onRequest: [requirePermission('rh_colaboradores', 'visualizar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listColaboradoresQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Parametros invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { page, limit, search, unitId, cargoId, departamento, tipoContrato, status } = parsed.data
    const { skip, take } = calcPagination(page, limit)

    const where: any = {}
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { matricula: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (unitId) where.unitId = unitId
    if (cargoId) where.cargoId = cargoId
    if (departamento) where.departamento = { contains: departamento, mode: 'insensitive' }
    if (tipoContrato) where.tipoContrato = tipoContrato
    if (status) where.status = status

    const [colaboradores, total] = await Promise.all([
      prisma.colaborador.findMany({ where, skip, take, orderBy: { nome: 'asc' }, select: colaboradorListSelect }),
      prisma.colaborador.count({ where }),
    ])

    return reply.send({
      data: colaboradores,
      pagination: { page, limit, total, totalPages: calcTotalPages(total, limit) },
    })
  })

  // ============================================================
  // GET /:id — Perfil completo
  // ============================================================
  app.get('/:id', { onRequest: [requirePermission('rh_colaboradores', 'visualizar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const user = request.user as any
    const isGerenteGeral = user.roles?.some((r: any) => r.role === 'gerente_geral')
    const canVerSalario = isGerenteGeral // simplificado; expandir com permissão granular

    const colaborador = await prisma.colaborador.findUnique({
      where: { id: paramsParsed.data.id },
      include: {
        unit: { select: { id: true, nome: true, codigo: true } },
        cargo: { select: { id: true, nome: true, nivel: true, familia: { select: { id: true, nome: true } } } },
        gestorDireto: { select: { id: true, nome: true, fotoUrl: true, cargo: { select: { nome: true } } } },
        subordinados: { select: { id: true, nome: true, fotoUrl: true, cargo: { select: { nome: true } } } },
        endereco: true,
        contatosEmergencia: true,
        dependentes: true,
        formacoes: true,
        historicoSalarios: { orderBy: { dataEfetivo: 'desc' } },
        historicoCargos: {
          orderBy: { dataEfetivo: 'desc' },
        },
      },
    })

    if (!colaborador) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    // Remover dados sensíveis se não tiver permissão
    const result: any = { ...colaborador }
    if (!canVerSalario) {
      delete result.salarioBase
      result.historicoSalarios = []
    }

    return reply.send(result)
  })

  // ============================================================
  // POST / — Criar colaborador
  // ============================================================
  app.post('/', { onRequest: [requirePermission('rh_colaboradores', 'criar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createColaboradorSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    if (parsed.data.cpf) {
      const cpfExisting = await prisma.colaborador.findFirst({ where: { cpf: parsed.data.cpf } })
      if (cpfExisting) return reply.status(409).send({ error: 'CPF ja cadastrado para outro colaborador', code: 'CONFLICT' })
    }

    if (parsed.data.userId) {
      const userExists = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } })
      if (!userExists) return reply.status(404).send({ error: 'Usuario nao encontrado', code: 'NOT_FOUND' })

      const alreadyLinked = await prisma.colaborador.findFirst({ where: { userId: parsed.data.userId } })
      if (alreadyLinked) return reply.status(409).send({ error: 'Usuario ja vinculado a outro colaborador', code: 'CONFLICT' })
    }

    const matricula = await gerarMatricula()
    const pin = await gerarPinUnico()

    const colaborador = await prisma.colaborador.create({
      data: { ...parsed.data, matricula, pin },
      select: { ...colaboradorListSelect, pin: true },
    })

    // Registrar salário inicial no histórico se informado
    if (parsed.data.salarioBase) {
      const user = request.user as any
      await prisma.historicoSalario.create({
        data: {
          colaboradorId: colaborador.id,
          salarioNovo: parsed.data.salarioBase,
          motivo: 'admissao',
          dataEfetivo: parsed.data.dataAdmissao || new Date(),
          registradoPorId: user.userId,
        },
      })
    }

    await createAuditLog(request, 'criar_colaborador', 'Colaborador', colaborador.id, { nome: colaborador.nome, matricula })
    return reply.status(201).send(colaborador)
  })

  // ============================================================
  // PUT /:id — Atualizar dados
  // ============================================================
  app.put('/:id', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = updateColaboradorSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { id } = paramsParsed.data
    const existing = await prisma.colaborador.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    if (parsed.data.cpf && parsed.data.cpf !== existing.cpf) {
      const cpfConflict = await prisma.colaborador.findFirst({ where: { cpf: parsed.data.cpf, NOT: { id } } })
      if (cpfConflict) return reply.status(409).send({ error: 'CPF ja cadastrado', code: 'CONFLICT' })
    }

    const colaborador = await prisma.colaborador.update({
      where: { id },
      data: parsed.data,
      select: colaboradorListSelect,
    })

    await createAuditLog(request, 'editar_colaborador', 'Colaborador', id, parsed.data)
    return reply.send(colaborador)
  })

  // ============================================================
  // PATCH /:id/status
  // ============================================================
  app.patch('/:id/status', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = colaboradorStatusSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR' })

    const { id } = paramsParsed.data
    const existing = await prisma.colaborador.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    const colaborador = await prisma.colaborador.update({
      where: { id },
      data: { status: parsed.data.status },
      select: { id: true, matricula: true, nome: true, status: true },
    })
    await createAuditLog(request, 'alterar_status_colaborador', 'Colaborador', id, { status: parsed.data.status, motivo: parsed.data.motivo })
    return reply.send(colaborador)
  })

  // ============================================================
  // PATCH /:id/vincular-usuario
  // ============================================================
  app.patch('/:id/vincular-usuario', { onRequest: [requirePermission('rh_colaboradores', 'vincular_usuario')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = vincularUsuarioSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR' })

    const { id } = paramsParsed.data
    const existing = await prisma.colaborador.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    if (parsed.data.userId) {
      const userExists = await prisma.user.findUnique({ where: { id: parsed.data.userId } })
      if (!userExists) return reply.status(404).send({ error: 'Usuario nao encontrado', code: 'NOT_FOUND' })

      const alreadyLinked = await prisma.colaborador.findFirst({ where: { userId: parsed.data.userId, NOT: { id } } })
      if (alreadyLinked) return reply.status(409).send({ error: 'Usuario ja vinculado a outro colaborador', code: 'CONFLICT' })
    }

    const colaborador = await prisma.colaborador.update({
      where: { id },
      data: { userId: parsed.data.userId },
      select: { id: true, matricula: true, nome: true, userId: true },
    })
    await createAuditLog(request, 'vincular_usuario_colaborador', 'Colaborador', id, { userId: parsed.data.userId })
    return reply.send(colaborador)
  })

  // ============================================================
  // ENDERECO
  // ============================================================
  app.put('/:id/endereco', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = enderecoSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { id } = paramsParsed.data
    const existing = await prisma.colaborador.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    const endereco = await prisma.enderecoColaborador.upsert({
      where: { colaboradorId: id },
      create: { colaboradorId: id, ...parsed.data },
      update: parsed.data,
    })
    return reply.send(endereco)
  })

  // ============================================================
  // CONTATOS DE EMERGENCIA
  // ============================================================
  app.post('/:id/contatos-emergencia', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = contatoEmergenciaSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { id } = paramsParsed.data
    const existing = await prisma.colaborador.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    const contato = await prisma.contatoEmergencia.create({ data: { colaboradorId: id, ...parsed.data } })
    return reply.status(201).send(contato)
  })

  app.delete('/:id/contatos-emergencia/:subId', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = subIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'IDs invalidos', code: 'VALIDATION_ERROR' })

    const existing = await prisma.contatoEmergencia.findUnique({ where: { id: paramsParsed.data.subId } })
    if (!existing) return reply.status(404).send({ error: 'Contato nao encontrado', code: 'NOT_FOUND' })

    await prisma.contatoEmergencia.delete({ where: { id: paramsParsed.data.subId } })
    return reply.status(204).send()
  })

  // ============================================================
  // DEPENDENTES
  // ============================================================
  app.post('/:id/dependentes', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = dependenteSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { id } = paramsParsed.data
    const existing = await prisma.colaborador.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    const dependente = await prisma.dependente.create({ data: { colaboradorId: id, ...parsed.data } })
    return reply.status(201).send(dependente)
  })

  app.delete('/:id/dependentes/:subId', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = subIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'IDs invalidos', code: 'VALIDATION_ERROR' })

    const existing = await prisma.dependente.findUnique({ where: { id: paramsParsed.data.subId } })
    if (!existing) return reply.status(404).send({ error: 'Dependente nao encontrado', code: 'NOT_FOUND' })

    await prisma.dependente.delete({ where: { id: paramsParsed.data.subId } })
    return reply.status(204).send()
  })

  // ============================================================
  // FORMACAO ACADEMICA
  // ============================================================
  app.post('/:id/formacoes', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = formacaoSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { id } = paramsParsed.data
    const existing = await prisma.colaborador.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    const formacao = await prisma.formacaoAcademica.create({ data: { colaboradorId: id, ...parsed.data } })
    return reply.status(201).send(formacao)
  })

  app.delete('/:id/formacoes/:subId', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = subIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'IDs invalidos', code: 'VALIDATION_ERROR' })

    const existing = await prisma.formacaoAcademica.findUnique({ where: { id: paramsParsed.data.subId } })
    if (!existing) return reply.status(404).send({ error: 'Formacao nao encontrada', code: 'NOT_FOUND' })

    await prisma.formacaoAcademica.delete({ where: { id: paramsParsed.data.subId } })
    return reply.status(204).send()
  })

  // ============================================================
  // HISTORICO SALARIAL
  // ============================================================
  app.get('/:id/historico-salarios', { onRequest: [requirePermission('rh_colaboradores', 'ver_salario')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const historico = await prisma.historicoSalario.findMany({
      where: { colaboradorId: paramsParsed.data.id },
      orderBy: { dataEfetivo: 'desc' },
    })
    return reply.send(historico)
  })

  app.post('/:id/historico-salarios', { onRequest: [requirePermission('rh_colaboradores', 'editar_salario')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = historicoSalarioSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { id } = paramsParsed.data
    const colaborador = await prisma.colaborador.findUnique({ where: { id }, select: { id: true, salarioBase: true } })
    if (!colaborador) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    const user = request.user as any
    const registro = await prisma.historicoSalario.create({
      data: {
        colaboradorId: id,
        salarioAnterior: colaborador.salarioBase,
        salarioNovo: parsed.data.salarioNovo,
        motivo: parsed.data.motivo,
        dataEfetivo: parsed.data.dataEfetivo,
        registradoPorId: user.userId,
      },
    })

    // Atualizar salário atual do colaborador
    await prisma.colaborador.update({ where: { id }, data: { salarioBase: parsed.data.salarioNovo } })

    await createAuditLog(request, 'atualizar_salario', 'Colaborador', id, { salarioAnterior: colaborador.salarioBase, salarioNovo: parsed.data.salarioNovo })
    return reply.status(201).send(registro)
  })

  // ============================================================
  // HISTORICO DE CARGOS
  // ============================================================
  app.get('/:id/historico-cargos', { onRequest: [requirePermission('rh_colaboradores', 'visualizar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const historico = await prisma.historicoCargo.findMany({
      where: { colaboradorId: paramsParsed.data.id },
      orderBy: { dataEfetivo: 'desc' },
    })

    // Enrich with cargo names
    const cargoIds = [...new Set([
      ...historico.map((h: any) => h.cargoNovoId),
      ...historico.map((h: any) => h.cargoAnteriorId).filter(Boolean),
    ])]
    const cargos = await prisma.cargo.findMany({
      where: { id: { in: cargoIds } },
      select: { id: true, nome: true, nivel: true },
    })
    const cargoMap = Object.fromEntries(cargos.map((c: any) => [c.id, c]))

    const enriched = historico.map((h: any) => ({
      ...h,
      cargoNovo: cargoMap[h.cargoNovoId] || null,
      cargoAnterior: h.cargoAnteriorId ? cargoMap[h.cargoAnteriorId] || null : null,
    }))

    return reply.send(enriched)
  })

  app.post('/:id/historico-cargos', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = historicoCargSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { id } = paramsParsed.data
    const colaborador = await prisma.colaborador.findUnique({ where: { id }, select: { id: true, cargoId: true } })
    if (!colaborador) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    const user = request.user as any
    const registro = await prisma.historicoCargo.create({
      data: {
        colaboradorId: id,
        cargoAnteriorId: colaborador.cargoId,
        cargoNovoId: parsed.data.cargoNovoId,
        motivo: parsed.data.motivo,
        dataEfetivo: parsed.data.dataEfetivo,
        registradoPorId: user.userId,
      },
    })

    // Atualizar cargo atual do colaborador
    await prisma.colaborador.update({ where: { id }, data: { cargoId: parsed.data.cargoNovoId } })

    await createAuditLog(request, 'promover_colaborador', 'Colaborador', id, { cargoNovoId: parsed.data.cargoNovoId })
    return reply.status(201).send(registro)
  })

  // ============================================================
  // GET /:id/pin — Ver PIN do totem (admin)
  // ============================================================
  app.get('/:id/pin', { onRequest: [requirePermission('rh_colaboradores', 'visualizar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const colab = await prisma.colaborador.findUnique({
      where: { id: paramsParsed.data.id },
      select: { id: true, nome: true, matricula: true, pin: true },
    })
    if (!colab) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    return reply.send({ id: colab.id, nome: colab.nome, matricula: colab.matricula, pin: colab.pin })
  })

  // ============================================================
  // POST /:id/regenerate-pin — Regenerar PIN do totem
  // ============================================================
  app.post('/:id/regenerate-pin', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const colab = await prisma.colaborador.findUnique({ where: { id: paramsParsed.data.id }, select: { id: true } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    const pin = await gerarPinUnico()
    await prisma.colaborador.update({ where: { id: paramsParsed.data.id }, data: { pin } })

    await createAuditLog(request, 'regenerar_pin_totem', 'Colaborador', paramsParsed.data.id)
    return reply.send({ pin })
  })

  // ============================================================
  // GET /:id/totem-permissoes — Listar unidades e permissões do totem
  // ============================================================
  app.get('/:id/totem-permissoes', { onRequest: [requirePermission('rh_colaboradores', 'visualizar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = colaboradorIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const unidades = await prisma.colaboradorUnit.findMany({
      where: { colaboradorId: paramsParsed.data.id },
      include: {
        unit: { select: { id: true, nome: true, codigo: true } },
        permissoes: { select: { permissao: true } },
      },
      orderBy: { unit: { nome: 'asc' } },
    })

    return reply.send(unidades.map((u) => ({
      unitId: u.unitId,
      unit: u.unit,
      permissoes: u.permissoes.map((p) => p.permissao),
    })))
  })

  // ============================================================
  // PUT /:id/totem-permissoes/:unitId — Definir permissões de uma unidade (upsert)
  // ============================================================
  app.put('/:id/totem-permissoes/:unitId', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = z.object({
      id: z.string().uuid(),
      unitId: z.string().uuid(),
    }).safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const bodyParsed = z.object({
      permissoes: z.array(z.enum([
        'checklists', 'contagem_utensilios', 'contagem_paes',
        'contagem_descartes', 'contagem_transferencias', 'requisicoes',
      ])),
    }).safeParse(request.body)
    if (!bodyParsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR' })

    const { id: colaboradorId, unitId } = paramsParsed.data
    const { permissoes } = bodyParsed.data

    const colab = await prisma.colaborador.findUnique({ where: { id: colaboradorId }, select: { id: true } })
    if (!colab) return reply.status(404).send({ error: 'Colaborador nao encontrado', code: 'NOT_FOUND' })

    const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } })
    if (!unit) return reply.status(404).send({ error: 'Unidade nao encontrada', code: 'NOT_FOUND' })

    // Upsert do ColaboradorUnit
    const colaboradorUnit = await prisma.colaboradorUnit.upsert({
      where: { colaboradorId_unitId: { colaboradorId, unitId } },
      create: { colaboradorId, unitId },
      update: {},
    })

    // Substituir permissões
    await prisma.totemPermissao.deleteMany({ where: { colaboradorUnitId: colaboradorUnit.id } })
    if (permissoes.length > 0) {
      await prisma.totemPermissao.createMany({
        data: permissoes.map((p) => ({ colaboradorUnitId: colaboradorUnit.id, permissao: p as any })),
      })
    }

    await createAuditLog(request, 'atualizar_totem_permissoes', 'ColaboradorUnit', colaboradorUnit.id, { unitId, permissoes })
    return reply.send({ unitId, permissoes })
  })

  // ============================================================
  // DELETE /:id/totem-permissoes/:unitId — Remover acesso ao totem em uma unidade
  // ============================================================
  app.delete('/:id/totem-permissoes/:unitId', { onRequest: [requirePermission('rh_colaboradores', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = z.object({
      id: z.string().uuid(),
      unitId: z.string().uuid(),
    }).safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const { id: colaboradorId, unitId } = paramsParsed.data

    await prisma.colaboradorUnit.deleteMany({ where: { colaboradorId, unitId } })

    await createAuditLog(request, 'remover_totem_acesso', 'ColaboradorUnit', colaboradorId, { unitId })
    return reply.status(204).send()
  })
}
