import jwt from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export async function registerJwt(app: FastifyInstance) {
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-key-min-32-characters-long!!',
    sign: { expiresIn: '15m' },
  })
}

export interface JwtUserPayload {
  type: 'panel'
  userId: string
  email: string
  roles: Array<{
    unitId: string
    unitCode: string
    role: string
  }>
}

export interface JwtTotemPayload {
  type: 'totem'
  colaboradorId: string
  userId: string | null   // null quando colaborador não tem conta vinculada
  unitId: string
  permissoes: string[]    // TotemModulo[] — módulos autorizados nesta unidade
  roles: Array<{
    unitId: string
    unitCode: string
    role: string
  }>
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUserPayload | JwtTotemPayload
    user: JwtUserPayload | JwtTotemPayload
  }
}
