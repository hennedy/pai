import { Queue, Worker } from 'bullmq'
import { getRedis } from '../lib/redis'

const connection = { connection: getRedis() }

// Filas
export const notificationQueue = new Queue('notifications', connection)
export const reportsQueue = new Queue('reports', connection)
export const integrationsQueue = new Queue('integrations', connection)

// Agendar jobs recorrentes
export async function setupRecurringJobs() {
  // Verificar estoque minimo a cada 1 hora
  await notificationQueue.add(
    'check-stock-alerts',
    {},
    { repeat: { every: 60 * 60 * 1000 }, removeOnComplete: true }
  )

  // Verificar checklists pendentes a cada 1 hora
  await notificationQueue.add(
    'check-checklist-pending',
    {},
    { repeat: { every: 60 * 60 * 1000 }, removeOnComplete: true }
  )

  // Verificar ciclos de compras fechando em 24h a cada 6 horas
  await notificationQueue.add(
    'check-purchase-cycle-closing',
    {},
    { repeat: { every: 6 * 60 * 60 * 1000 }, removeOnComplete: true }
  )

  console.log('Jobs recorrentes configurados')
}
