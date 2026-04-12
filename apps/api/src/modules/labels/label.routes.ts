import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages, generateLoteCode } from '@pai/utils'
import { authenticate, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  createLabelSchema,
  listLabelsQuerySchema,
  idParamSchema,
  createLabelTemplateSchema,
  updateLabelTemplateSchema,
} from './label.schemas'

/**
 * Modulo de etiquetas da API.
 * Registra rotas para geracao, listagem e reimpressao de etiquetas,
 * alem de templates de etiquetas.
 */
export async function labelRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticacao e validacao de unidade
  app.addHook('onRequest', authenticate)
  app.addHook('onRequest', requireUnit())

  // ============================================================
  // POST / — Gerar nova etiqueta
  // ============================================================
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar corpo da requisicao
    const parsed = createLabelSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { unitId, recipeId, productId, descricao, dataProducao, quantidade } = parsed.data
    const user = request.user as any

    // Calcular data de validade a partir dos dias configurados no produto ou receita
    const producaoDate = new Date(dataProducao)
    let dataValidade: Date | null = null

    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { validadeDias: true },
      })
      if (product?.validadeDias) {
        dataValidade = new Date(producaoDate)
        // dia da producao conta como dia 1, entao soma (validadeDias - 1)
        dataValidade.setDate(dataValidade.getDate() + product.validadeDias - 1)
      }
    } else if (recipeId) {
      // Tentar buscar validade via template de receita
      const template = await prisma.labelTemplate.findFirst({
        where: { recipeId },
      })
      if (template?.diasValidade) {
        dataValidade = new Date(producaoDate)
        dataValidade.setDate(dataValidade.getDate() + template.diasValidade - 1)
      }
    }

    // Gerar codigo de lote automaticamente: YYYYMMDD-NNN
    const inicioDia = new Date(producaoDate)
    inicioDia.setHours(0, 0, 0, 0)
    const fimDia = new Date(producaoDate)
    fimDia.setHours(23, 59, 59, 999)

    const countToday = await prisma.label.count({
      where: {
        unitId,
        createdAt: { gte: inicioDia, lte: fimDia },
      },
    })

    const lote = generateLoteCode(producaoDate, countToday + 1)

    // Criar etiqueta no banco
    const label = await prisma.label.create({
      data: {
        unitId,
        recipeId: recipeId || null,
        productId: productId || null,
        descricao,
        lote,
        dataProducao: producaoDate,
        dataValidade,
        responsavelId: user.userId,
        quantidade,
      },
      include: {
        unit: { select: { id: true, codigo: true } },
        recipe: { select: { id: true, nome: true } },
        product: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    })

    // Registrar no log de auditoria
    await createAuditLog(request, 'criar_etiqueta', 'Label', label.id, {
      lote,
      unitId,
      descricao,
    })

    return reply.status(201).send(label)
  })

  // ============================================================
  // GET / — Listar historico de etiquetas com filtros e paginacao
  // ============================================================
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar query params
    const parsed = listLabelsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, unitId, dataInicio, dataFim } = parsed.data
    const { skip, take } = calcPagination(page, limit)
    const unitFilter = getUnitFilter(request)

    // Montar filtros dinamicos
    const where: any = {
      ...unitFilter,
      ...(unitId ? { unitId } : {}),
      ...(dataInicio || dataFim
        ? {
            createdAt: {
              ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
              ...(dataFim ? { lte: new Date(dataFim) } : {}),
            },
          }
        : {}),
    }

    // Buscar etiquetas e total em paralelo
    const [labels, total] = await Promise.all([
      prisma.label.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          unit: { select: { id: true, nome: true, codigo: true, endereco: true } },
          recipe: { select: { id: true, nome: true } },
          product: { select: { id: true, nome: true, validadeDias: true } },
          responsavel: { select: { id: true, nome: true } },
        },
      }),
      prisma.label.count({ where }),
    ])

    return reply.status(200).send({
      data: labels,
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // GET /:id — Detalhe da etiqueta para reimpressao
  // ============================================================
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { id } = parsed.data

    const label = await prisma.label.findUnique({
      where: { id },
      include: {
        unit: { select: { id: true, codigo: true } },
        recipe: { select: { id: true, nome: true } },
        product: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true } },
      },
    })

    if (!label) {
      return reply.status(404).send({
        error: 'Etiqueta nao encontrada',
        code: 'LABEL_NOT_FOUND',
      })
    }

    return reply.status(200).send(label)
  })

  // ============================================================
  // POST /templates — Criar template de etiqueta
  // ============================================================
  app.post('/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createLabelTemplateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { productId, recipeId, diasValidade } = parsed.data

    // Criar template no banco
    const template = await prisma.labelTemplate.create({
      data: {
        productId: productId || null,
        recipeId: recipeId || null,
        diasValidade,
      },
      include: {
        product: { select: { id: true, nome: true } },
        recipe: { select: { id: true, nome: true } },
      },
    })

    // Registrar no log de auditoria
    await createAuditLog(request, 'criar_template_etiqueta', 'LabelTemplate', template.id, {
      diasValidade,
      productId,
      recipeId,
    })

    return reply.status(201).send(template)
  })

  // ============================================================
  // PUT /templates/:id — Editar template de etiqueta
  // ============================================================
  app.put('/templates/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const bodyParsed = updateLabelTemplateSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: bodyParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data
    const data = bodyParsed.data

    // Verificar se template existe
    const existing = await prisma.labelTemplate.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({
        error: 'Template nao encontrado',
        code: 'TEMPLATE_NOT_FOUND',
      })
    }

    // Atualizar template
    const template = await prisma.labelTemplate.update({
      where: { id },
      data,
      include: {
        product: { select: { id: true, nome: true } },
        recipe: { select: { id: true, nome: true } },
      },
    })

    // Registrar no log de auditoria
    await createAuditLog(request, 'editar_template_etiqueta', 'LabelTemplate', template.id, data)

    return reply.status(200).send(template)
  })
}
