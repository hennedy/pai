import { prisma } from '@pai/database'
import type { FastifyRequest } from 'fastify'

export async function createAuditLog(
  request: FastifyRequest,
  acao: string,
  entidade: string,
  entityId?: string,
  payload?: Record<string, unknown>
) {
  try {
    const userId = (request.user as any)?.userId || null
    const ip = request.ip

    await prisma.auditLog.create({
      data: {
        userId,
        acao,
        entidade,
        entityId,
        payload: payload ? (payload as any) : undefined,
        ip,
      },
    })
  } catch {
    // Audit log nunca deve quebrar o fluxo principal
  }
}
