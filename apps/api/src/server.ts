import { initSentry } from './lib/sentry'
import { buildApp } from './app'
import { startAutoCloseCron } from './cron/auto-close-cycles'
import { initChecklistScheduler } from './cron/checklist-scheduler'

// Capturar erros nao tratados para evitar crash por Redis indisponivel
process.on('unhandledRejection', (err: any) => {
  if (err?.code === 'ECONNREFUSED' || err?.message?.includes('Connection is closed')) {
    // Ignorar erros de Redis quando nao disponivel
    return
  }
  console.error('Unhandled rejection:', err)
})

// Inicializar Sentry antes de tudo
initSentry()

const start = async () => {
  const app = await buildApp()
  const port = Number(process.env.PORT) || 3001

  try {
    await app.listen({ port, host: '0.0.0.0' })
    app.log.info(`Servidor rodando na porta ${port}`)

    // Iniciar cron de fechamento automatico de ciclos de compras
    startAutoCloseCron()
    initChecklistScheduler()

    // Iniciar workers BullMQ apenas se Redis estiver configurado
    if (process.env.REDIS_URL) {
      try {
        const { setupRecurringJobs } = await import('./jobs/queues')
        const { createNotificationWorker } = await import('./jobs/notification.worker')
        const { createIntegrationWorker } = await import('./jobs/integration.worker')

        createNotificationWorker()
        createIntegrationWorker()
        await setupRecurringJobs()
        app.log.info('Workers BullMQ iniciados')
      } catch (err) {
        app.log.warn('Redis nao disponivel - workers BullMQ desativados')
      }
    } else {
      app.log.info('REDIS_URL nao configurada - BullMQ desativado')
    }
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
