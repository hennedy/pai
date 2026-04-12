import type { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import { SYSTEM_MODULES, saveRolePermissionsSchema } from './permission.schemas'
import { z } from 'zod'

export async function permissionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // =====================================================
  // GET /modules - Listar todos os modulos e acoes do sistema
  // =====================================================
  app.get('/modules', async (_request, reply) => {
    const modules = Object.entries(SYSTEM_MODULES).map(([key, config]) => ({
      key,
      label: config.label,
      actions: config.actions,
    }))

    return reply.send(modules)
  })

  // =====================================================
  // GET /roles - Listar roles com suas permissoes
  // =====================================================
  app.get('/roles', {
    preHandler: [requireRole('gerente_geral')],
  }, async (_request, reply) => {
    const roles = await prisma.role.findMany({
      include: {
        rolePermissions: {
          select: { modulo: true, acao: true },
        },
      },
      orderBy: { nome: 'asc' },
    })

    return reply.send(roles)
  })

  // =====================================================
  // POST /roles - Criar novo perfil
  // =====================================================
  app.post('/roles', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const body = z.object({
      nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(50).trim(),
    }).parse(request.body)

    // Normalizar nome para snake_case (minusculo, sem acentos, underscore)
    const nomeNormalizado = body.nome
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')

    // Verificar se ja existe
    const existing = await prisma.role.findUnique({
      where: { nome: nomeNormalizado },
    })

    if (existing) {
      return reply.status(409).send({
        error: 'Ja existe um perfil com este nome',
        code: 'ROLE_ALREADY_EXISTS',
      })
    }

    const role = await prisma.role.create({
      data: { nome: nomeNormalizado },
      include: {
        rolePermissions: {
          select: { modulo: true, acao: true },
        },
      },
    })

    await createAuditLog(request, 'criar_perfil', 'Role', role.id, {
      nome: nomeNormalizado,
    })

    return reply.status(201).send(role)
  })

  // =====================================================
  // DELETE /roles/:roleId - Excluir perfil
  // =====================================================
  app.delete('/roles/:roleId', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { roleId } = z.object({ roleId: z.string().uuid() }).parse(request.params)

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, nome: true, _count: { select: { userUnits: true } } },
    })

    if (!role) {
      return reply.status(404).send({ error: 'Perfil nao encontrado', code: 'NOT_FOUND' })
    }

    // Nao permitir excluir gerente_geral
    if (role.nome === 'gerente_geral') {
      return reply.status(400).send({
        error: 'O perfil Gerente Geral nao pode ser excluido',
        code: 'CANNOT_DELETE_GERENTE_GERAL',
      })
    }

    // Verificar se ha usuarios vinculados
    if (role._count.userUnits > 0) {
      return reply.status(400).send({
        error: `Este perfil possui ${role._count.userUnits} usuario(s) vinculado(s). Remova os vinculos antes de excluir.`,
        code: 'ROLE_HAS_USERS',
      })
    }

    // Excluir permissoes e role em transacao
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.role.delete({ where: { id: roleId } }),
    ])

    await createAuditLog(request, 'excluir_perfil', 'Role', roleId, {
      nome: role.nome,
    })

    return reply.send({ message: 'Perfil excluido com sucesso' })
  })

  // =====================================================
  // GET /roles/:roleId - Permissoes de um role especifico
  // =====================================================
  app.get('/roles/:roleId', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { roleId } = z.object({ roleId: z.string().uuid() }).parse(request.params)

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          select: { modulo: true, acao: true },
        },
      },
    })

    if (!role) {
      return reply.status(404).send({ error: 'Perfil nao encontrado', code: 'NOT_FOUND' })
    }

    return reply.send(role)
  })

  // =====================================================
  // PUT /roles/:roleId - Salvar permissoes de um role
  // =====================================================
  app.put('/roles/:roleId', {
    preHandler: [requireRole('gerente_geral')],
  }, async (request, reply) => {
    const { roleId } = z.object({ roleId: z.string().uuid() }).parse(request.params)
    const body = saveRolePermissionsSchema.parse(request.body)

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, nome: true },
    })

    if (!role) {
      return reply.status(404).send({ error: 'Perfil nao encontrado', code: 'NOT_FOUND' })
    }

    // Gerente geral nao pode ter permissoes editadas (tem acesso total)
    if (role.nome === 'gerente_geral') {
      return reply.status(400).send({
        error: 'Gerente Geral possui acesso total e nao pode ser editado',
        code: 'CANNOT_EDIT_GERENTE_GERAL',
      })
    }

    // Substituir todas as permissoes do role em transacao
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...body.permissions.map((p) =>
        prisma.rolePermission.create({
          data: {
            roleId,
            modulo: p.modulo,
            acao: p.acao,
          },
        })
      ),
    ])

    // Buscar role atualizado
    const updatedRole = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          select: { modulo: true, acao: true },
        },
      },
    })

    await createAuditLog(request, 'editar_permissoes_perfil', 'Role', roleId, {
      role: role.nome,
      permissoes: body.permissions.length,
    })

    return reply.send(updatedRole)
  })

  // =====================================================
  // GET /my-permissions - Permissoes do usuario logado
  // =====================================================
  app.get('/my-permissions', async (request, reply) => {
    const { userId } = request.user as any
    const user = request.user as any

    // Gerente geral tem acesso total
    const isGerenteGeral = user.roles.some((r: any) => r.role === 'gerente_geral')
    if (isGerenteGeral) {
      // Retornar todas as permissoes possiveis
      const allPermissions: { modulo: string; acao: string }[] = []
      for (const [modulo, config] of Object.entries(SYSTEM_MODULES)) {
        for (const acao of config.actions) {
          allPermissions.push({ modulo, acao })
        }
      }
      return reply.send({ permissions: allPermissions, isFullAccess: true })
    }

    // Buscar os roleIds do usuario
    const userUnits = await prisma.userUnit.findMany({
      where: { userId },
      select: { roleId: true },
    })

    const roleIds = [...new Set(userUnits.map((uu) => uu.roleId))]

    // Buscar permissoes de todos os roles do usuario (uniao)
    const permissions = await prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      select: { modulo: true, acao: true },
      distinct: ['modulo', 'acao'],
    })

    return reply.send({ permissions, isFullAccess: false })
  })
}
