import { prisma } from '@pai/database'

/**
 * Verifica a cada minuto se existem ciclos de compras abertos/reabertos
 * cuja dataFechamento ja passou (23:59 do dia configurado).
 * Se sim, fecha automaticamente.
 */
async function checkAndCloseCycles() {
  try {
    const now = new Date()

    // Buscar ciclos abertos/reabertos com dataFechamento definida e ja ultrapassada
    const ciclosParaFechar = await prisma.purchaseCycle.findMany({
      where: {
        status: { in: ['aberto', 'reaberto'] },
        dataFechamento: { lte: now },
      },
    })

    for (const ciclo of ciclosParaFechar) {
      await prisma.purchaseCycle.update({
        where: { id: ciclo.id },
        data: {
          status: 'fechado',
        },
      })

      console.log(`[auto-close] Ciclo "${ciclo.titulo}" (${ciclo.id}) fechado automaticamente`)
    }
  } catch (err) {
    console.error('[auto-close] Erro ao verificar ciclos:', err)
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null

export function startAutoCloseCron() {
  // Executar imediatamente na inicializacao
  checkAndCloseCycles()

  // Verificar a cada 1 minuto
  intervalId = setInterval(checkAndCloseCycles, 60 * 1000)
  console.log('[auto-close] Cron de fechamento automatico de ciclos iniciado')
}

export function stopAutoCloseCron() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
