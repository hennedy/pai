import type { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  listCategoriesQuerySchema,
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  createSubcategorySchema,
  updateSubcategorySchema,
  subcategoryIdParamSchema,
} from './category.schemas'

export async function categoryRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // =====================================================
  // GET / - Listar categorias com subcategorias
  // =====================================================
  app.get('/', async (request, reply) => {
    const query = listCategoriesQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)

    const where: any = {}
    if (query.search) {
      where.nome = { contains: query.search, mode: 'insensitive' }
    }

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: { nome: 'asc' },
        include: {
          subcategories: {
            orderBy: { nome: 'asc' },
            select: { id: true, nome: true, createdAt: true },
          },
          _count: { select: { products: true } },
        },
      }),
      prisma.category.count({ where }),
    ])

    return reply.send({
      data: categories,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
    })
  })

  // =====================================================
  // GET /all - Listar todas categorias (sem paginacao, para selects)
  // =====================================================
  app.get('/all', async (_request, reply) => {
    const categories = await prisma.category.findMany({
      orderBy: { nome: 'asc' },
      include: {
        subcategories: {
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true },
        },
      },
    })

    return reply.send({ data: categories })
  })

  // =====================================================
  // GET /:id - Buscar categoria por ID
  // =====================================================
  app.get('/:id', async (request, reply) => {
    const { id } = categoryIdParamSchema.parse(request.params)

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: {
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true, createdAt: true },
        },
        _count: { select: { products: true } },
      },
    })

    if (!category) {
      return reply.status(404).send({ error: 'Categoria nao encontrada', code: 'CATEGORY_NOT_FOUND' })
    }

    return reply.send(category)
  })

  // =====================================================
  // POST / - Criar categoria
  // =====================================================
  app.post('/', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'administrativo')],
  }, async (request, reply) => {
    const body = createCategorySchema.parse(request.body)

    const existing = await prisma.category.findUnique({ where: { nome: body.nome } })
    if (existing) {
      return reply.status(409).send({ error: 'Ja existe uma categoria com este nome', code: 'CATEGORY_EXISTS' })
    }

    const category = await prisma.category.create({
      data: { nome: body.nome },
      include: {
        subcategories: { select: { id: true, nome: true } },
        _count: { select: { products: true } },
      },
    })

    await createAuditLog(request, 'criar_categoria', 'Category', category.id, { nome: body.nome })

    return reply.status(201).send(category)
  })

  // =====================================================
  // PUT /:id - Editar categoria
  // =====================================================
  app.put('/:id', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'administrativo')],
  }, async (request, reply) => {
    const { id } = categoryIdParamSchema.parse(request.params)
    const body = updateCategorySchema.parse(request.body)

    const existing = await prisma.category.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ error: 'Categoria nao encontrada', code: 'CATEGORY_NOT_FOUND' })
    }

    if (body.nome) {
      const nameExists = await prisma.category.findFirst({ where: { nome: body.nome, id: { not: id } } })
      if (nameExists) {
        return reply.status(409).send({ error: 'Ja existe uma categoria com este nome', code: 'CATEGORY_EXISTS' })
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: { ...(body.nome && { nome: body.nome }) },
      include: {
        subcategories: { select: { id: true, nome: true } },
        _count: { select: { products: true } },
      },
    })

    await createAuditLog(request, 'editar_categoria', 'Category', id, { nome: body.nome })

    return reply.send(updated)
  })

  // =====================================================
  // DELETE /:id - Remover categoria
  // =====================================================
  app.delete('/:id', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { id } = categoryIdParamSchema.parse(request.params)

    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Categoria nao encontrada', code: 'CATEGORY_NOT_FOUND' })
    }

    if (existing._count.products > 0) {
      return reply.status(409).send({
        error: `Categoria possui ${existing._count.products} produto(s) vinculado(s). Remova os produtos antes de excluir.`,
        code: 'CATEGORY_HAS_PRODUCTS',
      })
    }

    await prisma.category.delete({ where: { id } })
    await createAuditLog(request, 'remover_categoria', 'Category', id, { nome: existing.nome })

    return reply.send({ success: true })
  })

  // =====================================================
  // SUBCATEGORIES
  // =====================================================

  // POST /:id/subcategories - Criar subcategoria
  app.post('/:id/subcategories', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'administrativo')],
  }, async (request, reply) => {
    const { id } = categoryIdParamSchema.parse(request.params)
    const body = createSubcategorySchema.parse(request.body)

    const category = await prisma.category.findUnique({ where: { id } })
    if (!category) {
      return reply.status(404).send({ error: 'Categoria nao encontrada', code: 'CATEGORY_NOT_FOUND' })
    }

    const existing = await prisma.subcategory.findUnique({
      where: { categoriaId_nome: { categoriaId: id, nome: body.nome } },
    })
    if (existing) {
      return reply.status(409).send({ error: 'Ja existe uma subcategoria com este nome nesta categoria', code: 'SUBCATEGORY_EXISTS' })
    }

    const subcategory = await prisma.subcategory.create({
      data: { nome: body.nome, categoriaId: id },
    })

    await createAuditLog(request, 'criar_subcategoria', 'Subcategory', subcategory.id, {
      categoriaId: id,
      nome: body.nome,
    })

    return reply.status(201).send(subcategory)
  })

  // PUT /:id/subcategories/:subcategoryId - Editar subcategoria
  app.put('/:id/subcategories/:subcategoryId', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'administrativo')],
  }, async (request, reply) => {
    const { id, subcategoryId } = subcategoryIdParamSchema.parse(request.params)
    const body = updateSubcategorySchema.parse(request.body)

    const existing = await prisma.subcategory.findFirst({
      where: { id: subcategoryId, categoriaId: id },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Subcategoria nao encontrada', code: 'SUBCATEGORY_NOT_FOUND' })
    }

    if (body.nome) {
      const nameExists = await prisma.subcategory.findFirst({
        where: { categoriaId: id, nome: body.nome, id: { not: subcategoryId } },
      })
      if (nameExists) {
        return reply.status(409).send({ error: 'Ja existe uma subcategoria com este nome nesta categoria', code: 'SUBCATEGORY_EXISTS' })
      }
    }

    const updated = await prisma.subcategory.update({
      where: { id: subcategoryId },
      data: { ...(body.nome && { nome: body.nome }) },
    })

    await createAuditLog(request, 'editar_subcategoria', 'Subcategory', subcategoryId, {
      categoriaId: id,
      nome: body.nome,
    })

    return reply.send(updated)
  })

  // DELETE /:id/subcategories/:subcategoryId - Remover subcategoria
  app.delete('/:id/subcategories/:subcategoryId', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { id, subcategoryId } = subcategoryIdParamSchema.parse(request.params)

    const existing = await prisma.subcategory.findFirst({
      where: { id: subcategoryId, categoriaId: id },
      include: { _count: { select: { products: true } } },
    })
    if (!existing) {
      return reply.status(404).send({ error: 'Subcategoria nao encontrada', code: 'SUBCATEGORY_NOT_FOUND' })
    }

    if (existing._count.products > 0) {
      return reply.status(409).send({
        error: `Subcategoria possui ${existing._count.products} produto(s) vinculado(s). Remova os produtos antes de excluir.`,
        code: 'SUBCATEGORY_HAS_PRODUCTS',
      })
    }

    await prisma.subcategory.delete({ where: { id: subcategoryId } })
    await createAuditLog(request, 'remover_subcategoria', 'Subcategory', subcategoryId, {
      categoriaId: id,
      nome: existing.nome,
    })

    return reply.send({ success: true })
  })
}
