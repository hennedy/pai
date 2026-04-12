import { Worker, Job } from 'bullmq'
import { getRedis } from '../lib/redis'
import { prisma } from '@pai/database'

// Worker para processar jobs de notificacoes
export function createNotificationWorker() {
  const worker = new Worker(
    'notifications',
    async (job: Job) => {
      switch (job.name) {
        case 'check-stock-alerts':
          await checkStockAlerts()
          break
        case 'check-checklist-pending':
          await checkChecklistPending()
          break
        case 'check-purchase-cycle-closing':
          await checkPurchaseCycleClosing()
          break
        default:
          console.log(`Job desconhecido: ${job.name}`)
      }
    },
    { connection: getRedis() }
  )

  worker.on('completed', (job) => {
    console.log(`Job ${job.name} concluido`)
  })

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.name} falhou:`, err.message)
  })

  return worker
}

// Verificar produtos abaixo do estoque minimo
async function checkStockAlerts() {
  const alertas = await prisma.$queryRaw<Array<{ productId: string; unitId: string; quantidade: number; estoqueMinimo: number; nome: string }>>`
    SELECT sb."productId", sb."unitId", sb.quantidade, p."estoqueMinimo", p.nome
    FROM "StockBalance" sb
    JOIN "Product" p ON p.id = sb."productId"
    WHERE sb.quantidade <= p."estoqueMinimo"
    AND p."estoqueMinimo" > 0
  `

  for (const alerta of alertas) {
    // Buscar gerentes da unidade
    const gerentes = await prisma.userUnit.findMany({
      where: {
        unitId: alerta.unitId,
        role: { nome: { in: ['gerente_geral', 'gerente_unidade'] } },
      },
      select: { userId: true },
    })

    for (const gerente of gerentes) {
      // Verificar se ja existe notificacao recente (ultimas 24h)
      const existente = await prisma.notification.findFirst({
        where: {
          userId: gerente.userId,
          tipo: 'estoque_minimo',
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          mensagem: { contains: alerta.nome },
        },
      })

      if (!existente) {
        await prisma.notification.create({
          data: {
            userId: gerente.userId,
            unitId: alerta.unitId,
            tipo: 'estoque_minimo',
            titulo: 'Estoque abaixo do minimo',
            mensagem: `${alerta.nome}: ${alerta.quantidade} (minimo: ${alerta.estoqueMinimo})`,
            link: '/estoque',
          },
        })
      }
    }
  }

  console.log(`Verificados ${alertas.length} alertas de estoque`)
}

// Verificar checklists pendentes/atrasados
async function checkChecklistPending() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // Buscar templates obrigatorios
  const templates = await prisma.checklistTemplate.findMany({
    where: { obrigatorio: true, status: 'ativo' },
    include: { unit: true },
  })

  // Buscar unidades ativas
  const unidades = await prisma.unit.findMany({ where: { status: 'ativo' } })

  for (const template of templates) {
    const unidadesAlvo = template.unitId ? [{ id: template.unitId }] : unidades

    for (const unidade of unidadesAlvo) {
      // Verificar se existe execucao concluida hoje
      const execucao = await prisma.checklistExecution.findFirst({
        where: {
          templateId: template.id,
          unitId: unidade.id,
          data: hoje,
          status: 'concluido',
        },
      })

      if (!execucao) {
        // Marcar execucoes pendentes como atrasadas
        await prisma.checklistExecution.updateMany({
          where: {
            templateId: template.id,
            unitId: unidade.id,
            data: hoje,
            status: 'pendente',
          },
          data: { status: 'atrasado' },
        })

        // Notificar gerentes
        const gerentes = await prisma.userUnit.findMany({
          where: {
            unitId: unidade.id,
            role: { nome: { in: ['gerente_geral', 'gerente_unidade', 'supervisor'] } },
          },
          select: { userId: true },
        })

        for (const gerente of gerentes) {
          await prisma.notification.create({
            data: {
              userId: gerente.userId,
              unitId: unidade.id,
              tipo: 'checklist_atrasado',
              titulo: 'Checklist atrasado',
              mensagem: `"${template.nome}" nao foi concluido hoje`,
              link: '/checklist',
            },
          })
        }
      }
    }
  }
}

// Verificar ciclos de compras que fecham em 24h
async function checkPurchaseCycleClosing() {
  const em24h = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const ciclos = await prisma.purchaseCycle.findMany({
    where: {
      status: { in: ['aberto', 'reaberto'] },
      dataFechamento: { lte: em24h, gte: new Date() },
    },
  })

  for (const ciclo of ciclos) {
    // Buscar todos os usuarios com acesso
    const usuarios = ciclo.unitId
      ? await prisma.userUnit.findMany({ where: { unitId: ciclo.unitId }, select: { userId: true } })
      : await prisma.user.findMany({ where: { status: 'ativo' }, select: { id: true } }).then(users => users.map(u => ({ userId: u.id })))

    for (const usuario of usuarios) {
      await prisma.notification.create({
        data: {
          userId: usuario.userId,
          unitId: ciclo.unitId,
          tipo: 'ciclo_compras',
          titulo: 'Ciclo de compras fechando em breve',
          mensagem: `"${ciclo.titulo}" fecha em menos de 24 horas`,
          link: '/compras',
        },
      })
    }
  }
}
