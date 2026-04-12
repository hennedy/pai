import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requirePermission } from '../../../middlewares/auth.middleware'
import { createAuditLog } from '../../../lib/audit'
import {
  createFamiliaSchema,
  updateFamiliaSchema,
  familiaIdParamSchema,
  createCargoSchema,
  updateCargoSchema,
  cargoIdParamSchema,
  cargoStatusSchema,
  listCargosQuerySchema,
  createFaixaSchema,
  faixaIdParamSchema,
} from './cargo.schemas'

export async function cargoRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // ============================================================
  // FAMILIAS DE CARGOS
  // ============================================================

  // GET /familias
  app.get('/familias', { onRequest: [requirePermission('rh_cargos', 'visualizar')] }, async (_req, reply) => {
    const familias = await prisma.familiaCargo.findMany({
      orderBy: { nome: 'asc' },
      include: { _count: { select: { cargos: true } } },
    })
    return reply.send(familias)
  })

  // POST /familias
  app.post('/familias', { onRequest: [requirePermission('rh_cargos', 'criar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createFamiliaSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })
    }

    const existing = await prisma.familiaCargo.findFirst({ where: { nome: parsed.data.nome } })
    if (existing) {
      return reply.status(409).send({ error: 'Familia ja existe com este nome', code: 'CONFLICT' })
    }

    const familia = await prisma.familiaCargo.create({ data: parsed.data })
    await createAuditLog(request, 'criar_familia_cargo', 'FamiliaCargo', familia.id, { nome: familia.nome })
    return reply.status(201).send(familia)
  })

  // PUT /familias/:id
  app.put('/familias/:id', { onRequest: [requirePermission('rh_cargos', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = familiaIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = updateFamiliaSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { id } = paramsParsed.data
    const existing = await prisma.familiaCargo.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Familia nao encontrada', code: 'NOT_FOUND' })

    const familia = await prisma.familiaCargo.update({ where: { id }, data: parsed.data })
    await createAuditLog(request, 'editar_familia_cargo', 'FamiliaCargo', id, parsed.data)
    return reply.send(familia)
  })

  // DELETE /familias/:id
  app.delete('/familias/:id', { onRequest: [requirePermission('rh_cargos', 'excluir')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = familiaIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const { id } = paramsParsed.data
    const existing = await prisma.familiaCargo.findUnique({ where: { id }, include: { _count: { select: { cargos: true } } } })
    if (!existing) return reply.status(404).send({ error: 'Familia nao encontrada', code: 'NOT_FOUND' })
    if (existing._count.cargos > 0) return reply.status(409).send({ error: 'Familia possui cargos vinculados', code: 'CONFLICT' })

    await prisma.familiaCargo.delete({ where: { id } })
    await createAuditLog(request, 'excluir_familia_cargo', 'FamiliaCargo', id, {})
    return reply.status(204).send()
  })

  // ============================================================
  // CARGOS
  // ============================================================

  // GET / — listar cargos
  app.get('/', { onRequest: [requirePermission('rh_cargos', 'visualizar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listCargosQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Parametros invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { page, limit, search, familiaId, nivel, status } = parsed.data
    const { skip, take } = calcPagination(page, limit)

    const where: any = {}
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (familiaId) where.familiaId = familiaId
    if (nivel) where.nivel = nivel
    if (status) where.status = status

    const [cargos, total] = await Promise.all([
      prisma.cargo.findMany({
        where,
        skip,
        take,
        orderBy: [{ familia: { nome: 'asc' } }, { nome: 'asc' }],
        include: {
          familia: { select: { id: true, nome: true } },
          _count: { select: { colaboradores: true, faixas: true } },
        },
      }),
      prisma.cargo.count({ where }),
    ])

    return reply.send({
      data: cargos,
      pagination: { page, limit, total, totalPages: calcTotalPages(total, limit) },
    })
  })

  // GET /estrutura — hierarquia completa familia → cargo
  app.get('/estrutura', { onRequest: [requirePermission('rh_cargos', 'visualizar')] }, async (_req, reply) => {
    const familias = await prisma.familiaCargo.findMany({
      orderBy: { nome: 'asc' },
      include: {
        cargos: {
          where: { status: 'ativo' },
          orderBy: [{ nivel: 'asc' }, { nome: 'asc' }],
          include: { _count: { select: { colaboradores: true } } },
        },
      },
    })

    const semFamilia = await prisma.cargo.findMany({
      where: { familiaId: null, status: 'ativo' },
      orderBy: { nome: 'asc' },
      include: { _count: { select: { colaboradores: true } } },
    })

    return reply.send({ familias, semFamilia })
  })

  // GET /:id
  app.get('/:id', { onRequest: [requirePermission('rh_cargos', 'visualizar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = cargoIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const cargo = await prisma.cargo.findUnique({
      where: { id: paramsParsed.data.id },
      include: {
        familia: { select: { id: true, nome: true } },
        faixas: { orderBy: [{ nivel: 'asc' }, { vigenteDe: 'desc' }] },
        _count: { select: { colaboradores: true } },
      },
    })
    if (!cargo) return reply.status(404).send({ error: 'Cargo nao encontrado', code: 'NOT_FOUND' })
    return reply.send(cargo)
  })

  // GET /:id/colaboradores
  app.get('/:id/colaboradores', { onRequest: [requirePermission('rh_cargos', 'visualizar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = cargoIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const colaboradores = await prisma.colaborador.findMany({
      where: { cargoId: paramsParsed.data.id, status: { not: 'desligado' } },
      select: { id: true, matricula: true, nome: true, status: true, dataAdmissao: true, unit: { select: { id: true, nome: true, codigo: true } } },
      orderBy: { nome: 'asc' },
    })
    return reply.send(colaboradores)
  })

  // POST /
  app.post('/', { onRequest: [requirePermission('rh_cargos', 'criar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createCargoSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    if (parsed.data.codigo) {
      const existing = await prisma.cargo.findFirst({ where: { codigo: parsed.data.codigo } })
      if (existing) return reply.status(409).send({ error: 'Codigo ja utilizado por outro cargo', code: 'CONFLICT' })
    }

    const cargo = await prisma.cargo.create({
      data: parsed.data,
      include: { familia: { select: { id: true, nome: true } } },
    })
    await createAuditLog(request, 'criar_cargo', 'Cargo', cargo.id, { nome: cargo.nome })
    return reply.status(201).send(cargo)
  })

  // PUT /:id
  app.put('/:id', { onRequest: [requirePermission('rh_cargos', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = cargoIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = updateCargoSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { id } = paramsParsed.data
    const existing = await prisma.cargo.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Cargo nao encontrado', code: 'NOT_FOUND' })

    if (parsed.data.codigo && parsed.data.codigo !== existing.codigo) {
      const codeConflict = await prisma.cargo.findFirst({ where: { codigo: parsed.data.codigo, NOT: { id } } })
      if (codeConflict) return reply.status(409).send({ error: 'Codigo ja utilizado por outro cargo', code: 'CONFLICT' })
    }

    const cargo = await prisma.cargo.update({
      where: { id },
      data: parsed.data,
      include: { familia: { select: { id: true, nome: true } } },
    })
    await createAuditLog(request, 'editar_cargo', 'Cargo', id, parsed.data)
    return reply.send(cargo)
  })

  // PATCH /:id/status
  app.patch('/:id/status', { onRequest: [requirePermission('rh_cargos', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = cargoIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = cargoStatusSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR' })

    const { id } = paramsParsed.data
    const existing = await prisma.cargo.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Cargo nao encontrado', code: 'NOT_FOUND' })

    const cargo = await prisma.cargo.update({ where: { id }, data: { status: parsed.data.status } })
    await createAuditLog(request, 'alterar_status_cargo', 'Cargo', id, { status: parsed.data.status })
    return reply.send(cargo)
  })

  // ============================================================
  // FAIXAS SALARIAIS
  // ============================================================

  // POST /:id/faixas
  app.post('/:id/faixas', { onRequest: [requirePermission('rh_cargos', 'faixas')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = cargoIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })

    const parsed = createFaixaSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { id } = paramsParsed.data
    const cargo = await prisma.cargo.findUnique({ where: { id } })
    if (!cargo) return reply.status(404).send({ error: 'Cargo nao encontrado', code: 'NOT_FOUND' })

    const faixa = await prisma.faixaSalarial.create({
      data: { cargoId: id, ...parsed.data },
    })
    await createAuditLog(request, 'criar_faixa_salarial', 'FaixaSalarial', faixa.id, { cargoId: id, nivel: faixa.nivel })
    return reply.status(201).send(faixa)
  })

  // PUT /:id/faixas/:faixaId
  app.put('/:id/faixas/:faixaId', { onRequest: [requirePermission('rh_cargos', 'faixas')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = faixaIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'IDs invalidos', code: 'VALIDATION_ERROR' })

    const parsed = createFaixaSchema.partial().safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Dados invalidos', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })

    const { faixaId } = paramsParsed.data
    const existing = await prisma.faixaSalarial.findUnique({ where: { id: faixaId } })
    if (!existing) return reply.status(404).send({ error: 'Faixa nao encontrada', code: 'NOT_FOUND' })

    const faixa = await prisma.faixaSalarial.update({ where: { id: faixaId }, data: parsed.data })
    await createAuditLog(request, 'editar_faixa_salarial', 'FaixaSalarial', faixaId, parsed.data)
    return reply.send(faixa)
  })

  // DELETE /:id/faixas/:faixaId
  app.delete('/:id/faixas/:faixaId', { onRequest: [requirePermission('rh_cargos', 'faixas')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = faixaIdParamSchema.safeParse(request.params)
    if (!paramsParsed.success) return reply.status(400).send({ error: 'IDs invalidos', code: 'VALIDATION_ERROR' })

    const { faixaId } = paramsParsed.data
    const existing = await prisma.faixaSalarial.findUnique({ where: { id: faixaId } })
    if (!existing) return reply.status(404).send({ error: 'Faixa nao encontrada', code: 'NOT_FOUND' })

    await prisma.faixaSalarial.delete({ where: { id: faixaId } })
    await createAuditLog(request, 'excluir_faixa_salarial', 'FaixaSalarial', faixaId, {})
    return reply.status(204).send()
  })
}
