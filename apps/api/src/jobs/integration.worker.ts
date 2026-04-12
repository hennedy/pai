import { Worker, Job } from 'bullmq'
import { getRedis } from '../lib/redis'
import { prisma } from '@pai/database'

// Worker para processar jobs de integracoes
export function createIntegrationWorker() {
  const worker = new Worker(
    'integrations',
    async (job: Job) => {
      switch (job.name) {
        case 'process-webhook':
          await processWebhook(job.data)
          break
        case 'reprocess-failed':
          await reprocessFailed(job.data)
          break
        default:
          console.log(`Job de integracao desconhecido: ${job.name}`)
      }
    },
    { connection: getRedis() }
  )

  worker.on('completed', (job) => {
    console.log(`Job de integracao ${job.name} concluido`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Job de integracao ${job?.name} falhou:`, err.message)
  })

  return worker
}

// Processar dados recebidos via webhook
async function processWebhook(data: { integrationId: string; payload: any; logId: string }) {
  const { integrationId, payload, logId } = data

  try {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
      include: { mappings: true },
    })

    if (!integration || integration.status !== 'ativo') {
      throw new Error('Integracao inativa ou nao encontrada')
    }

    // Processar payload de acordo com os mapeamentos
    // Logica de processamento especifica por tipo de integracao
    console.log(`Processando webhook para integracao ${integration.nome}:`, payload)

    // Atualizar log como sucesso
    await prisma.integrationLog.update({
      where: { id: logId },
      data: { status: 'sucesso' },
    })
  } catch (error: any) {
    // Atualizar log como falha
    await prisma.integrationLog.update({
      where: { id: logId },
      data: { status: 'falha', erro: error.message },
    })
    throw error
  }
}

// Reprocessar log com falha
async function reprocessFailed(data: { logId: string }) {
  const log = await prisma.integrationLog.findUnique({
    where: { id: data.logId },
  })

  if (!log || log.status !== 'falha') {
    throw new Error('Log nao encontrado ou nao esta com falha')
  }

  // Reprocessar com o mesmo payload
  await processWebhook({
    integrationId: log.integrationId,
    payload: log.payload,
    logId: log.id,
  })
}
