import type { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  createSetorSchema,
  updateSetorSchema,
  setorIdParamSchema,
  listSetoresQuerySchema,
} from './setor.schemas'

export async function setorRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // GET /setores - Listar todos os setores
  app.get('/', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'supervisor', 'administrativo')],
  }, async (request, reply) => {
    const parsed = listSetoresQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, search, status, unitId } = parsed.data
    const skip = (page - 1) * limit

    const where: any = {}
    if (search) {
      where.nome = { contains: search, mode: 'insensitive' }
    }
    if (status) {
      where.status = status
    }
    if (unitId) {
      where.units = { some: { unitId } }
    }

    const [data, total] = await Promise.all([
      prisma.sector.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: 'asc' },
        include: {
          units: {
            include: {
              unit: { select: { id: true, nome: true, codigo: true } },
            },
          },
          _count: { select: { checklistTemplates: true } },
        },
      }),
      prisma.sector.count({ where }),
    ])

    return reply.send({
      data: data.map((s) => ({
        ...s,
        units: s.units.map((su) => su.unit),
        checklistCount: s._count.checklistTemplates,
        _count: undefined,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  })

  // POST /setores - Criar setor
  app.post('/', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const parsed = createSetorSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { nome, unitIds } = parsed.data

    // Verificar que as unidades existem
    const units = await prisma.unit.findMany({
      where: { id: { in: unitIds } },
      select: { id: true },
    })
    if (units.length !== unitIds.length) {
      return reply.status(400).send({ error: 'Uma ou mais unidades não encontradas', code: 'UNIT_NOT_FOUND' })
    }

    const sector = await prisma.sector.create({
      data: {
        nome,
        units: {
          create: unitIds.map((unitId) => ({ unitId })),
        },
      },
      include: {
        units: {
          include: { unit: { select: { id: true, nome: true, codigo: true } } },
        },
      },
    })

    await createAuditLog(request, 'criar_setor', 'Sector', sector.id, {
      nome,
      unitIds,
    })

    return reply.status(201).send({
      ...sector,
      units: sector.units.map((su) => su.unit),
    })
  })

  // GET /setores/:id - Buscar setor por ID
  app.get('/:id', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'supervisor', 'administrativo')],
  }, async (request, reply) => {
    const { id } = setorIdParamSchema.parse(request.params)

    const sector = await prisma.sector.findUnique({
      where: { id },
      include: {
        units: {
          include: { unit: { select: { id: true, nome: true, codigo: true } } },
        },
        _count: { select: { checklistTemplates: true } },
      },
    })

    if (!sector) {
      return reply.status(404).send({ error: 'Setor não encontrado', code: 'SECTOR_NOT_FOUND' })
    }

    return reply.send({
      ...sector,
      units: sector.units.map((su) => su.unit),
      checklistCount: sector._count.checklistTemplates,
      _count: undefined,
    })
  })

  // PUT /setores/:id - Atualizar setor
  app.put('/:id', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { id } = setorIdParamSchema.parse(request.params)
    const parsed = updateSetorSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const existing = await prisma.sector.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ error: 'Setor não encontrado', code: 'SECTOR_NOT_FOUND' })
    }

    const { nome, status, unitIds } = parsed.data

    const updateData: any = {}
    if (nome !== undefined) updateData.nome = nome
    if (status !== undefined) updateData.status = status

    // Atualizar unidades se fornecido
    if (unitIds !== undefined) {
      const units = await prisma.unit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true },
      })
      if (units.length !== unitIds.length) {
        return reply.status(400).send({ error: 'Uma ou mais unidades não encontradas', code: 'UNIT_NOT_FOUND' })
      }
      // Substituir relações
      await prisma.sectorUnit.deleteMany({ where: { sectorId: id } })
      await prisma.sectorUnit.createMany({
        data: unitIds.map((unitId) => ({ sectorId: id, unitId })),
      })
    }

    const updated = await prisma.sector.update({
      where: { id },
      data: updateData,
      include: {
        units: {
          include: { unit: { select: { id: true, nome: true, codigo: true } } },
        },
      },
    })

    await createAuditLog(request, 'editar_setor', 'Sector', id, {
      campos_alterados: Object.keys(parsed.data),
    })

    return reply.send({
      ...updated,
      units: updated.units.map((su) => su.unit),
    })
  })

  // DELETE /setores/:id - Excluir setor
  app.delete('/:id', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { id } = setorIdParamSchema.parse(request.params)

    const existing = await prisma.sector.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ error: 'Setor não encontrado', code: 'SECTOR_NOT_FOUND' })
    }

    // Bloquear exclusão se vinculado a checklists
    const temChecklist = await prisma.checklistTemplate.findFirst({
      where: { sectorId: id },
    })
    if (temChecklist) {
      return reply.status(400).send({
        error: 'Setor está vinculado a checklists e não pode ser excluído. Desative-o ou remova os vínculos primeiro.',
        code: 'SECTOR_IN_USE',
      })
    }

    await prisma.sector.delete({ where: { id } })

    await createAuditLog(request, 'excluir_setor', 'Sector', id, {
      nome: existing.nome,
    })

    return reply.send({ success: true })
  })
}
