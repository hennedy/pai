import type { FastifyInstance } from 'fastify'
import { prisma, Prisma } from '@pai/database'
import { calcPagination, calcTotalPages, generateUnitCode } from '@pai/utils'
import { authenticate, requireRole, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  listUnitsQuerySchema,
  createUnitSchema,
  updateUnitSchema,
  updateUnitStatusSchema,
  unitIdParamSchema,
  createUnitIntegrationSchema,
  updateUnitIntegrationSchema,
  unitIntegrationIdParamSchema,
  createSectorSchema,
  updateSectorSchema,
  sectorIdParamSchema,
} from './unit.schemas'

const unitSelect = {
  id: true,
  nome: true,
  razaoSocial: true,
  cnpj: true,
  codigo: true,
  endereco: true,
  telefone: true,
  email: true,
  responsavelId: true,
  horarioAbertura: true,
  horarioFechamento: true,
  diasFuncionamento: true,
  latitude: true,
  longitude: true,
  raioValidacaoMetros: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  responsavel: {
    select: { id: true, nome: true, email: true },
  },
}

export async function unitRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticacao
  app.addHook('onRequest', authenticate)

  // =====================================================
  // GET / - Listar unidades
  // =====================================================
  app.get('/', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'supervisor', 'producao', 'administrativo'), requireUnit()],
  }, async (request, reply) => {
    const query = listUnitsQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)
    const unitFilter = getUnitFilter(request)

    const where: any = {}

    if (query.status) {
      where.status = query.status
    }

    if (query.search) {
      where.OR = [
        { nome: { contains: query.search, mode: 'insensitive' } },
        { codigo: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    if (unitFilter.unitId) {
      if (typeof unitFilter.unitId === 'object' && 'in' in unitFilter.unitId) {
        where.id = { in: (unitFilter.unitId as any).in }
      } else {
        where.id = unitFilter.unitId
      }
    }

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        select: unitSelect,
        skip,
        take,
        orderBy: { nome: 'asc' },
      }),
      prisma.unit.count({ where }),
    ])

    return reply.send({
      data: units,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
    })
  })

  // =====================================================
  // GET /:id - Buscar unidade por ID (com integracoes)
  // =====================================================
  app.get('/:id', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'supervisor', 'producao', 'administrativo'), requireUnit()],
  }, async (request, reply) => {
    const { id } = unitIdParamSchema.parse(request.params)

    const unit = await prisma.unit.findUnique({
      where: { id },
      select: {
        ...unitSelect,
        integrations: {
          select: {
            id: true,
            tipo: true,
            nome: true,
            status: true,
            configuracao: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { tipo: 'asc' },
        },
      },
    })

    if (!unit) {
      return reply.status(404).send({
        error: 'Unidade nao encontrada',
        code: 'UNIT_NOT_FOUND',
      })
    }

    return reply.send(unit)
  })

  // =====================================================
  // POST / - Criar nova unidade
  // =====================================================
  app.post('/', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const body = createUnitSchema.parse(request.body)

    // Gerar codigo sequencial
    const lastUnit = await prisma.unit.findFirst({
      where: { codigo: { startsWith: 'PAD-' } },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    })

    let nextSequence = 1
    if (lastUnit) {
      const lastNumber = parseInt(lastUnit.codigo.replace('PAD-', ''), 10)
      if (!isNaN(lastNumber)) {
        nextSequence = lastNumber + 1
      }
    }

    const codigo = generateUnitCode(nextSequence)

    const codigoExists = await prisma.unit.findUnique({
      where: { codigo },
      select: { id: true },
    })

    if (codigoExists) {
      return reply.status(409).send({
        error: 'Codigo de unidade ja existe. Tente novamente.',
        code: 'UNIT_CODE_CONFLICT',
      })
    }

    const unit = await prisma.unit.create({
      data: {
        nome: body.nome,
        razaoSocial: body.razaoSocial ?? null,
        cnpj: body.cnpj ?? null,
        codigo,
        endereco: body.endereco ?? null,
        telefone: body.telefone ?? null,
        email: body.email ?? null,
        responsavelId: body.responsavelId ?? null,
        horarioAbertura: body.horarioAbertura ?? null,
        horarioFechamento: body.horarioFechamento ?? null,
        diasFuncionamento: (body.diasFuncionamento ?? null) as any,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        raioValidacaoMetros: body.raioValidacaoMetros ?? null,
      },
      select: unitSelect,
    })

    await createAuditLog(request, 'criar_unidade', 'Unit', unit.id, {
      nome: body.nome,
      codigo,
    })

    return reply.status(201).send(unit)
  })

  // =====================================================
  // PUT /:id - Editar unidade existente
  // =====================================================
  app.put('/:id', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { id } = unitIdParamSchema.parse(request.params)
    const body = updateUnitSchema.parse(request.body)

    const existingUnit = await prisma.unit.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existingUnit) {
      return reply.status(404).send({
        error: 'Unidade nao encontrada',
        code: 'UNIT_NOT_FOUND',
      })
    }

    const updateData: any = {}
    if (body.nome !== undefined) updateData.nome = body.nome
    if (body.razaoSocial !== undefined) updateData.razaoSocial = body.razaoSocial
    if (body.cnpj !== undefined) updateData.cnpj = body.cnpj
    if (body.endereco !== undefined) updateData.endereco = body.endereco
    if (body.telefone !== undefined) updateData.telefone = body.telefone
    if (body.email !== undefined) updateData.email = body.email
    if (body.responsavelId !== undefined) updateData.responsavelId = body.responsavelId
    if (body.horarioAbertura !== undefined) updateData.horarioAbertura = body.horarioAbertura
    if (body.horarioFechamento !== undefined) updateData.horarioFechamento = body.horarioFechamento
    if (body.diasFuncionamento !== undefined) updateData.diasFuncionamento = body.diasFuncionamento
    if (body.latitude !== undefined) updateData.latitude = body.latitude
    if (body.longitude !== undefined) updateData.longitude = body.longitude
    if (body.raioValidacaoMetros !== undefined) updateData.raioValidacaoMetros = body.raioValidacaoMetros

    const updatedUnit = await prisma.unit.update({
      where: { id },
      data: updateData,
      select: unitSelect,
    })

    await createAuditLog(request, 'editar_unidade', 'Unit', id, {
      campos_alterados: Object.keys(updateData),
    })

    return reply.send(updatedUnit)
  })

  // =====================================================
  // PATCH /:id/status - Ativar/desativar unidade
  // =====================================================
  app.patch('/:id/status', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { id } = unitIdParamSchema.parse(request.params)
    const body = updateUnitStatusSchema.parse(request.body)

    const existingUnit = await prisma.unit.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!existingUnit) {
      return reply.status(404).send({
        error: 'Unidade nao encontrada',
        code: 'UNIT_NOT_FOUND',
      })
    }

    const updatedUnit = await prisma.unit.update({
      where: { id },
      data: { status: body.status },
      select: unitSelect,
    })

    await createAuditLog(request, 'alterar_status_unidade', 'Unit', id, {
      statusAnterior: existingUnit.status,
      statusNovo: body.status,
    })

    return reply.send(updatedUnit)
  })

  // =====================================================
  // UNIT INTEGRATIONS
  // =====================================================

  // GET /:id/integrations - Listar integracoes de uma unidade
  app.get('/:id/integrations', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'administrativo'), requireUnit()],
  }, async (request, reply) => {
    const { id } = unitIdParamSchema.parse(request.params)

    const integrations = await prisma.unitIntegration.findMany({
      where: { unitId: id },
      orderBy: { tipo: 'asc' },
    })

    return reply.send({ data: integrations })
  })

  // POST /:id/integrations - Criar integracao para unidade
  app.post('/:id/integrations', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { id } = unitIdParamSchema.parse(request.params)
    const body = createUnitIntegrationSchema.parse(request.body)

    // Verificar se unidade existe
    const unit = await prisma.unit.findUnique({ where: { id }, select: { id: true } })
    if (!unit) {
      return reply.status(404).send({ error: 'Unidade nao encontrada', code: 'UNIT_NOT_FOUND' })
    }

    // Verificar se ja existe integracao desse tipo para a unidade
    const existing = await prisma.unitIntegration.findUnique({
      where: { unitId_tipo: { unitId: id, tipo: body.tipo as any } },
    })
    if (existing) {
      return reply.status(409).send({
        error: `Ja existe uma integracao do tipo "${body.tipo}" para esta unidade`,
        code: 'INTEGRATION_TYPE_EXISTS',
      })
    }

    const integration = await prisma.unitIntegration.create({
      data: {
        unitId: id,
        tipo: body.tipo as any,
        nome: body.nome,
        configuracao: (body.configuracao ?? null) as any,
      },
    })

    await createAuditLog(request, 'criar_integracao_unidade', 'UnitIntegration', integration.id, {
      unitId: id,
      tipo: body.tipo,
    })

    return reply.status(201).send(integration)
  })

  // PUT /:id/integrations/:integrationId - Atualizar integracao
  app.put('/:id/integrations/:integrationId', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { id, integrationId } = unitIntegrationIdParamSchema.parse(request.params)
    const body = updateUnitIntegrationSchema.parse(request.body)

    const existing = await prisma.unitIntegration.findFirst({
      where: { id: integrationId, unitId: id },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Integracao nao encontrada', code: 'INTEGRATION_NOT_FOUND' })
    }

    const updateData: any = {}
    if (body.nome !== undefined) updateData.nome = body.nome
    if (body.status !== undefined) updateData.status = body.status
    if (body.configuracao !== undefined) updateData.configuracao = body.configuracao

    const updated = await prisma.unitIntegration.update({
      where: { id: integrationId },
      data: updateData,
    })

    await createAuditLog(request, 'editar_integracao_unidade', 'UnitIntegration', integrationId, {
      unitId: id,
      campos_alterados: Object.keys(updateData),
    })

    return reply.send(updated)
  })

  // DELETE /:id/integrations/:integrationId - Remover integracao
  app.delete('/:id/integrations/:integrationId', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { id, integrationId } = unitIntegrationIdParamSchema.parse(request.params)

    const existing = await prisma.unitIntegration.findFirst({
      where: { id: integrationId, unitId: id },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Integracao nao encontrada', code: 'INTEGRATION_NOT_FOUND' })
    }

    await prisma.unitIntegration.delete({ where: { id: integrationId } })

    await createAuditLog(request, 'remover_integracao_unidade', 'UnitIntegration', integrationId, {
      unitId: id,
      tipo: existing.tipo,
    })

    return reply.send({ success: true })
  })

  // =====================================================
  // UNIT SECTORS (Setores da Unidade)
  // =====================================================

  // GET /:id/sectors - Listar setores da unidade
  app.get('/:id/sectors', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'supervisor', 'administrativo'), requireUnit()],
  }, async (request, reply) => {
    const { id } = unitIdParamSchema.parse(request.params)

    const sectorUnits = await prisma.sectorUnit.findMany({
      where: { unitId: id },
      include: { sector: true },
      orderBy: { sector: { nome: 'asc' } },
    })

    return reply.send({ data: sectorUnits.map((su) => su.sector) })
  })
}
