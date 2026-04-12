import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma, Prisma } from '@pai/database'
import { analisarFotoChecklist } from '../../lib/ai-checklist'
import { calcPagination, calcTotalPages } from '@pai/utils'
import { authenticate, requireUnit, getUnitFilter } from '../../middlewares/auth.middleware'
import { createAuditLog } from '../../lib/audit'
import {
  createChecklistTemplateSchema,
  updateChecklistTemplateSchema,
  createExecutionSchema,
  updateExecutionSchema,
  listTemplatesQuerySchema,
  listExecutionsQuerySchema,
  idParamSchema,
  duplicateTemplateSchema,
  rankingQuerySchema,
} from './checklist.schemas'

/**
 * Envia notificacoes de alerta para itens criticos com resultado negativo.
 */
async function dispararAlertasItensCriticos(executionId: string) {
  const execution = await prisma.checklistExecution.findUnique({
    where: { id: executionId },
    include: {
      template: { select: { nome: true } },
      unit: { select: { id: true, nome: true } },
      atribuidoA: { select: { id: true } },
      responses: {
        include: { item: { select: { isCritico: true, descricao: true, tipo: true } } },
      },
    },
  })

  if (!execution) return

  const itensCriticosNegados: string[] = []

  for (const resp of execution.responses) {
    if (!resp.item.isCritico) continue
    if (resp.naoAplicavel) continue

    // Item critico com resultado negativo: checkbox=false, ou sem resposta
    const resposta = resp.resposta
    let ehNegativo = false

    if (resp.item.tipo === 'checkbox') {
      ehNegativo = resposta === 'false' || resposta === null || resposta === ''
    } else if (resp.conformidade) {
      // Se tem rotulo, considera nao conforme se o rotulo indicar
      ehNegativo = resp.conformidade.toLowerCase().includes('nao') || resp.conformidade.toLowerCase().includes('não')
    } else {
      ehNegativo = resposta === null || resposta === ''
    }

    if (ehNegativo) {
      itensCriticosNegados.push(resp.item.descricao)
    }
  }

  if (itensCriticosNegados.length === 0) return

  const titulo = `Alerta: Itens Criticos no Checklist "${execution.template.nome}"`
  const mensagem = `${itensCriticosNegados.length} item(s) critico(s) com resultado negativo na unidade ${execution.unit.nome}: ${itensCriticosNegados.slice(0, 3).join(', ')}${itensCriticosNegados.length > 3 ? ` e mais ${itensCriticosNegados.length - 3}` : ''}.`

  // Destinatarios: responsavel da execucao e gestor da unidade
  const destinatarios = new Set<string>()
  if (execution.atribuidoA?.id) destinatarios.add(execution.atribuidoA.id)

  // Gestores da unidade (users que tem acesso a unidade)
  const gestores = await prisma.userUnit.findMany({
    where: { unitId: execution.unit.id },
    include: { role: { include: { rolePermissions: { where: { modulo: 'checklist', acao: 'gerenciar' } } } } },
  })
  for (const gu of gestores) {
    if (gu.role.rolePermissions.length > 0) destinatarios.add(gu.userId)
  }

  if (destinatarios.size === 0) return

  await prisma.notification.createMany({
    data: Array.from(destinatarios).map(userId => ({
      userId,
      unitId: execution.unit.id,
      tipo: 'checklist_atrasado' as const,
      titulo,
      mensagem,
      link: `/checklist/execucao/${executionId}`,
    })),
    skipDuplicates: true,
  })
}

/**
 * Modulo de checklists da API.
 * Registra rotas para templates, execucoes, respostas, ranking e alertas.
 */
export async function checklistRoutes(app: FastifyInstance) {
  // Todas as rotas exigem autenticacao e validacao de unidade
  app.addHook('onRequest', authenticate)
  app.addHook('onRequest', requireUnit())

  // ============================================================
  // GET /templates — Listar templates de checklist
  // ============================================================
  app.get('/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listTemplatesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, sectorId, status, search } = parsed.data
    const { skip, take } = calcPagination(page, limit)
    const unitFilter = getUnitFilter(request)

    const where: any = {
      isAdhoc: false,
      OR: [
        { unitId: null },
        unitFilter,
      ],
      ...(status === 'todos' ? {} : status ? { status } : { status: 'ativo' }),
      ...(sectorId ? { sectorId } : {}),
      ...(search ? { nome: { contains: search, mode: 'insensitive' } } : {}),
    }

    const [templates, total] = await Promise.all([
      prisma.checklistTemplate.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          unit: { select: { id: true, codigo: true } },
          sector: { select: { id: true, nome: true } },
          atribuidoA: { select: { id: true, nome: true } },
          responsavelColab: { select: { id: true, nome: true, matricula: true } },
          items: {
            orderBy: { ordem: 'asc' },
            include: { responsavel: { select: { id: true, nome: true, matricula: true } } },
          },
          _count: { select: { executions: true } },
        },
      }),
      prisma.checklistTemplate.count({ where }),
    ])

    return reply.status(200).send({
      data: templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // POST /templates — Criar template de checklist
  // ============================================================
  app.post('/templates', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createChecklistTemplateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { nome, sectorId, unitId, horario, obrigatorio, icone, tempoLimiteMinutos, recorrencia, datasExcecao, items, atribuidoAId, responsavelColabId } = parsed.data

    const template = await prisma.checklistTemplate.create({
      data: {
        nome,
        sectorId: sectorId || null,
        unitId: unitId || null,
        horario: horario as any,
        obrigatorio,
        icone: icone || null,
        tempoLimiteMinutos: tempoLimiteMinutos || null,
        recorrencia: (recorrencia as any) ?? Prisma.DbNull,
        datasExcecao: (datasExcecao as any) ?? Prisma.DbNull,
        atribuidoAId: atribuidoAId || null,
        responsavelColabId: responsavelColabId || null,
        items: {
          create: items.map((item) => ({
            descricao: item.descricao,
            ordem: item.ordem,
            tipo: item.tipo as any,
            obrigatorio: item.obrigatorio,
            exigeFoto: item.exigeFoto,
            exigeObservacao: item.exigeObservacao,
            isCritico: item.isCritico,
            condicaoAlerta: (item.condicaoAlerta as any) ?? Prisma.DbNull,
            peso: item.peso || 1,
            opcoes: (item.opcoes as any) ?? Prisma.DbNull,
            rotulos: (item.rotulos as any) ?? Prisma.DbNull,
            responsavelId: item.responsavelId || null,
          })),
        },
      },
      include: {
        unit: { select: { id: true, codigo: true } },
        items: {
          orderBy: { ordem: 'asc' },
          include: { responsavel: { select: { id: true, nome: true, matricula: true } } },
        },
      },
    })

    await createAuditLog(request, 'criar_template_checklist', 'ChecklistTemplate', template.id, {
      nome,
      horario,
      totalItems: items.length,
    })

    return reply.status(201).send(template)
  })

  // ============================================================
  // PUT /templates/:id — Editar template de checklist
  // ============================================================
  app.put('/templates/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const bodyParsed = updateChecklistTemplateSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: bodyParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data
    const { items, ...data } = bodyParsed.data

    const existing = await prisma.checklistTemplate.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({
        error: 'Template nao encontrado',
        code: 'TEMPLATE_NOT_FOUND',
      })
    }

    const template = await prisma.$transaction(async (tx) => {
      const updated = await tx.checklistTemplate.update({
        where: { id },
        data: {
          ...(data.nome !== undefined && { nome: data.nome }),
          ...(data.sectorId !== undefined && { sectorId: data.sectorId }),
          ...(data.unitId !== undefined && { unitId: data.unitId }),
          ...(data.horario !== undefined && { horario: data.horario as any }),
          ...(data.obrigatorio !== undefined && { obrigatorio: data.obrigatorio }),
          ...(data.icone !== undefined && { icone: data.icone }),
          ...(data.tempoLimiteMinutos !== undefined && { tempoLimiteMinutos: data.tempoLimiteMinutos }),
          ...(data.recorrencia !== undefined && { recorrencia: (data.recorrencia as any) ?? Prisma.DbNull }),
          ...(data.datasExcecao !== undefined && { datasExcecao: (data.datasExcecao as any) ?? Prisma.DbNull }),
          ...(data.atribuidoAId !== undefined && { atribuidoAId: data.atribuidoAId || null }),
          ...(data.responsavelColabId !== undefined && { responsavelColabId: data.responsavelColabId || null }),
        },
      })

      if (items && items.length > 0) {
        await tx.checklistItem.deleteMany({ where: { templateId: id } })
        await tx.checklistItem.createMany({
          data: items.map((item) => ({
            templateId: id,
            descricao: item.descricao,
            ordem: item.ordem,
            tipo: item.tipo as any,
            obrigatorio: item.obrigatorio,
            exigeFoto: item.exigeFoto,
            exigeObservacao: item.exigeObservacao,
            isCritico: item.isCritico,
            condicaoAlerta: (item.condicaoAlerta as any) ?? Prisma.DbNull,
            peso: item.peso || 1,
            opcoes: (item.opcoes as any) ?? Prisma.DbNull,
            rotulos: (item.rotulos as any) ?? Prisma.DbNull,
            responsavelId: item.responsavelId || null,
          })),
        })
      }

      return updated
    })

    const result = await prisma.checklistTemplate.findUnique({
      where: { id },
      include: {
        unit: { select: { id: true, codigo: true } },
        responsavelColab: { select: { id: true, nome: true, matricula: true } },
        items: {
          orderBy: { ordem: 'asc' },
          include: { responsavel: { select: { id: true, nome: true, matricula: true } } },
        },
      },
    })

    await createAuditLog(request, 'editar_template_checklist', 'ChecklistTemplate', id, {
      ...data,
      itemsAtualizados: !!items,
    })

    return reply.status(200).send(result)
  })

  // ============================================================
  // PATCH /templates/:id/status — Ativar ou pausar template
  // ============================================================
  app.patch('/templates/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })
    }

    const bodyParsed = z.object({
      status: z.enum(['ativo', 'inativo']),
    }).safeParse(request.body)

    if (!bodyParsed.success) {
      return reply.status(400).send({ error: 'Status invalido', code: 'VALIDATION_ERROR' })
    }

    const { id } = paramsParsed.data
    const template = await prisma.checklistTemplate.findUnique({ where: { id } })
    if (!template) {
      return reply.status(404).send({ error: 'Template nao encontrado', code: 'TEMPLATE_NOT_FOUND' })
    }

    const updated = await prisma.checklistTemplate.update({
      where: { id },
      data: { status: bodyParsed.data.status as any },
    })

    await createAuditLog(request, 'alterar_status_template_checklist', 'ChecklistTemplate', id, {
      status: bodyParsed.data.status,
    })

    return reply.status(200).send(updated)
  })

  // ============================================================
  // DELETE /templates/:id — Excluir template sem execucoes concluidas
  // ============================================================
  app.delete('/templates/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })
    }

    const { id } = paramsParsed.data
    const template = await prisma.checklistTemplate.findUnique({ where: { id } })
    if (!template) {
      return reply.status(404).send({ error: 'Template nao encontrado', code: 'TEMPLATE_NOT_FOUND' })
    }

    const temConcluida = await prisma.checklistExecution.findFirst({
      where: { templateId: id, status: 'concluido' },
    })
    if (temConcluida) {
      return reply.status(400).send({
        error: 'Este checklist possui execucoes concluidas e nao pode ser excluido. Pause-o para desativa-lo.',
        code: 'TEMPLATE_HAS_EXECUTIONS',
      })
    }

    // Exclui em ordem para respeitar FK: respostas → execucoes → items (cascade) → template
    const executionIds = (await prisma.checklistExecution.findMany({
      where: { templateId: id },
      select: { id: true },
    })).map((e) => e.id)

    await prisma.$transaction(async (tx) => {
      if (executionIds.length > 0) {
        await tx.checklistItemResponse.deleteMany({ where: { executionId: { in: executionIds } } })
        await tx.checklistExecution.deleteMany({ where: { id: { in: executionIds } } })
      }
      await tx.checklistTemplate.delete({ where: { id } })
    })

    await createAuditLog(request, 'excluir_template_checklist', 'ChecklistTemplate', id, {
      nome: template.nome,
    })

    return reply.status(200).send({ success: true })
  })

  // ============================================================
  // POST /templates/:id/duplicate — Duplicar template para outra unidade
  // ============================================================
  app.post('/templates/:id/duplicate', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })
    }

    const bodyParsed = duplicateTemplateSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: bodyParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data
    const { targetUnitId, nome } = bodyParsed.data

    const original = await prisma.checklistTemplate.findUnique({
      where: { id },
      include: { items: { orderBy: { ordem: 'asc' } } },
    })

    if (!original) {
      return reply.status(404).send({ error: 'Template nao encontrado', code: 'TEMPLATE_NOT_FOUND' })
    }

    const copia = await prisma.checklistTemplate.create({
      data: {
        nome: nome || `${original.nome} (Copia)`,
        sectorId: null, // Setor pode nao existir na unidade destino
        unitId: targetUnitId,
        horario: original.horario,
        obrigatorio: original.obrigatorio,
        icone: original.icone,
        tempoLimiteMinutos: original.tempoLimiteMinutos,
        recorrencia: (original.recorrencia as any) ?? Prisma.DbNull,
        datasExcecao: (original.datasExcecao as any) ?? Prisma.DbNull,
        atribuidoAId: null,
        responsavelColabId: null, // Responsavel pode nao existir na unidade destino
        items: {
          create: original.items.map(item => ({
            descricao: item.descricao,
            ordem: item.ordem,
            tipo: item.tipo,
            obrigatorio: item.obrigatorio,
            exigeFoto: item.exigeFoto,
            exigeObservacao: item.exigeObservacao,
            isCritico: item.isCritico,
            condicaoAlerta: (item.condicaoAlerta as any) ?? Prisma.DbNull,
            peso: item.peso,
            opcoes: (item.opcoes as any) ?? Prisma.DbNull,
            rotulos: (item.rotulos as any) ?? Prisma.DbNull,
          })),
        },
      },
      include: {
        unit: { select: { id: true, codigo: true, nome: true } },
        items: { orderBy: { ordem: 'asc' } },
      },
    })

    await createAuditLog(request, 'duplicar_template_checklist', 'ChecklistTemplate', copia.id, {
      originalId: id,
      targetUnitId,
    })

    return reply.status(201).send(copia)
  })

  // ============================================================
  // GET /ranking — Ranking de usuarios por pontualidade, esforco e qualidade
  // ============================================================
  app.get('/ranking', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = rankingQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { unitId, periodo } = parsed.data
    const unitFilter = getUnitFilter(request)

    const dataInicio = new Date()
    dataInicio.setDate(dataInicio.getDate() - periodo)
    dataInicio.setHours(0, 0, 0, 0)

    const execucoesConcluidas = await prisma.checklistExecution.findMany({
      where: {
        ...unitFilter,
        ...(unitId ? { unitId } : {}),
        status: 'concluido',
        concluidoAt: { gte: dataInicio },
        atribuidoAId: { not: null },
      },
      include: {
        atribuidoA: { select: { id: true, nome: true } },
      },
    })

    // Agrupar por usuario
    const porUsuario = new Map<string, {
      userId: string
      nome: string
      totalConcluidos: number
      emPrazo: number
      comPrazo: number
      somaScore: number
      comScore: number
    }>()

    for (const exec of execucoesConcluidas) {
      if (!exec.atribuidoAId || !exec.atribuidoA) continue

      const key = exec.atribuidoAId
      if (!porUsuario.has(key)) {
        porUsuario.set(key, {
          userId: exec.atribuidoAId,
          nome: exec.atribuidoA.nome,
          totalConcluidos: 0,
          emPrazo: 0,
          comPrazo: 0,
          somaScore: 0,
          comScore: 0,
        })
      }

      const entry = porUsuario.get(key)!
      entry.totalConcluidos++

      // Pontualidade: concluido antes do prazo
      if (exec.prazoLimite && exec.concluidoAt) {
        entry.comPrazo++
        if (exec.concluidoAt <= exec.prazoLimite) entry.emPrazo++
      }

      // Qualidade: score medio
      if (exec.score !== null) {
        entry.somaScore += exec.score
        entry.comScore++
      }
    }

    const usuarios = Array.from(porUsuario.values())
    const maxConcluidos = Math.max(...usuarios.map(u => u.totalConcluidos), 1)

    const ranking = usuarios.map(u => {
      const pontualidade = u.comPrazo > 0 ? (u.emPrazo / u.comPrazo) * 100 : null
      const qualidade = u.comScore > 0 ? u.somaScore / u.comScore : null
      const esforco = (u.totalConcluidos / maxConcluidos) * 100

      // Score geral: media ponderada (40% pontualidade, 30% esforco, 30% qualidade)
      const p = pontualidade ?? 50 // Se nao ha dados de prazo, assume medio
      const q = qualidade ?? 50
      const scoreGeral = p * 0.4 + esforco * 0.3 + q * 0.3

      return {
        userId: u.userId,
        nome: u.nome,
        totalConcluidos: u.totalConcluidos,
        pontualidade: pontualidade !== null ? Math.round(pontualidade) : null,
        qualidade: qualidade !== null ? Math.round(qualidade) : null,
        esforco: Math.round(esforco),
        scoreGeral: Math.round(scoreGeral),
      }
    }).sort((a, b) => b.scoreGeral - a.scoreGeral)

    return reply.status(200).send({ data: ranking, periodo })
  })

  // ============================================================
  // POST /executions — Iniciar execucao de checklist
  // ============================================================
  app.post('/executions', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createExecutionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { templateId, unitId, turno, atribuidoAId, responsavelId } = parsed.data
    const user = request.user as any

    const template = await prisma.checklistTemplate.findUnique({
      where: { id: templateId },
      include: { items: true },
    })

    if (!template || template.status !== 'ativo') {
      return reply.status(404).send({
        error: 'Template nao encontrado ou inativo',
        code: 'TEMPLATE_NOT_FOUND',
      })
    }

    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const execution = await prisma.checklistExecution.create({
      data: {
        templateId,
        unitId,
        turno: turno as any,
        data: hoje,
        executadoPorId: user.userId,
        atribuidoAId: atribuidoAId,
        responsavelId: responsavelId || null,
      },
      include: {
        template: {
          select: { id: true, nome: true },
          include: {
            items: {
              orderBy: { ordem: 'asc' },
              include: { responsavel: { select: { id: true, nome: true, matricula: true } } },
            },
          },
        },
        unit: { select: { id: true, codigo: true } },
        executadoPor: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true, matricula: true } },
      },
    })

    await createAuditLog(request, 'iniciar_execucao_checklist', 'ChecklistExecution', execution.id, {
      templateId,
      unitId,
      turno,
    })

    return reply.status(201).send(execution)
  })

  // ============================================================
  // PUT /executions/:id — Salvar respostas dos itens da execucao
  // ============================================================
  app.put('/executions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const bodyParsed = updateExecutionSchema.safeParse(request.body)
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: bodyParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data
    const { responses, latitude, longitude, observacaoGeral } = bodyParsed.data

    const execution = await prisma.checklistExecution.findUnique({ where: { id } })
    if (!execution) {
      return reply.status(404).send({
        error: 'Execucao nao encontrada',
        code: 'EXECUTION_NOT_FOUND',
      })
    }

    if (execution.status === 'concluido') {
      return reply.status(400).send({
        error: 'Execucao ja foi concluida e nao pode ser alterada',
        code: 'EXECUTION_ALREADY_COMPLETED',
      })
    }

    await prisma.$transaction(async (tx) => {
      if (latitude !== undefined || longitude !== undefined || observacaoGeral !== undefined) {
        await tx.checklistExecution.update({
          where: { id },
          data: {
            ...(latitude !== undefined && { latitude }),
            ...(longitude !== undefined && { longitude }),
            ...(observacaoGeral !== undefined && { observacaoGeral }),
          },
        })
      }

      for (const resp of responses) {
        const existing = await tx.checklistItemResponse.findFirst({
          where: { executionId: id, itemId: resp.itemId },
        })

        if (existing) {
          await tx.checklistItemResponse.update({
            where: { id: existing.id },
            data: {
              resposta: resp.resposta || null,
              conformidade: resp.conformidade || null,
              fotoUrl: resp.fotoUrl || null,
              videoUrl: resp.videoUrl || null,
              geolocation: (resp.geolocation as any) ?? Prisma.DbNull,
              naoAplicavel: resp.naoAplicavel || false,
            },
          })
        } else {
          await tx.checklistItemResponse.create({
            data: {
              executionId: id,
              itemId: resp.itemId,
              resposta: resp.resposta || null,
              conformidade: resp.conformidade || null,
              fotoUrl: resp.fotoUrl || null,
              videoUrl: resp.videoUrl || null,
              geolocation: (resp.geolocation as any) ?? Prisma.DbNull,
              naoAplicavel: resp.naoAplicavel || false,
            },
          })
        }
      }
    })

    const result = await prisma.checklistExecution.findUnique({
      where: { id },
      include: {
        template: { select: { id: true, nome: true } },
        unit: { select: { id: true, codigo: true } },
        executadoPor: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true, matricula: true } },
        responses: {
          include: {
            item: {
              include: { responsavel: { select: { id: true, nome: true, matricula: true } } },
            },
          },
          orderBy: { item: { ordem: 'asc' } },
        },
      },
    })

    await createAuditLog(request, 'salvar_respostas_checklist', 'ChecklistExecution', id, {
      totalRespostas: responses.length,
    })

    return reply.status(200).send(result)
  })

  // ============================================================
  // PATCH /executions/:id/complete — Finalizar execucao
  // ============================================================
  app.patch('/executions/:id/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data

    const execution = await prisma.checklistExecution.findUnique({
      where: { id },
      include: {
        template: { include: { items: true } },
        responses: true,
      },
    })

    if (!execution) {
      return reply.status(404).send({
        error: 'Execucao nao encontrada',
        code: 'EXECUTION_NOT_FOUND',
      })
    }

    if (execution.status === 'concluido') {
      return reply.status(400).send({
        error: 'Execucao ja foi concluida',
        code: 'EXECUTION_ALREADY_COMPLETED',
      })
    }

    const itens = execution.template.items
    const mapResponses = new Map(execution.responses.map(r => [r.itemId, r]))

    let pontosGanhos = 0
    let pontosPossiveis = 0
    const errosValidacao: any[] = []

    for (const item of itens) {
      const resp = mapResponses.get(item.id)

      if (resp?.naoAplicavel) continue

      const isRespondido = resp && resp.resposta != null && resp.resposta !== ''

      if (item.obrigatorio && !isRespondido && (!resp || (!resp.fotoUrl && !resp.videoUrl))) {
        errosValidacao.push({ id: item.id, motivo: 'Requer resposta', descricao: item.descricao })
      } else if (item.exigeFoto && !resp?.fotoUrl) {
        errosValidacao.push({ id: item.id, motivo: 'Requer foto de evidencia', descricao: item.descricao })
      } else if (item.exigeObservacao && (!resp?.resposta || resp.resposta.trim() === '')) {
        errosValidacao.push({ id: item.id, motivo: 'Requer texto de observacao explicativa', descricao: item.descricao })
      }

      if (isRespondido) {
        pontosPossiveis += item.peso

        switch (item.tipo) {
          case 'checkbox':
            if (resp!.resposta === 'true') pontosGanhos += item.peso
            break
          case 'estrelas':
            const rating = Number(resp!.resposta) || 0
            if (rating > 0) pontosGanhos += (rating / 5) * item.peso
            break
          default:
            // Verifica conformidade para pontuar: "Nao conforme" reduz score
            if (resp?.conformidade) {
              const ehNaoConforme = resp.conformidade.toLowerCase().includes('nao') || resp.conformidade.toLowerCase().includes('não')
              if (!ehNaoConforme) pontosGanhos += item.peso
              // Parcial = metade dos pontos
              else if (resp.conformidade.toLowerCase().includes('parcial')) pontosGanhos += item.peso * 0.5
            } else {
              pontosGanhos += item.peso
            }
            break
        }
      } else if (item.obrigatorio) {
        pontosPossiveis += item.peso
      }
    }

    if (errosValidacao.length > 0) {
      return reply.status(400).send({
        error: 'Existem itens com falhas de validacao (pendentes ou faltando foto/observacao)',
        code: 'MISSING_REQUIRED_ITEMS',
        details: { itensNaoRespondidos: errosValidacao },
      })
    }

    const calculatedScore = pontosPossiveis > 0 ? (pontosGanhos / pontosPossiveis) * 100 : null

    const result = await prisma.checklistExecution.update({
      where: { id },
      data: {
        status: 'concluido',
        concluidoAt: new Date(),
        score: calculatedScore,
      },
      include: {
        template: { select: { id: true, nome: true } },
        unit: { select: { id: true, codigo: true } },
        executadoPor: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true, matricula: true } },
        responses: {
          include: {
            item: {
              include: { responsavel: { select: { id: true, nome: true, matricula: true } } },
            },
          },
          orderBy: { item: { ordem: 'asc' } },
        },
      },
    })

    // Disparar alertas para itens criticos com resultado negativo (fire-and-forget)
    dispararAlertasItensCriticos(id).catch(err =>
      console.error('[Checklist] Erro ao disparar alertas de itens criticos:', err)
    )

    await createAuditLog(request, 'concluir_execucao_checklist', 'ChecklistExecution', id, {
      templateId: execution.templateId,
      totalRespostas: execution.responses.length,
      score: calculatedScore,
    })

    return reply.status(200).send(result)
  })

  // ============================================================
  // GET /executions/:id — Buscar execucao por ID com itens e respostas
  // ============================================================
  app.get('/executions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data

    const execution = await prisma.checklistExecution.findUnique({
      where: { id },
      include: {
        template: {
          include: {
            items: {
              orderBy: { ordem: 'asc' },
              include: { responsavel: { select: { id: true, nome: true, matricula: true } } },
            },
          },
        },
        unit: { select: { id: true, codigo: true, nome: true, latitude: true, longitude: true, raioValidacaoMetros: true } },
        executadoPor: { select: { id: true, nome: true } },
        atribuidoA: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true, matricula: true } },
        responses: {
          include: {
            item: {
              include: { responsavel: { select: { id: true, nome: true, matricula: true } } },
            },
          },
          orderBy: { item: { ordem: 'asc' } },
        },
      },
    })

    if (!execution) {
      return reply.status(404).send({
        error: 'Execucao nao encontrada',
        code: 'EXECUTION_NOT_FOUND',
      })
    }

    return reply.status(200).send(execution)
  })

  // ============================================================
  // POST /executions/:id/duplicate — Duplicar execucao como nova tarefa avulsa
  // ============================================================
  app.post('/executions/:id/duplicate', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({
        error: 'ID invalido',
        code: 'VALIDATION_ERROR',
        details: paramsParsed.error.flatten().fieldErrors,
      })
    }

    const bodyParsed = z.object({
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato invalido (YYYY-MM-DD)').optional(),
    }).safeParse(request.body)

    const { id } = paramsParsed.data

    const original = await prisma.checklistExecution.findUnique({
      where: { id },
      include: {
        template: { include: { items: { orderBy: { ordem: 'asc' } } } },
      },
    })

    if (!original) {
      return reply.status(404).send({
        error: 'Execucao nao encontrada',
        code: 'EXECUTION_NOT_FOUND',
      })
    }

    let dataExecucao: Date
    if (bodyParsed.success && bodyParsed.data.data) {
      dataExecucao = new Date(bodyParsed.data.data + 'T00:00:00')
    } else {
      dataExecucao = new Date()
      dataExecucao.setHours(0, 0, 0, 0)
    }

    const execution = await prisma.$transaction(async (tx) => {
      const template = await tx.checklistTemplate.create({
        data: {
          nome: original.template.nome,
          horario: original.template.horario,
          unitId: original.unitId,
          isAdhoc: true,
          obrigatorio: false,
          atribuidoAId: original.atribuidoAId,
          items: {
            create: original.template.items.map(item => ({
              descricao: item.descricao,
              ordem: item.ordem,
              tipo: item.tipo,
              obrigatorio: item.obrigatorio,
              exigeFoto: item.exigeFoto,
              exigeObservacao: item.exigeObservacao,
              isCritico: item.isCritico,
              peso: item.peso,
              rotulos: (item.rotulos as any) ?? Prisma.DbNull,
            })),
          },
        },
      })

      const exec = await tx.checklistExecution.create({
        data: {
          templateId: template.id,
          unitId: original.unitId,
          turno: original.turno,
          data: dataExecucao,
          atribuidoAId: original.atribuidoAId,
          status: 'pendente',
        },
        include: {
          template: { select: { id: true, nome: true } },
          atribuidoA: { select: { id: true, nome: true } },
        },
      })
      return exec
    })

    await createAuditLog(request, 'duplicar_execucao_checklist', 'ChecklistExecution', execution.id, {
      originalId: id,
    })

    return reply.status(201).send(execution)
  })

  // ============================================================
  // PATCH /executions/:id/metadata — Editar metadados de execucao nao concluida
  // ============================================================
  app.patch('/executions/:id/metadata', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })
    }

    const bodyParsed = z.object({
      turno: z.enum(['manha', 'tarde', 'noite']).optional(),
      atribuidoAId: z.string().uuid().optional().nullable(),
      responsavelId: z.string().uuid().optional().nullable(),
      data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato invalido (YYYY-MM-DD)').optional(),
    }).safeParse(request.body)

    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: bodyParsed.error.flatten().fieldErrors,
      })
    }

    const { id } = paramsParsed.data
    const execution = await prisma.checklistExecution.findUnique({ where: { id } })
    if (!execution) {
      return reply.status(404).send({ error: 'Execucao nao encontrada', code: 'EXECUTION_NOT_FOUND' })
    }
    if (execution.status === 'concluido') {
      return reply.status(400).send({
        error: 'Execucao ja foi concluida e nao pode ser editada',
        code: 'EXECUTION_ALREADY_COMPLETED',
      })
    }

    const data: any = {}
    if (bodyParsed.data.turno !== undefined) data.turno = bodyParsed.data.turno
    if (bodyParsed.data.atribuidoAId !== undefined) data.atribuidoAId = bodyParsed.data.atribuidoAId
    if (bodyParsed.data.responsavelId !== undefined) data.responsavelId = bodyParsed.data.responsavelId
    if (bodyParsed.data.data !== undefined) data.data = new Date(bodyParsed.data.data + 'T00:00:00')

    const updated = await prisma.checklistExecution.update({
      where: { id },
      data,
      include: {
        template: { select: { id: true, nome: true } },
        atribuidoA: { select: { id: true, nome: true } },
        responsavel: { select: { id: true, nome: true, matricula: true } },
        executadoPor: { select: { id: true, nome: true } },
      },
    })

    await createAuditLog(request, 'editar_execucao_checklist', 'ChecklistExecution', id, {
      campos_alterados: Object.keys(data),
    })

    return reply.status(200).send(updated)
  })

  // ============================================================
  // DELETE /executions/:id — Excluir execucao nao concluida
  // ============================================================
  app.delete('/executions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const paramsParsed = idParamSchema.safeParse(request.params)
    if (!paramsParsed.success) {
      return reply.status(400).send({ error: 'ID invalido', code: 'VALIDATION_ERROR' })
    }

    const { id } = paramsParsed.data

    const execution = await prisma.checklistExecution.findFirst({ where: { id } })
    if (!execution) {
      return reply.status(404).send({ error: 'Execucao nao encontrada', code: 'EXECUTION_NOT_FOUND' })
    }
    if (execution.status === 'concluido') {
      return reply.status(400).send({
        error: 'Execucao ja foi concluida e nao pode ser excluida',
        code: 'EXECUTION_ALREADY_COMPLETED',
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.checklistItemResponse.deleteMany({ where: { executionId: id } })
      await tx.checklistExecution.delete({ where: { id } })
    })

    await createAuditLog(request, 'excluir_execucao_checklist', 'ChecklistExecution', id, {
      templateId: execution.templateId,
      status: execution.status,
    })

    return reply.status(200).send({ success: true })
  })

  // ============================================================
  // GET /executions — Listar execucoes com filtros e paginacao
  // ============================================================
  app.get('/executions', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listExecutionsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Parametros invalidos',
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten().fieldErrors,
      })
    }

    const { page, limit, unitId, data, status, templateId } = parsed.data
    const { skip, take } = calcPagination(page, limit)
    const unitFilter = getUnitFilter(request)

    const where: any = {
      ...unitFilter,
      ...(unitId ? { unitId } : {}),
      ...(status ? { status } : {}),
      ...(templateId ? { templateId } : {}),
    }

    if (data) {
      const dataFiltro = new Date(data)
      dataFiltro.setHours(0, 0, 0, 0)
      const dataFim = new Date(dataFiltro)
      dataFim.setDate(dataFim.getDate() + 1)
      where.data = { gte: dataFiltro, lt: dataFim }
    }

    const [executions, total] = await Promise.all([
      prisma.checklistExecution.findMany({
        where,
        skip,
        take,
        orderBy: { iniciadoAt: 'desc' },
        include: {
          template: { select: { id: true, nome: true, horario: true } },
          unit: { select: { id: true, codigo: true } },
          executadoPor: { select: { id: true, nome: true } },
          atribuidoA: { select: { id: true, nome: true } },
          responsavel: { select: { id: true, nome: true, matricula: true } },
          _count: { select: { responses: true } },
        },
      }),
      prisma.checklistExecution.count({ where }),
    ])

    return reply.status(200).send({
      data: executions,
      pagination: {
        page,
        limit,
        total,
        totalPages: calcTotalPages(total, limit),
      },
    })
  })

  // ============================================================
  // POST /checklist/analyze-foto — Analisar foto com IA
  // ============================================================
  app.post('/analyze-foto', { onRequest: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = z.object({
      fotoUrl: z.string().url('URL inválida'),
      itemDescricao: z.string().min(1).max(500),
      contexto: z.string().max(200).optional(),
    }).safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Dados inválidos', code: 'VALIDATION_ERROR' })
    }

    const configAtiva = await prisma.systemConfig.findUnique({ where: { chave: 'ia_analise_checklist_ativa' } })
    if (configAtiva?.valor !== 'true') {
      return reply.status(503).send({ error: 'Análise de IA desativada nas configurações', code: 'AI_DISABLED' })
    }

    try {
      const analise = await analisarFotoChecklist(
        parsed.data.fotoUrl,
        parsed.data.itemDescricao,
        parsed.data.contexto,
      )
      return reply.send(analise)
    } catch (e: any) {
      return reply.status(500).send({ error: 'Erro ao analisar foto', code: 'AI_ERROR' })
    }
  })
}
