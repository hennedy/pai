import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  createUtensilSchema,
  updateUtensilSchema,
  updateUtensilStatusSchema,
  createMovementSchema,
  listUtensilsQuerySchema,
  listMovementsQuerySchema,
  idParamSchema,
} from './utensil.schemas'

/**
 * Modulo de utensilios da API.
 * Registra rotas para CRUD de utensilios e movimentacoes.
 */
export async function utensilRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticacao e validacao de unidade
  app.addHook('onRequest', authenticate)
  app.addHook('onRequest', requireUnit())

  // ============================================================
  // GET / — Listar utensilios com filtros e paginacao
  // ============================================================
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listUtensilsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, categoria, status, unitId } = parsed.data
    const { skip, take } = calcPagination(page, limit)

    // Montar filtros dinamicos
    const where: any = {
      ...(categoria ? { categoria } : {}),
      ...(status ? { status } : {}),
    }

    // Se unitId informado, filtrar utensilios que possuem movimentacao na unidade
    if (unitId) {
      where.movements = { some: { unitId } }
    }

    // Buscar utensilios e total em paralelo
    const [utensils, total] = await Promise.all([
      prisma.utensil.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          movements: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              unit: { select: { id: true, codigo: true } },
            },
          },
        },
      }),
      prisma.utensil.count({ where }),
    ])

    return reply.status(200).send({
      data: utensils,
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // POST / — Criar novo utensilio
  // ============================================================
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createUtensilSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { nome, descricao, categoria, patrimonio } = parsed.data

    // Verificar se patrimonio ja existe (campo unico)
    const existing = await prisma.utensil.findUnique({ where: { patrimonio } })
    if (existing) {
      return reply.status(409).send({
        error: 'Ja existe um utensilio com este patrimonio',
        code: 'PATRIMONIO_DUPLICADO',
      })
    }

    // Criar utensilio no banco
    const utensil = await prisma.utensil.create({
      data: {
        nome,
        descricao: descricao || null,
        categoria: categoria || null,
        patrimonio,
      },
    })

    // Registrar no log de auditoria
    await createAuditLog(request, 'criar_utensilio', 'Utensil', utensil.id, {
      nome,
      patrimonio,
    })

    return reply.status(201).send(utensil)
  })

  // ============================================================
  // PUT /:id — Editar utensilio
  // ============================================================
  app.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const bodyParsed = updateUtensilSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: bodyParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data
    const data = bodyParsed.data

    // Verificar se utensilio existe
    const existing = await prisma.utensil.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({
        error: 'Utensilio nao encontrado',
        code: 'UTENSIL_NOT_FOUND',
      })
    }

    // Se patrimonio esta sendo alterado, verificar unicidade
    if (data.patrimonio && data.patrimonio !== existing.patrimonio) {
      const duplicate = await prisma.utensil.findUnique({ where: { patrimonio: data.patrimonio } })
      if (duplicate) {
        return reply.status(409).send({
          error: 'Ja existe um utensilio com este patrimonio',
          code: 'PATRIMONIO_DUPLICADO',
        })
      }
    }

    // Atualizar utensilio
    const utensil = await prisma.utensil.update({
      where: { id },
      data,
    })

    // Registrar no log de auditoria
    await createAuditLog(request, 'editar_utensilio', 'Utensil', utensil.id, data)

    return reply.status(200).send(utensil)
  })

  // ============================================================
  // PATCH /:id/status — Alterar status do utensilio
  // ============================================================
  app.patch('/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const bodyParsed = updateUtensilStatusSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: bodyParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data
    const { status } = bodyParsed.data

    // Verificar se utensilio existe
    const existing = await prisma.utensil.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({
        error: 'Utensilio nao encontrado',
        code: 'UTENSIL_NOT_FOUND',
      })
    }

    // Atualizar status
    const utensil = await prisma.utensil.update({
      where: { id },
      data: { status },
    })

    // Registrar no log de auditoria
    await createAuditLog(request, 'alterar_status_utensilio', 'Utensil', utensil.id, {
      statusAnterior: existing.status,
      statusNovo: status,
    })

    return reply.status(200).send(utensil)
  })

  // ============================================================
  // POST /:id/movements — Registrar movimentacao de utensilio
  // ============================================================
  app.post('/:id/movements', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const bodyParsed = createMovementSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: bodyParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data
    const { unitId, tipo, observacao } = bodyParsed.data
    const user = request.user as any

    // Verificar se utensilio existe
    const utensil = await prisma.utensil.findUnique({ where: { id } })
    if (!utensil) {
      return reply.status(404).send({
        error: 'Utensilio nao encontrado',
        code: 'UTENSIL_NOT_FOUND',
      })
    }

    // Determinar novo status baseado no tipo de movimentacao
    const statusMap: Record<string, string> = {
      entrada: 'disponivel',
      saida: 'em_uso',
      transferencia: 'em_uso',
    }
    const novoStatus = statusMap[tipo] || utensil.status

    // Criar movimentacao e atualizar status do utensilio em transacao
    const movement = await prisma.$transaction(async (tx) => {
      // Registrar movimentacao
      const mov = await tx.utensilMovement.create({
        data: {
          utensilId: id,
          unitId,
          tipo: tipo as any,
          responsavelId: user.userId,
          observacao: observacao || null,
        },
        include: {
          unit: { select: { id: true, codigo: true } },
          responsavel: { select: { id: true, nome: true } },
        },
      })

      // Atualizar status do utensilio automaticamente
      await tx.utensil.update({
        where: { id },
        data: { status: novoStatus as any },
      })

      return mov
    })

    // Registrar no log de auditoria
    await createAuditLog(request, 'movimentar_utensilio', 'UtensilMovement', movement.id, {
      utensilId: id,
      tipo,
      unitId,
      statusAnterior: utensil.status,
      statusNovo: novoStatus,
    })

    return reply.status(201).send(movement)
  })

  // ============================================================
  // GET /:id/movements — Historico de movimentacoes do utensilio
  // ============================================================
  app.get('/:id/movements', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const queryParsed = listMovementsQuerySchema.safeParse(request.query)
    if (!queryParsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: queryParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data
    const { page, limit } = queryParsed.data
    const { skip, take } = calcPagination(page, limit)

    // Verificar se utensilio existe
    const utensil = await prisma.utensil.findUnique({ where: { id } })
    if (!utensil) {
      return reply.status(404).send({
        error: 'Utensilio nao encontrado',
        code: 'UTENSIL_NOT_FOUND',
      })
    }

    const where = { utensilId: id }

    // Buscar movimentacoes e total em paralelo
    const [movements, total] = await Promise.all([
      prisma.utensilMovement.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          unit: { select: { id: true, codigo: true } },
          responsavel: { select: { id: true, nome: true } },
        },
      }),
      prisma.utensilMovement.count({ where }),
    ])

    return reply.status(200).send({
      data: movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })
}
