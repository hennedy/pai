import type { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'

export async function printJobsRoutes(app: FastifyInstance) {
  // =====================================================
  // GET /print-jobs/next?token=<agentToken>
  // Agente local polling — retorna o próximo job na fila
  // =====================================================
  app.get('/next', async (request, reply) => {
    const token = (request.query as any).token as string | undefined

    if (!token) {
      return reply.status(400).send({ error: 'token obrigatorio' })
    }

    const impressora = await (prisma as any).impressora.findUnique({
      where:  { agentToken: token },
      select: { id: true, ip: true, porta: true, ativo: true },
    })

    if (!impressora || !impressora.ativo) {
      return reply.status(404).send({ error: 'Impressora nao encontrada ou inativa' })
    }

    // Atomicamente pega o job mais antigo e marca como processing
    const job = await (prisma as any).printJob.findFirst({
      where:   { impressoraId: impressora.id, status: 'queued' },
      orderBy: { createdAt: 'asc' },
    })

    if (!job) {
      return reply.send(null)
    }

    await (prisma as any).printJob.update({
      where: { id: job.id },
      data:  { status: 'processing' },
    })

    return reply.send({
      id:         job.id,
      buffer:     job.buffer,
      impressora: { ip: impressora.ip, porta: impressora.porta },
    })
  })

  // =====================================================
  // PATCH /print-jobs/:id/done
  // Agente reporta sucesso
  // =====================================================
  app.patch('/:id/done', async (request, reply) => {
    const { id } = request.params as { id: string }
    const token  = (request.query as any).token as string | undefined

    if (!token) return reply.status(400).send({ error: 'token obrigatorio' })

    const job = await (prisma as any).printJob.findUnique({
      where:   { id },
      include: { impressora: { select: { agentToken: true } } },
    })

    if (!job || job.impressora.agentToken !== token) {
      return reply.status(404).send({ error: 'Job nao encontrado' })
    }

    await (prisma as any).printJob.update({
      where: { id },
      data:  { status: 'done' },
    })

    return reply.send({ ok: true })
  })

  // =====================================================
  // PATCH /print-jobs/:id/error
  // Agente reporta falha
  // =====================================================
  app.patch('/:id/error', async (request, reply) => {
    const { id }    = request.params as { id: string }
    const token     = (request.query as any).token as string | undefined
    const { error } = (request.body as any) ?? {}

    if (!token) return reply.status(400).send({ error: 'token obrigatorio' })

    const job = await (prisma as any).printJob.findUnique({
      where:   { id },
      include: { impressora: { select: { agentToken: true } } },
    })

    if (!job || job.impressora.agentToken !== token) {
      return reply.status(404).send({ error: 'Job nao encontrado' })
    }

    await (prisma as any).printJob.update({
      where: { id },
      data:  { status: 'error', error: String(error ?? 'Erro desconhecido') },
    })

    return reply.send({ ok: true })
  })

  // =====================================================
  // DELETE /print-jobs/cleanup (limpeza de jobs antigos)
  // =====================================================
  app.delete('/cleanup', async (_request, reply) => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h atrás
    const { count } = await (prisma as any).printJob.deleteMany({
      where: {
        status:    { in: ['done', 'error'] },
        updatedAt: { lt: cutoff },
      },
    })
    return reply.send({ deleted: count })
  })
}
