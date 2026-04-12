import type { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import { z } from 'zod'
import {
  listProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
} from './product.schemas'

const productInclude = {
  categoria: { select: { id: true, nome: true } },
  subcategoria: { select: { id: true, nome: true } },
}

export async function productRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  app.addHook('onRequest', requireUnit())

  // ============================================================
  // GET / — Listar produtos com filtros e paginacao
  // ============================================================
  app.get('/', async (request, reply) => {
    const query = listProductsQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)

    const where: any = {}

    if (query.categoriaId) where.categoriaId = query.categoriaId
    if (query.subcategoriaId) where.subcategoriaId = query.subcategoriaId
    if (query.status) where.status = query.status
    if (query.isEtiqueta !== undefined) where.isEtiqueta = query.isEtiqueta
    if (query.isUtensilio !== undefined) where.isUtensilio = query.isUtensilio
    if (query.controlaEstoque !== undefined) where.controlaEstoque = query.controlaEstoque
    if (query.enviaProducao !== undefined) where.enviaProducao = query.enviaProducao
    if (query.isInsumo !== undefined) where.isInsumo = query.isInsumo
    if (query.isBalanca !== undefined) where.isBalanca = query.isBalanca
    if (query.participaCotacao !== undefined) where.participaCotacao = query.participaCotacao

    if (query.search) {
      where.OR = [
        { nome: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
        { codigoBarras: { contains: query.search, mode: 'insensitive' } },
        { codigoSistema: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { nome: 'asc' },
        include: productInclude,
      }),
      prisma.product.count({ where }),
    ])

    return reply.send({
      data: products,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
    })
  })

  // ============================================================
  // GET /:id — Buscar produto por ID
  // ============================================================
  app.get('/:id', async (request, reply) => {
    const { id } = productIdParamSchema.parse(request.params)

    const product = await prisma.product.findUnique({
      where: { id },
      include: productInclude,
    })

    if (!product) {
      return reply.status(404).send({ error: 'Produto nao encontrado', code: 'PRODUCT_NOT_FOUND' })
    }

    return reply.send(product)
  })

  // ============================================================
  // POST / — Criar novo produto
  // ============================================================
  app.post('/', async (request, reply) => {
    const data = createProductSchema.parse(request.body)

    // Verificar SKU unico se fornecido
    if (data.sku) {
      const skuExists = await prisma.product.findUnique({ where: { sku: data.sku } })
      if (skuExists) {
        return reply.status(409).send({ error: 'Ja existe um produto com este SKU', code: 'SKU_ALREADY_EXISTS' })
      }
    }

    const product = await prisma.product.create({
      data: {
        nome: data.nome,
        sku: data.sku ?? null,
        categoriaId: data.categoriaId ?? null,
        subcategoriaId: data.subcategoriaId ?? null,
        unidadeMedida: data.unidadeMedida,
        codigoSistema: data.codigoSistema ?? null,
        codigoBarras: data.codigoBarras ?? null,
        isBalanca: data.isBalanca,
        codigoBalanca: data.isBalanca ? (data.codigoBalanca ?? null) : null,
        isEtiqueta: data.isEtiqueta,
        validadeDias: data.isEtiqueta ? (data.validadeDias ?? null) : null,
        isUtensilio: data.isUtensilio,
        controlaEstoque: data.controlaEstoque,
        enviaProducao: data.enviaProducao,
        isInsumo: data.isInsumo,
        participaCotacao: data.participaCotacao,
        codigoCotacao: data.participaCotacao ? (data.codigoCotacao ?? null) : null,
        estoqueMinimo: data.estoqueMinimo,
        custoMedio: data.custoMedio,
        status: data.status,
      },
      include: productInclude,
    })

    await createAuditLog(request, 'criar_produto', 'Product', product.id, { nome: data.nome })

    return reply.status(201).send(product)
  })

  // ============================================================
  // PUT /:id — Editar produto existente
  // ============================================================
  app.put('/:id', async (request, reply) => {
    const { id } = productIdParamSchema.parse(request.params)
    const data = updateProductSchema.parse(request.body)

    const existing = await prisma.product.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ error: 'Produto nao encontrado', code: 'PRODUCT_NOT_FOUND' })
    }

    // Se esta alterando SKU, verificar unicidade
    if (data.sku && data.sku !== existing.sku) {
      const skuExists = await prisma.product.findUnique({ where: { sku: data.sku } })
      if (skuExists) {
        return reply.status(409).send({ error: 'Ja existe um produto com este SKU', code: 'SKU_ALREADY_EXISTS' })
      }
    }

    const updateData: any = {}
    if (data.nome !== undefined) updateData.nome = data.nome
    if (data.sku !== undefined) updateData.sku = data.sku
    if (data.categoriaId !== undefined) updateData.categoriaId = data.categoriaId
    if (data.subcategoriaId !== undefined) updateData.subcategoriaId = data.subcategoriaId
    if (data.unidadeMedida !== undefined) updateData.unidadeMedida = data.unidadeMedida
    if (data.codigoSistema !== undefined) updateData.codigoSistema = data.codigoSistema
    if (data.codigoCotacao !== undefined) updateData.codigoCotacao = data.codigoCotacao
    if (data.codigoBarras !== undefined) updateData.codigoBarras = data.codigoBarras
    if (data.participaCotacao !== undefined) updateData.participaCotacao = data.participaCotacao
    if (data.isBalanca !== undefined) updateData.isBalanca = data.isBalanca
    if (data.codigoBalanca !== undefined) updateData.codigoBalanca = data.codigoBalanca
    if (data.isEtiqueta !== undefined) updateData.isEtiqueta = data.isEtiqueta
    if (data.validadeDias !== undefined) updateData.validadeDias = data.validadeDias
    // Se desmarcou etiqueta, limpar dias de validade
    if (data.isEtiqueta === false) {
      updateData.validadeDias = null
    }
    if (data.isUtensilio !== undefined) updateData.isUtensilio = data.isUtensilio
    if (data.controlaEstoque !== undefined) updateData.controlaEstoque = data.controlaEstoque
    if (data.enviaProducao !== undefined) updateData.enviaProducao = data.enviaProducao
    if (data.isInsumo !== undefined) updateData.isInsumo = data.isInsumo
    if (data.estoqueMinimo !== undefined) updateData.estoqueMinimo = data.estoqueMinimo
    if (data.custoMedio !== undefined) updateData.custoMedio = data.custoMedio
    if (data.status !== undefined) updateData.status = data.status

    // Se desmarcou cotacao, limpar codigo
    if (data.participaCotacao === false) {
      updateData.codigoCotacao = null
    }
    // Se desmarcou balanca, limpar codigo
    if (data.isBalanca === false) {
      updateData.codigoBalanca = null
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: productInclude,
    })

    await createAuditLog(request, 'editar_produto', 'Product', id, {
      campos_alterados: Object.keys(updateData),
    })

    return reply.send(product)
  })

  // ============================================================
  // PATCH /:id/status — Ativar/desativar produto
  // ============================================================
  app.patch('/:id/status', async (request, reply) => {
    const { id } = productIdParamSchema.parse(request.params)
    const { status } = z.object({
      status: z.enum(['ativo', 'inativo']),
    }).parse(request.body)

    const existing = await prisma.product.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!existing) {
      return reply.status(404).send({ error: 'Produto nao encontrado', code: 'PRODUCT_NOT_FOUND' })
    }

    const product = await prisma.product.update({
      where: { id },
      data: { status },
      include: productInclude,
    })

    await createAuditLog(request, 'alterar_status_produto', 'Product', id, {
      statusAnterior: existing.status,
      statusNovo: status,
    })

    return reply.send(product)
  })

  // ============================================================
  // DELETE /:id — Remover produto
  // ============================================================
  app.delete('/:id', async (request, reply) => {
    const { id } = productIdParamSchema.parse(request.params)

    const existing = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stockEntries: true,
            purchaseRequests: true,
            recipeIngredients: true,
            labels: true,
          },
        },
      },
    })

    if (!existing) {
      return reply.status(404).send({ error: 'Produto nao encontrado', code: 'PRODUCT_NOT_FOUND' })
    }

    const totalRefs = existing._count.stockEntries + existing._count.purchaseRequests +
      existing._count.recipeIngredients + existing._count.labels
    if (totalRefs > 0) {
      return reply.status(409).send({
        error: 'Produto possui registros vinculados e nao pode ser removido. Desative-o ao inves disso.',
        code: 'PRODUCT_HAS_REFERENCES',
      })
    }

    await prisma.product.delete({ where: { id } })
    await createAuditLog(request, 'remover_produto', 'Product', id, { nome: existing.nome })

    return reply.send({ success: true })
  })
}
