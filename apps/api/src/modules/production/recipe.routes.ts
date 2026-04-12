import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireUnit, getUnitFilter, requirePermission } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  createRecipeSchema,
  updateRecipeSchema,
  listRecipesQuerySchema,
  recipeIdParamSchema,
} from './recipe.schemas'

/**
 * Modulo de receitas da API.
 * Registra rotas de CRUD e custo estimado de receitas.
 */
export async function recipeRoutes(app: FastifyInstance) {
  // Aplicar autenticacao em todas as rotas do modulo
  app.addHook('onRequest', authenticate)

  // ============================================================
  // GET / — Listar receitas com filtros e paginacao
  // ============================================================
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar query params
    const parsed = listRecipesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, categoria, status, search } = parsed.data
    const { skip, take } = calcPagination(page, limit)

    // Montar filtros dinamicos
    const where: Record<string, unknown> = {}

    if (categoria) {
      where.categoria = categoria
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.nome = { contains: search, mode: 'insensitive' }
    }

    // Buscar receitas e total em paralelo
    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        include: {
          ingredients: {
            include: {
              product: { select: { id: true, nome: true, unidadeMedida: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.recipe.count({ where }),
    ])

    return reply.status(200).send({
      data: recipes,
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // POST / — Criar receita com ingredientes
  // ============================================================
  app.post('/', { preHandler: [requirePermission('receitas', 'criar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar corpo da requisicao
    const parsed = createRecipeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { nome, categoria, rendimento, unidadeMedida, ingredients } = parsed.data

    // Calcular custo estimado somando (quantidade * custoMedio) de cada ingrediente
    const productIds = ingredients.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, custoMedio: true },
    })

    const productCostMap = new Map(products.map((p) => [p.id, p.custoMedio]))
    const custoEstimado = ingredients.reduce((acc, ing) => {
      const custoMedio = productCostMap.get(ing.productId) || 0
      return acc + ing.quantidade * custoMedio
    }, 0)

    // Criar receita com ingredientes em uma unica operacao
    const recipe = await prisma.recipe.create({
      data: {
        nome,
        categoria,
        rendimento,
        unidadeMedida,
        custoEstimado,
        ingredients: {
          create: ingredients.map((ing) => ({
            productId: ing.productId,
            quantidade: ing.quantidade,
            unidadeMedida: ing.unidadeMedida,
            observacao: ing.observacao,
          })),
        },
      },
      include: {
        ingredients: {
          include: {
            product: { select: { id: true, nome: true, unidadeMedida: true } },
          },
        },
      },
    })

    // Registrar auditoria
    await createAuditLog(request, 'criar_receita', 'Recipe', recipe.id, {
      nome,
      categoria,
      rendimento,
      ingredientesCount: ingredients.length,
    })

    return reply.status(201).send({ data: recipe })
  })

  // ============================================================
  // PUT /:id — Editar receita (incrementa versao se ingredientes mudam)
  // ============================================================
  app.put('/:id', { preHandler: [requirePermission('receitas', 'editar')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar parametro ID
    const paramParsed = recipeIdParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramParsed.error.flatten().fieldErrors,
      })
    }

    // Validar corpo da requisicao
    const bodyParsed = updateRecipeSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: bodyParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramParsed.data
    const { nome, categoria, rendimento, unidadeMedida, status, ingredients } = bodyParsed.data

    // Verificar se a receita existe
    const existingRecipe = await prisma.recipe.findUnique({
      where: { id },
      include: { ingredients: true },
    })

    if (!existingRecipe) {
      return reply.status(404).send({
        error: 'Receita nao encontrada',
        code: 'NOT_FOUND',
      })
    }

    // Verificar se os ingredientes mudaram para incrementar versao
    const ingredientsChanged = !!ingredients

    // Montar dados de atualizacao
    const updateData: Record<string, unknown> = {}
    if (nome !== undefined) updateData.nome = nome
    if (categoria !== undefined) updateData.categoria = categoria
    if (rendimento !== undefined) updateData.rendimento = rendimento
    if (unidadeMedida !== undefined) updateData.unidadeMedida = unidadeMedida
    if (status !== undefined) updateData.status = status

    // Se ingredientes mudaram, incrementar versao e recalcular custo
    if (ingredientsChanged) {
      updateData.versao = existingRecipe.versao + 1

      // Calcular novo custo estimado
      const productIds = ingredients.map((i) => i.productId)
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, custoMedio: true },
      })

      const productCostMap = new Map(products.map((p) => [p.id, p.custoMedio]))
      updateData.custoEstimado = ingredients.reduce((acc, ing) => {
        const custoMedio = productCostMap.get(ing.productId) || 0
        return acc + ing.quantidade * custoMedio
      }, 0)
    }

    // Atualizar receita em transacao (remover ingredientes antigos e criar novos se necessario)
    const recipe = await prisma.$transaction(async (tx) => {
      // Se ingredientes mudaram, substituir todos
      if (ingredientsChanged) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } })
        await tx.recipeIngredient.createMany({
          data: ingredients.map((ing) => ({
            recipeId: id,
            productId: ing.productId,
            quantidade: ing.quantidade,
            unidadeMedida: ing.unidadeMedida,
            observacao: ing.observacao,
          })),
        })
      }

      return tx.recipe.update({
        where: { id },
        data: updateData,
        include: {
          ingredients: {
            include: {
              product: { select: { id: true, nome: true, unidadeMedida: true } },
            },
          },
        },
      })
    })

    // Registrar auditoria
    await createAuditLog(request, 'editar_receita', 'Recipe', id, {
      ...updateData,
      ingredientsChanged,
      versaoAnterior: existingRecipe.versao,
      versaoAtual: recipe.versao,
    })

    return reply.status(200).send({ data: recipe })
  })

  // ============================================================
  // GET /:id/cost — Custo estimado da receita
  // ============================================================
  app.get('/:id/cost', async (request: FastifyRequest, reply: FastifyReply) => {
    // Validar parametro ID
    const paramParsed = recipeIdParamSchema.safeParse(request.params)
    if (!paramParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramParsed.data

    // Buscar receita com ingredientes e custoMedio dos produtos
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: {
          include: {
            product: { select: { id: true, nome: true, custoMedio: true, unidadeMedida: true } },
          },
        },
      },
    })

    if (!recipe) {
      return reply.status(404).send({
        error: 'Receita nao encontrada',
        code: 'NOT_FOUND',
      })
    }

    // Calcular custo de cada ingrediente e total
    const ingredientsCost = recipe.ingredients.map((ing) => ({
      productId: ing.product.id,
      productNome: ing.product.nome,
      quantidade: ing.quantidade,
      unidadeMedida: ing.unidadeMedida,
      custoMedio: ing.product.custoMedio,
      custoTotal: ing.quantidade * ing.product.custoMedio,
    }))

    const custoEstimadoTotal = ingredientsCost.reduce((acc, item) => acc + item.custoTotal, 0)

    return reply.status(200).send({
      data: {
        recipeId: recipe.id,
        nome: recipe.nome,
        versao: recipe.versao,
        rendimento: recipe.rendimento,
        unidadeMedida: recipe.unidadeMedida,
        custoEstimado: custoEstimadoTotal,
        custoPorUnidade: recipe.rendimento > 0 ? custoEstimadoTotal / recipe.rendimento : 0,
        ingredients: ingredientsCost,
      },
    })
  })
}
