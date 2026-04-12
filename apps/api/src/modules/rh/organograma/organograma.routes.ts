import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { requirePermission } from '../../../middlewares/auth.middleware'

interface ColabNode {
  id: string
  nome: string
  nomeSocial?: string | null
  matricula: string
  fotoUrl?: string | null
  departamento?: string | null
  gestorDiretoId?: string | null
  cargo?: { nome: string; nivel: string } | null
  unit?: { nome: string } | null
  status: string
  subordinados: ColabNode[]
}

function buildTree(
  nodes: Omit<ColabNode, 'subordinados'>[],
  parentId: string | null
): ColabNode[] {
  return nodes
    .filter((n) => n.gestorDiretoId === parentId)
    .map((n) => ({
      ...n,
      subordinados: buildTree(nodes, n.id),
    }))
}

export async function organogramaRoutes(app: FastifyInstance) {
  // Árvore hierárquica completa
  app.get('/', {
    preHandler: [app.authenticate, requirePermission('rh_organograma', 'visualizar')],
  }, async (request) => {
    const { unitId, status = 'ativo' } = z.object({
      unitId: z.string().uuid().optional(),
      status: z.string().optional(),
    }).parse(request.query)

    const where: any = {}
    if (status) where.status = status
    if (unitId) where.unitId = unitId

    const colaboradores = await prisma.colaborador.findMany({
      where,
      select: {
        id: true,
        nome: true,
        nomeSocial: true,
        matricula: true,
        fotoUrl: true,
        departamento: true,
        gestorDiretoId: true,
        status: true,
        cargo: { select: { nome: true, nivel: true } },
        unit: { select: { nome: true } },
      },
      orderBy: { nome: 'asc' },
    })

    // Raízes = sem gestor direto ou cujo gestor não está na lista filtrada
    const ids = new Set(colaboradores.map((c) => c.id))
    const raizes = colaboradores.filter(
      (c) => !c.gestorDiretoId || !ids.has(c.gestorDiretoId)
    )

    const flat = colaboradores as Omit<ColabNode, 'subordinados'>[]
    const tree = raizes.map((r) => ({
      ...r,
      subordinados: buildTree(flat, r.id),
    }))

    return {
      tree,
      total: colaboradores.length,
    }
  })

  // Subtree a partir de um colaborador
  app.get('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_organograma', 'visualizar')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const raiz = await prisma.colaborador.findUnique({
      where: { id },
      select: {
        id: true, nome: true, nomeSocial: true, matricula: true, fotoUrl: true,
        departamento: true, gestorDiretoId: true, status: true,
        cargo: { select: { nome: true, nivel: true } },
        unit: { select: { nome: true } },
      },
    })

    if (!raiz) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    // Busca todos os subordinados recursivamente via uma única query
    const todos = await prisma.colaborador.findMany({
      where: { status: 'ativo' },
      select: {
        id: true, nome: true, nomeSocial: true, matricula: true, fotoUrl: true,
        departamento: true, gestorDiretoId: true, status: true,
        cargo: { select: { nome: true, nivel: true } },
        unit: { select: { nome: true } },
      },
    })

    const flat = todos as Omit<ColabNode, 'subordinados'>[]

    function getSubtree(nodeId: string): ColabNode {
      const node = flat.find((n) => n.id === nodeId)!
      return {
        ...node,
        subordinados: flat
          .filter((n) => n.gestorDiretoId === nodeId)
          .map((n) => getSubtree(n.id)),
      }
    }

    return getSubtree(id)
  })

  // Estatísticas do organograma
  app.get('/stats/resumo', {
    preHandler: [app.authenticate, requirePermission('rh_organograma', 'visualizar')],
  }, async () => {
    const [porUnidade, porCargo, semGestor, semSubordinados] = await Promise.all([
      prisma.colaborador.groupBy({
        by: ['unitId'],
        where: { status: 'ativo' },
        _count: { id: true },
      }),
      prisma.colaborador.groupBy({
        by: ['cargoId'],
        where: { status: 'ativo' },
        _count: { id: true },
      }),
      prisma.colaborador.count({ where: { status: 'ativo', gestorDiretoId: null } }),
      prisma.colaborador.count({
        where: {
          status: 'ativo',
          subordinados: { none: {} },
        },
      }),
    ])

    return { porUnidade, porCargo, semGestor, semSubordinados }
  })
}
