import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import { prisma } from '@pai/database'
import { loginInputSchema } from './auth.schemas'
import type { JwtUserPayload } from '../../lib/jwt'

// Numero de rounds do bcrypt para validacao de senha
const BCRYPT_ROUNDS = 12

// Tempo de expiracao dos tokens
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_DAYS = 7

/**
 * Modulo de autenticacao da API.
 * Registra as rotas de login, refresh e logout.
 */
export async function authRoutes(app: FastifyInstance) {
  // ============================================================
  // POST /login — Autenticar usuario com email e senha
  // ============================================================
  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 100,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Validar corpo da requisicao com Zod
      const parsed = loginInputSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Dados invalidos',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        })
      }

      const { identifier, senha: password } = parsed.data

      // Determinar se o identificador e um email ou nome de usuario
      const isEmail = identifier.includes('@')

      // Buscar usuario pelo email ou username, incluindo suas unidades e roles
      const user = await prisma.user.findFirst({
        where: isEmail ? { email: identifier } : { username: identifier },
        include: {
          userUnits: {
            include: {
              unit: { select: { id: true, codigo: true } },
              role: { select: { nome: true } },
            },
          },
        },
      })

      // Verificar se usuario existe e esta ativo
      if (!user || user.status !== 'ativo') {
        return reply.status(401).send({
          error: 'Credenciais invalidas',
          code: 'INVALID_CREDENTIALS',
        })
      }

      // Comparar senha informada com hash armazenado
      const senhaValida = await bcrypt.compare(password, user.senha)
      if (!senhaValida) {
        // Registrar tentativa de login com falha no audit log
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            acao: 'login_falha',
            entidade: 'User',
            entityId: user.id,
            payload: { identifier, motivo: 'senha_incorreta' },
            ip: request.ip,
          },
        })

        return reply.status(401).send({
          error: 'Credenciais invalidas',
          code: 'INVALID_CREDENTIALS',
        })
      }

      // Montar payload do JWT com roles do usuario
      const roles = user.userUnits.map((uu) => ({
        unitId: uu.unit.id,
        unitCode: uu.unit.codigo,
        role: uu.role.nome,
      }))

      const jwtPayload: JwtUserPayload = {
        type: 'panel',
        userId: user.id,
        email: user.email,
        roles,
      }

      // Gerar access token (15 minutos)
      const accessToken = app.jwt.sign(jwtPayload, { expiresIn: ACCESS_TOKEN_EXPIRY })

      // Gerar refresh token (7 dias) e salvar no banco
      const refreshTokenValue = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS)

      await prisma.refreshToken.create({
        data: {
          token: refreshTokenValue,
          userId: user.id,
          expiresAt,
        },
      })

      // Registrar login bem-sucedido no audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          acao: 'login_sucesso',
          entidade: 'User',
          entityId: user.id,
          payload: { identifier },
          ip: request.ip,
        },
      })

      // Enviar refresh token como cookie httpOnly seguro
      reply.setCookie('refresh_token', refreshTokenValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60, // segundos
      })

      // Retornar access token e dados basicos do usuario (nunca a senha)
      return reply.status(200).send({
        accessToken,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          roles,
        },
      })
    },
  )

  // ============================================================
  // POST /refresh — Renovar access token usando refresh token do cookie
  // ============================================================
  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshTokenValue = request.cookies.refresh_token

    // Verificar se o cookie existe
    if (!refreshTokenValue) {
      return reply.status(401).send({
        error: 'Refresh token nao encontrado',
        code: 'MISSING_REFRESH_TOKEN',
      })
    }

    // Buscar refresh token no banco
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshTokenValue },
    })

    // Verificar se o token existe e nao expirou
    if (!storedToken || storedToken.expiresAt < new Date()) {
      // Se expirou, remover do banco para limpeza
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } })
      }

      // Limpar cookie invalido
      reply.clearCookie('refresh_token', { path: '/' })

      return reply.status(401).send({
        error: 'Refresh token invalido ou expirado',
        code: 'INVALID_REFRESH_TOKEN',
      })
    }

    // Buscar usuario atualizado com suas unidades e roles
    const user = await prisma.user.findUnique({
      where: { id: storedToken.userId },
      include: {
        userUnits: {
          include: {
            unit: { select: { id: true, codigo: true } },
            role: { select: { nome: true } },
          },
        },
      },
    })

    // Verificar se usuario ainda existe e esta ativo
    if (!user || user.status !== 'ativo') {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } })
      reply.clearCookie('refresh_token', { path: '/' })

      return reply.status(401).send({
        error: 'Usuario inativo ou nao encontrado',
        code: 'USER_INACTIVE',
      })
    }

    // Rotacao de refresh token: remover antigo e criar novo
    await prisma.refreshToken.delete({ where: { id: storedToken.id } })

    const newRefreshTokenValue = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS)

    await prisma.refreshToken.create({
      data: {
        token: newRefreshTokenValue,
        userId: user.id,
        expiresAt,
      },
    })

    // Montar novo payload do JWT
    const roles = user.userUnits.map((uu) => ({
      unitId: uu.unit.id,
      unitCode: uu.unit.codigo,
      role: uu.role.nome,
    }))

    const jwtPayload: JwtUserPayload = {
      type: 'panel',
      userId: user.id,
      email: user.email,
      roles,
    }

    // Gerar novo access token
    const accessToken = app.jwt.sign(jwtPayload, { expiresIn: ACCESS_TOKEN_EXPIRY })

    // Atualizar cookie com novo refresh token
    reply.setCookie('refresh_token', newRefreshTokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
    })

    return reply.status(200).send({
      accessToken,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        roles,
      },
    })
  })

  // ============================================================
  // POST /logout — Invalidar refresh token e limpar cookie
  // ============================================================
  app.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshTokenValue = request.cookies.refresh_token

    // Se existe um refresh token no cookie, remover do banco
    if (refreshTokenValue) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshTokenValue },
      })
    }

    // Limpar cookie do refresh token
    reply.clearCookie('refresh_token', { path: '/' })

    // Registrar logout no audit log (se o usuario estiver autenticado)
    try {
      await request.jwtVerify()
      const user = request.user as JwtUserPayload

      await prisma.auditLog.create({
        data: {
          userId: user.userId,
          acao: 'logout',
          entidade: 'User',
          entityId: user.userId,
          ip: request.ip,
        },
      })
    } catch {
      // Se o token JWT ja expirou, apenas fazer logout sem registrar audit log com userId
      await prisma.auditLog.create({
        data: {
          acao: 'logout',
          entidade: 'User',
          ip: request.ip,
        },
      })
    }

    return reply.status(200).send({
      message: 'Logout realizado com sucesso',
    })
  })
}
