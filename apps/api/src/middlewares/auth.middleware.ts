import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '@pai/database'

// Middleware de autenticacao JWT — painel (usuarios)
export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const user = request.user as any
    if (user?.type === 'totem') {
      return reply.status(403).send({ error: 'Token de totem nao permitido aqui', code: 'TOTEM_TOKEN_FORBIDDEN' })
    }
  } catch (err) {
    return reply.status(401).send({ error: 'Token invalido ou expirado', code: 'UNAUTHORIZED' })
  }
}

// Middleware de autenticacao JWT — totem (colaboradores via PIN)
export async function authenticateTotem(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const user = request.user as any
    if (user?.type !== 'totem') {
      return reply.status(403).send({ error: 'Token de usuario nao permitido no totem', code: 'PANEL_TOKEN_FORBIDDEN' })
    }
  } catch (err) {
    return reply.status(401).send({ error: 'Token invalido ou expirado', code: 'UNAUTHORIZED' })
  }
}

// Middleware de autorizacao por role
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any
    if (!user) {
      return reply.status(401).send({ error: 'Nao autenticado', code: 'UNAUTHORIZED' })
    }

    const hasRole = user.roles.some((r: any) => allowedRoles.includes(r.role))
    if (!hasRole) {
      return reply.status(403).send({ error: 'Sem permissao para esta acao', code: 'FORBIDDEN' })
    }
  }
}

// Middleware para injetar unitId e garantir isolamento de dados
export function requireUnit() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any
    if (!user) {
      return reply.status(401).send({ error: 'Nao autenticado', code: 'UNAUTHORIZED' })
    }

    // Gerente geral pode acessar qualquer unidade
    const isGerenteGeral = user.roles.some((r: any) => r.role === 'gerente_geral')

    // Pega unitId do query ou body
    const unitId = (request.query as any)?.unitId ||
      (request.body as any)?.unitId ||
      (request.params as any)?.unitId

    if (!isGerenteGeral && unitId) {
      const hasAccess = user.roles.some((r: any) => r.unitId === unitId)
      if (!hasAccess) {
        return reply.status(403).send({
          error: 'Sem acesso a esta unidade',
          code: 'UNIT_ACCESS_DENIED',
        })
      }
    }

    // Injetar unidades permitidas no request
    ;(request as any).allowedUnitIds = isGerenteGeral
      ? null // null significa todas
      : user.roles.map((r: any) => r.unitId)
    ;(request as any).isGerenteGeral = isGerenteGeral
  }
}

// Middleware de autorizacao por permissao granular (modulo + acao)
export function requirePermission(modulo: string, acao: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any
    if (!user) {
      return reply.status(401).send({ error: 'Nao autenticado', code: 'UNAUTHORIZED' })
    }

    // Gerente geral sempre tem acesso total
    const isGerenteGeral = user.roles.some((r: any) => r.role === 'gerente_geral')
    if (isGerenteGeral) return

    // Buscar roleIds do usuario
    const userUnits = await prisma.userUnit.findMany({
      where: { userId: user.userId },
      select: { roleId: true },
    })

    const roleIds = [...new Set(userUnits.map((uu: any) => uu.roleId))]

    // Verificar se algum role do usuario tem a permissao
    const permission = await prisma.rolePermission.findFirst({
      where: {
        roleId: { in: roleIds },
        modulo,
        acao,
      },
    })

    if (!permission) {
      return reply.status(403).send({
        error: `Sem permissao: ${modulo}.${acao}`,
        code: 'PERMISSION_DENIED',
      })
    }
  }
}

// Helper para filtrar por unidades permitidas
export function getUnitFilter(request: FastifyRequest): { unitId?: string | { in: string[] } } {
  const allowedUnitIds = (request as any).allowedUnitIds
  const queryUnitId = (request.query as any)?.unitId

  if (queryUnitId) {
    return { unitId: queryUnitId }
  }

  if (allowedUnitIds === null) {
    return {} // gerente_geral - sem filtro
  }

  return { unitId: { in: allowedUnitIds } }
}
