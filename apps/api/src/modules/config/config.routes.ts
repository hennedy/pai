import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '@pai/database'
import { authenticate } from '../../middlewares/auth.middleware'

const CHAVES_PERMITIDAS = ['ia_provider', 'ia_analise_checklist_ativa'] as const
type ChavePermitida = typeof CHAVES_PERMITIDAS[number]

export async function configRoutes(app: FastifyInstance) {
  // GET /config — Retorna todas as configs do sistema
  app.get('/', { onRequest: [authenticate] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const configs = await prisma.systemConfig.findMany()
    const map: Record<string, string> = {}
    for (const c of configs) map[c.chave] = c.valor
    return reply.send(map)
  })

  // PUT /config — Salva uma ou mais configs
  app.put('/', { onRequest: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = z.record(z.string(), z.string()).safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', code: 'VALIDATION_ERROR' })
    }

    const invalidas = Object.keys(parsed.data).filter(k => !CHAVES_PERMITIDAS.includes(k as ChavePermitida))
    if (invalidas.length > 0) {
      return reply.status(400).send({ error: `Chaves não permitidas: ${invalidas.join(', ')}`, code: 'INVALID_KEYS' })
    }

    await Promise.all(
      Object.entries(parsed.data).map(([chave, valor]) =>
        prisma.systemConfig.upsert({
          where: { chave },
          create: { chave, valor },
          update: { valor },
        })
      )
    )

    return reply.send({ ok: true })
  })
}
