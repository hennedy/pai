import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { prisma } from '@pai/database'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireRole, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  changePasswordSchema,
  userIdParamSchema,
} from './user.schemas'

// Campos de retorno do usuario (nunca retornar senha)
const userSelectFields = {
  id: true,
  nome: true,
  email: true,
  username: true,
  cpf: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  colaborador: { select: { primeiroNome: true } },
  userUnits: {
    select: {
      id: true,
      unitId: true,
      roleId: true,
      unit: { select: { id: true, nome: true, codigo: true } },
      role: { select: { id: true, nome: true } },
    },
  },
} as const

export async function userRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticacao
  app.addHook('onRequest', authenticate)

  // =====================================================
  // GET /roles - Listar roles disponiveis
  // =====================================================
  app.get('/roles', async (_request, reply) => {
    const roles = await prisma.role.findMany({
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    })
    return reply.send(roles)
  })

  // =====================================================
  // GET /me - Dados do usuario logado
  // =====================================================
  app.get('/me', async (request, reply) => {
    const { userId } = request.user as any

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelectFields,
    })

    if (!user) {
      return reply.status(404).send({ error: 'Usuario nao encontrado', code: 'NOT_FOUND' })
    }

    return reply.send({
      ...user,
      primeiroNome: user.colaborador?.primeiroNome ?? null,
      roles: user.userUnits.map((uu) => ({
        unitId: uu.unitId,
        unitCode: uu.unit.codigo,
        roleId: uu.roleId,
        role: uu.role.nome,
      })),
    })
  })

  // =====================================================
  // GET / - Listar usuarios com filtros e paginacao
  // =====================================================
  app.get('/', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'supervisor', 'administrativo', 'producao'), requireUnit()],
  }, async (request, reply) => {
    const query = listUsersQuerySchema.parse(request.query)
    const { skip, take, page, limit } = calcPagination(query.page, query.limit)
    const unitFilter = getUnitFilter(request)

    // Montar filtro dinamico
    const where: any = {}

    // Filtro de status
    if (query.status) {
      where.status = query.status
    }

    // Filtro por CPF exato
    if (query.cpf) {
      where.cpf = query.cpf.replace(/\D/g, '')
    }

    // Filtro de busca por nome, email ou username
    if (query.search) {
      where.OR = [
        { nome: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { username: { contains: query.search, mode: 'insensitive' } },
      ]
    }

    // Filtro por unidade e/ou role via userUnits
    const userUnitsFilter: any = {}

    if (unitFilter.unitId) {
      userUnitsFilter.unitId = unitFilter.unitId
    }

    if (query.role) {
      userUnitsFilter.role = { nome: query.role }
    }

    if (Object.keys(userUnitsFilter).length > 0) {
      where.userUnits = { some: userUnitsFilter }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelectFields,
        skip,
        take,
        orderBy: { nome: 'asc' },
      }),
      prisma.user.count({ where }),
    ])

    // Transformar userUnits em roles para o frontend
    const usersWithRoles = users.map((user) => ({
      ...user,
      roles: user.userUnits.map((uu) => ({
        unitId: uu.unitId,
        unitCode: uu.unit.codigo,
        roleId: uu.roleId,
        role: uu.role.nome,
      })),
    }))

    return reply.send({
      data: usersWithRoles,
      total,
      page,
      limit,
      totalPages: calcTotalPages(total, limit),
    })
  })

  // =====================================================
  // POST / - Criar novo usuario
  // =====================================================
  app.post('/', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade')],
  }, async (request, reply) => {
    const body = createUserSchema.parse(request.body)

    // Verificar se email ja existe
    const existingEmail = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    })

    if (existingEmail) {
      return reply.status(409).send({
        error: 'Ja existe um usuario com este email',
        code: 'EMAIL_ALREADY_EXISTS',
      })
    }

    // Verificar se username ja existe (se informado)
    if (body.username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: body.username },
        select: { id: true },
      })

      if (existingUsername) {
        return reply.status(409).send({
          error: 'Ja existe um usuario com este nome de usuario',
          code: 'USERNAME_ALREADY_EXISTS',
        })
      }
    }

    // Verificar se CPF ja existe (se informado)
    if (body.cpf) {
      const existingCpf = await prisma.user.findUnique({
        where: { cpf: body.cpf },
        select: { id: true },
      })

      if (existingCpf) {
        return reply.status(409).send({
          error: 'Ja existe um usuario com este CPF',
          code: 'CPF_ALREADY_EXISTS',
        })
      }
    }

    // Hash da senha com 12 rounds
    const senhaHash = await bcrypt.hash(body.senha, 12)

    // Criar usuario com vinculos de unidade/role
    const user = await prisma.user.create({
      data: {
        nome: body.nome,
        email: body.email,
        username: body.username ?? null,
        cpf: body.cpf ?? null,
        senha: senhaHash,
        userUnits: {
          create: body.unitRoles.map((ur) => ({
            unitId: ur.unitId,
            roleId: ur.roleId,
          })),
        },
      },
      select: userSelectFields,
    })

    // Registrar log de auditoria
    await createAuditLog(request, 'criar_usuario', 'User', user.id, {
      nome: body.nome,
      email: body.email,
      unitRoles: body.unitRoles,
    })

    return reply.status(201).send(user)
  })

  // =====================================================
  // PUT /:id - Editar usuario existente
  // =====================================================
  app.put('/:id', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade')],
  }, async (request, reply) => {
    const { id } = userIdParamSchema.parse(request.params)
    const body = updateUserSchema.parse(request.body)

    // Verificar se usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, username: true, cpf: true },
    })

    if (!existingUser) {
      return reply.status(404).send({
        error: 'Usuario nao encontrado',
        code: 'USER_NOT_FOUND',
      })
    }

    // Se alterou email, verificar duplicidade
    if (body.email && body.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: body.email },
        select: { id: true },
      })

      if (emailExists) {
        return reply.status(409).send({
          error: 'Ja existe um usuario com este email',
          code: 'EMAIL_ALREADY_EXISTS',
        })
      }
    }

    // Se alterou username, verificar duplicidade
    if (body.username !== undefined && body.username !== existingUser.username) {
      if (body.username) {
        const usernameExists = await prisma.user.findUnique({
          where: { username: body.username },
          select: { id: true },
        })

        if (usernameExists) {
          return reply.status(409).send({
            error: 'Ja existe um usuario com este nome de usuario',
            code: 'USERNAME_ALREADY_EXISTS',
          })
        }
      }
    }

    // Verificar se CPF ja existe em outro usuario (se informado)
    if (body.cpf !== undefined && body.cpf !== existingUser.cpf) {
      if (body.cpf) {
        const cpfExists = await prisma.user.findUnique({
          where: { cpf: body.cpf },
          select: { id: true },
        })

        if (cpfExists) {
          return reply.status(409).send({
            error: 'Ja existe um usuario com este CPF',
            code: 'CPF_ALREADY_EXISTS',
          })
        }
      }
    }

    // Montar dados de atualizacao
    const updateData: any = {}
    if (body.nome) updateData.nome = body.nome
    if (body.email) updateData.email = body.email
    if (body.username !== undefined) updateData.username = body.username ?? null
    if (body.cpf !== undefined) updateData.cpf = body.cpf ?? null

    // Atualizar vinculos de unidade/role (substituicao total)
    if (body.unitRoles) {
      // Remover vinculos antigos e criar novos em transacao
      await prisma.$transaction([
        prisma.userUnit.deleteMany({ where: { userId: id } }),
        prisma.user.update({
          where: { id },
          data: {
            ...updateData,
            userUnits: {
              create: body.unitRoles.map((ur) => ({
                unitId: ur.unitId,
                roleId: ur.roleId,
              })),
            },
          },
        }),
      ])
    } else {
      await prisma.user.update({
        where: { id },
        data: updateData,
      })
    }

    // Buscar usuario atualizado
    const updatedUser = await prisma.user.findUnique({
      where: { id },
      select: userSelectFields,
    })

    // Registrar log de auditoria
    await createAuditLog(request, 'editar_usuario', 'User', id, {
      campos_alterados: Object.keys(body).filter((k) => (body as any)[k] !== undefined),
    })

    return reply.send(updatedUser)
  })

  // =====================================================
  // PATCH /:id/status - Ativar/desativar usuario
  // =====================================================
  app.patch('/:id/status', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade')],
  }, async (request, reply) => {
    const { id } = userIdParamSchema.parse(request.params)
    const body = updateUserStatusSchema.parse(request.body)

    // Verificar se usuario existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!existingUser) {
      return reply.status(404).send({
        error: 'Usuario nao encontrado',
        code: 'USER_NOT_FOUND',
      })
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status: body.status },
      select: userSelectFields,
    })

    // Registrar log de auditoria
    await createAuditLog(request, 'alterar_status_usuario', 'User', id, {
      statusAnterior: existingUser.status,
      statusNovo: body.status,
    })

    return reply.send(updatedUser)
  })

  // =====================================================
  // PATCH /:id/password - Alterar senha do usuario
  // =====================================================
  app.patch('/:id/password', {
    preHandler: [requireRole('gerente_geral', 'gerente_unidade', 'supervisor', 'producao', 'administrativo')],
  }, async (request, reply) => {
    const { id } = userIdParamSchema.parse(request.params)
    const body = changePasswordSchema.parse(request.body)
    const currentUser = request.user as any

    // Apenas o proprio usuario ou gerente_geral pode alterar a senha
    const isGerenteGeral = currentUser.roles.some((r: any) => r.role === 'gerente_geral')
    if (currentUser.userId !== id && !isGerenteGeral) {
      return reply.status(403).send({
        error: 'Sem permissao para alterar a senha deste usuario',
        code: 'FORBIDDEN',
      })
    }

    // Buscar usuario com senha para validacao
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, senha: true },
    })

    if (!existingUser) {
      return reply.status(404).send({
        error: 'Usuario nao encontrado',
        code: 'USER_NOT_FOUND',
      })
    }

    // Validar senha atual
    const senhaValida = await bcrypt.compare(body.senhaAtual, existingUser.senha)
    if (!senhaValida) {
      return reply.status(400).send({
        error: 'Senha atual incorreta',
        code: 'INVALID_CURRENT_PASSWORD',
      })
    }

    // Hash da nova senha com 12 rounds
    const novaSenhaHash = await bcrypt.hash(body.novaSenha, 12)

    await prisma.user.update({
      where: { id },
      data: { senha: novaSenhaHash },
    })

    // Registrar log de auditoria
    await createAuditLog(request, 'alterar_senha', 'User', id)

    return reply.send({ message: 'Senha alterada com sucesso' })
  })
}
