import Fastify from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply): Promise<void>
  }
}
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import { prisma } from '@pai/database'

// Importar rotas
import { authRoutes } from './modules/auth/auth.routes'
import { userRoutes } from './modules/users/user.routes'
import { unitRoutes } from './modules/units/unit.routes'
import { purchaseRoutes } from './modules/purchases/purchase.routes'
import { stockRoutes } from './modules/stock/stock.routes'
import { productRoutes } from './modules/stock/product.routes'
import { productionRoutes } from './modules/production/production.routes'
import { recipeRoutes } from './modules/production/recipe.routes'
import { labelRoutes } from './modules/labels/label.routes'
import { utensilRoutes } from './modules/utensils/utensil.routes'
import { utensilCountRoutes } from './modules/utensils/utensil-count.routes'
import { checklistRoutes } from './modules/checklist/checklist.routes'
import { occurrenceRoutes } from './modules/occurrences/occurrence.routes'
import { notificationRoutes } from './modules/notifications/notification.routes'
import { reportRoutes } from './modules/reports/report.routes'
import { dashboardRoutes } from './modules/dashboard/dashboard.routes'
import { integrationRoutes } from './modules/integrations/integration.routes'
import { auditLogRoutes } from './modules/audit/audit.routes'
import { categoryRoutes } from './modules/categories/category.routes'
import { permissionRoutes } from './modules/permissions/permission.routes'
import { telaRoutes } from './modules/telas/tela.routes'
import { cargoRoutes } from './modules/rh/cargos/cargo.routes'
import { colaboradorRoutes } from './modules/rh/colaboradores/colaborador.routes'
import { admissaoRoutes } from './modules/rh/admissao/admissao.routes'
import { desligamentoRoutes } from './modules/rh/desligamento/desligamento.routes'
import { feriasRoutes } from './modules/rh/ferias/ferias.routes'
import { documentosRoutes } from './modules/rh/documentos/documentos.routes'
import { holeriteRoutes } from './modules/rh/holerites/holerites.routes'
import { beneficiosRoutes } from './modules/rh/beneficios/beneficios.routes'
import { asoRoutes } from './modules/rh/aso/aso.routes'
import { pontoRoutes } from './modules/rh/ponto/ponto.routes'
import { desempenhoRoutes } from './modules/rh/desempenho/desempenho.routes'
import { comunicadosRoutes } from './modules/rh/comunicados/comunicados.routes'
import { organogramaRoutes } from './modules/rh/organograma/organograma.routes'
import { portalRoutes } from './modules/portal/portal.routes'
import { rhRelatoriosRoutes } from './modules/rh/relatorios/rh-relatorios.routes'
import { setorRoutes } from './modules/setores/setor.routes'
import { totemRoutes } from './modules/totem/totem.routes'
import { descartesRoutes } from './modules/descartes/descarte.routes'
import { transferenciaRoutes } from './modules/transferencias/transferencia.routes'
import { configRoutes } from './modules/config/config.routes'
import { encomendasRoutes } from './modules/encomendas/encomenda.routes'
import { impressoraRoutes } from './modules/impressoras/impressora.routes'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  })

  // Plugins
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL
      : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  await app.register(cookie)
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-key-min-32-characters-long!!',
    sign: { expiresIn: '15m' },
  })
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }) // 10MB
  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
  })

  // Decorar com prisma
  app.decorate('prisma', prisma)

  // Decorar com tipagem JWT
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({ error: 'Token invalido ou expirado', code: 'UNAUTHORIZED' })
    }
  })

  // Hook para fechar conexao do banco
  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })

  // Formato padrao de erro
  app.setErrorHandler(async (error: any, request, reply) => {
    request.log.error(error)

    if (error.validation) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: error.validation,
      })
    }

    // Tratar ZodError (validacao manual com zod)
    if (error.name === 'ZodError' && 'issues' in error) {
      const issues = (error as any).issues
      const message = issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ')
      return reply.status(400).send({
        error: message || 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: issues,
      })
    }

    const statusCode = error.statusCode || 500
    return reply.status(statusCode).send({
      error: error.message || 'Erro interno do servidor',
      code: error.code || 'INTERNAL_ERROR',
    })
  })

  // Registrar rotas
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(userRoutes, { prefix: '/users' })
  await app.register(unitRoutes, { prefix: '/units' })
  await app.register(purchaseRoutes, { prefix: '/purchase-cycles' })
  await app.register(stockRoutes, { prefix: '/stock' })
  await app.register(productRoutes, { prefix: '/products' })
  await app.register(productionRoutes, { prefix: '/production-orders' })
  await app.register(recipeRoutes, { prefix: '/recipes' })
  await app.register(labelRoutes, { prefix: '/labels' })
  await app.register(utensilRoutes, { prefix: '/utensils' })
  await app.register(utensilCountRoutes, { prefix: '/utensil-counts' })
  await app.register(checklistRoutes, { prefix: '/checklist' })
  await app.register(occurrenceRoutes, { prefix: '/occurrences' })
  await app.register(notificationRoutes, { prefix: '/notifications' })
  await app.register(reportRoutes, { prefix: '/reports' })
  await app.register(dashboardRoutes, { prefix: '/dashboard' })
  await app.register(integrationRoutes, { prefix: '/integrations' })
  await app.register(auditLogRoutes, { prefix: '/audit-logs' })
  await app.register(categoryRoutes, { prefix: '/categories' })
  await app.register(permissionRoutes, { prefix: '/permissions' })
  await app.register(telaRoutes, { prefix: '/telas' })
  await app.register(cargoRoutes, { prefix: '/rh/cargos' })
  await app.register(colaboradorRoutes, { prefix: '/rh/colaboradores' })
  await app.register(admissaoRoutes, { prefix: '/rh/admissao' })
  await app.register(desligamentoRoutes, { prefix: '/rh/desligamento' })
  await app.register(feriasRoutes, { prefix: '/rh/ferias' })
  await app.register(documentosRoutes, { prefix: '/rh/documentos' })
  await app.register(holeriteRoutes, { prefix: '/rh/holerites' })
  await app.register(beneficiosRoutes, { prefix: '/rh/beneficios' })
  await app.register(asoRoutes, { prefix: '/rh/aso' })
  await app.register(pontoRoutes, { prefix: '/rh/ponto' })
  await app.register(desempenhoRoutes, { prefix: '/rh/desempenho' })
  await app.register(comunicadosRoutes, { prefix: '/rh/comunicados' })
  await app.register(organogramaRoutes, { prefix: '/rh/organograma' })
  await app.register(portalRoutes, { prefix: '/portal' })
  await app.register(rhRelatoriosRoutes, { prefix: '/rh/relatorios' })
  await app.register(setorRoutes, { prefix: '/setores' })
  await app.register(totemRoutes, { prefix: '/totem' })
  await app.register(descartesRoutes, { prefix: '/descarte-counts' })
  await app.register(transferenciaRoutes, { prefix: '/transferencia-counts' })

  await app.register(configRoutes, { prefix: '/config' })
  await app.register(encomendasRoutes, { prefix: '/encomendas' })
  await app.register(impressoraRoutes, { prefix: '/impressoras' })

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return app
}
