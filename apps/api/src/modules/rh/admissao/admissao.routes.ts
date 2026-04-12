import { FastifyInstance } from 'fastify'
import { prisma } from '@pai/database'
import { requirePermission } from '../../../middlewares/auth.middleware'
import { createAuditLog } from '../../../lib/audit'
import {
  criarAdmissaoSchema,
  enviarAdmissaoSchema,
  preencherAdmissaoSchema,
  aprovarAdmissaoSchema,
  rejeitarAdmissaoSchema,
  admissaoIdParamSchema,
  admissaoTokenParamSchema,
  listAdmissoesQuerySchema,
} from './admissao.schemas'

export async function admissaoRoutes(app: FastifyInstance) {
  // Listar admissões
  app.get('/', {
    preHandler: [app.authenticate, requirePermission('rh_admissao', 'visualizar')],
  }, async (request, reply) => {
    const query = listAdmissoesQuerySchema.parse(request.query)
    const skip = (query.page - 1) * query.limit

    const where: any = {}
    if (query.status) where.status = query.status
    if (query.search) {
      where.colaborador = { nome: { contains: query.search, mode: 'insensitive' } }
    }

    const [items, total] = await Promise.all([
      prisma.admissaoDigital.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          colaborador: { select: { id: true, nome: true, matricula: true, cargo: { select: { nome: true } } } },
          criadoPor: { select: { id: true, nome: true } },
          aprovadoPor: { select: { id: true, nome: true } },
        },
      }),
      prisma.admissaoDigital.count({ where }),
    ])

    return { items, total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) }
  })

  // Buscar por ID
  app.get('/:id', {
    preHandler: [app.authenticate, requirePermission('rh_admissao', 'visualizar')],
  }, async (request, reply) => {
    const { id } = admissaoIdParamSchema.parse(request.params)

    const admissao = await prisma.admissaoDigital.findUnique({
      where: { id },
      include: {
        colaborador: {
          select: { id: true, nome: true, matricula: true, email: true, cargo: { select: { nome: true } }, unit: { select: { nome: true } } },
        },
        criadoPor: { select: { id: true, nome: true } },
        aprovadoPor: { select: { id: true, nome: true } },
      },
    })

    if (!admissao) return reply.status(404).send({ error: 'Admissão não encontrada', code: 'NOT_FOUND' })

    return admissao
  })

  // Criar admissão (gera link para o colaborador preencher)
  app.post('/', {
    preHandler: [app.authenticate, requirePermission('rh_admissao', 'criar')],
  }, async (request, reply) => {
    const user = (request as any).user
    const data = criarAdmissaoSchema.parse(request.body)

    // Verificar se colaborador existe
    const colaborador = await prisma.colaborador.findUnique({ where: { id: data.colaboradorId } })
    if (!colaborador) return reply.status(404).send({ error: 'Colaborador não encontrado', code: 'NOT_FOUND' })

    // Verificar se já existe admissão ativa
    const existing = await prisma.admissaoDigital.findUnique({ where: { colaboradorId: data.colaboradorId } })
    if (existing) return reply.status(409).send({ error: 'Já existe uma admissão para este colaborador', code: 'CONFLICT' })

    const admissao = await prisma.admissaoDigital.create({
      data: {
        colaboradorId: data.colaboradorId,
        emailEnviado: data.emailEnviado,
        dataExpiracao: data.dataExpiracao ? new Date(data.dataExpiracao) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
        observacoes: data.observacoes,
        criadoPorId: user.sub,
      },
      include: {
        colaborador: { select: { nome: true, matricula: true } },
      },
    })

    await createAuditLog(request, 'criar', 'AdmissaoDigital', admissao.id, data)
    return reply.status(201).send(admissao)
  })

  // Enviar link por email (muda status para 'enviado')
  app.patch('/:id/enviar', {
    preHandler: [app.authenticate, requirePermission('rh_admissao', 'editar')],
  }, async (request, reply) => {
    const { id } = admissaoIdParamSchema.parse(request.params)
    const data = enviarAdmissaoSchema.parse(request.body)

    const admissao = await prisma.admissaoDigital.findUnique({ where: { id } })
    if (!admissao) return reply.status(404).send({ error: 'Admissão não encontrada', code: 'NOT_FOUND' })
    if (!['rascunho', 'rejeitado'].includes(admissao.status)) {
      return reply.status(400).send({ error: 'Admissão não pode ser enviada no status atual', code: 'INVALID_STATUS' })
    }

    const updated = await prisma.admissaoDigital.update({
      where: { id },
      data: {
        status: 'enviado',
        emailEnviado: data.emailEnviado,
        dataEnvio: new Date(),
        dataExpiracao: data.dataExpiracao ? new Date(data.dataExpiracao) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    await createAuditLog(request, 'enviar', 'AdmissaoDigital', id, data)
    return updated
  })

  // Aprovar admissão
  app.patch('/:id/aprovar', {
    preHandler: [app.authenticate, requirePermission('rh_admissao', 'aprovar')],
  }, async (request, reply) => {
    const { id } = admissaoIdParamSchema.parse(request.params)
    const user = (request as any).user
    const data = aprovarAdmissaoSchema.parse(request.body)

    const admissao = await prisma.admissaoDigital.findUnique({
      where: { id },
      include: { colaborador: true },
    })
    if (!admissao) return reply.status(404).send({ error: 'Admissão não encontrada', code: 'NOT_FOUND' })
    if (admissao.status !== 'aguardando_aprovacao') {
      return reply.status(400).send({ error: 'Admissão não está aguardando aprovação', code: 'INVALID_STATUS' })
    }

    // Aplica os dados preenchidos ao colaborador
    const dados = admissao.dadosPreenchidos as any
    if (dados) {
      const updateData: any = {}
      const pessoais = ['nomeSocial', 'dataNascimento', 'genero', 'estadoCivil', 'nacionalidade', 'naturalidade',
        'cpf', 'rg', 'rgOrgao', 'rgDataEmissao', 'ctpsNumero', 'ctpsSerie', 'ctpsUF', 'pisNit',
        'cnhNumero', 'cnhCategoria', 'cnhValidade', 'tituloEleitor', 'reservista',
        'email', 'telefone', 'celular']
      pessoais.forEach((k) => { if (dados[k] !== undefined) updateData[k] = dados[k] })

      await prisma.$transaction(async (tx) => {
        if (Object.keys(updateData).length > 0) {
          await tx.colaborador.update({ where: { id: admissao.colaboradorId }, data: updateData })
        }

        // Endereço
        if (dados.cep || dados.logradouro) {
          await tx.enderecoColaborador.upsert({
            where: { colaboradorId: admissao.colaboradorId },
            create: { colaboradorId: admissao.colaboradorId, cep: dados.cep, logradouro: dados.logradouro, numero: dados.numero, complemento: dados.complemento, bairro: dados.bairro, cidade: dados.cidade, uf: dados.uf },
            update: { cep: dados.cep, logradouro: dados.logradouro, numero: dados.numero, complemento: dados.complemento, bairro: dados.bairro, cidade: dados.cidade, uf: dados.uf },
          })
        }

        // Dependentes
        if (dados.dependentes?.length) {
          await tx.dependente.createMany({
            data: dados.dependentes.map((d: any) => ({
              colaboradorId: admissao.colaboradorId,
              nome: d.nome,
              parentesco: d.parentesco,
              dataNascimento: d.dataNascimento ? new Date(d.dataNascimento) : null,
              cpf: d.cpf,
            })),
          })
        }

        // Formações
        if (dados.formacoes?.length) {
          await tx.formacaoAcademica.createMany({
            data: dados.formacoes.map((f: any) => ({
              colaboradorId: admissao.colaboradorId,
              nivel: f.nivel,
              curso: f.curso,
              instituicao: f.instituicao,
              anoConclusao: f.anoConclusao,
              status: f.status || 'completo',
            })),
          })
        }

        await tx.admissaoDigital.update({
          where: { id },
          data: {
            status: 'aprovado',
            aprovadoPorId: user.sub,
            dataAprovacao: new Date(),
            observacoes: data.observacoes ?? admissao.observacoes,
          },
        })
      })
    } else {
      await prisma.admissaoDigital.update({
        where: { id },
        data: { status: 'aprovado', aprovadoPorId: user.sub, dataAprovacao: new Date() },
      })
    }

    await createAuditLog(request, 'aprovar', 'AdmissaoDigital', id, data)
    return { message: 'Admissão aprovada com sucesso' }
  })

  // Rejeitar admissão
  app.patch('/:id/rejeitar', {
    preHandler: [app.authenticate, requirePermission('rh_admissao', 'rejeitar')],
  }, async (request, reply) => {
    const { id } = admissaoIdParamSchema.parse(request.params)
    const data = rejeitarAdmissaoSchema.parse(request.body)

    const admissao = await prisma.admissaoDigital.findUnique({ where: { id } })
    if (!admissao) return reply.status(404).send({ error: 'Admissão não encontrada', code: 'NOT_FOUND' })
    if (!['aguardando_aprovacao', 'enviado', 'em_preenchimento'].includes(admissao.status)) {
      return reply.status(400).send({ error: 'Admissão não pode ser rejeitada no status atual', code: 'INVALID_STATUS' })
    }

    await prisma.admissaoDigital.update({
      where: { id },
      data: { status: 'rejeitado', observacoes: data.observacoes },
    })

    await createAuditLog(request, 'rejeitar', 'AdmissaoDigital', id, data)
    return { message: 'Admissão rejeitada' }
  })

  // ========================
  // ROTA PÚBLICA — sem autenticação
  // ========================

  // Buscar dados da admissão pelo token (candidato acessa)
  app.get('/publico/:token', async (request, reply) => {
    const { token } = admissaoTokenParamSchema.parse(request.params)

    const admissao = await prisma.admissaoDigital.findUnique({
      where: { token },
      include: {
        colaborador: {
          select: {
            nome: true, matricula: true, tipoContrato: true, dataAdmissao: true,
            cargo: { select: { nome: true, nivel: true } },
            unit: { select: { nome: true } },
          },
        },
      },
    })

    if (!admissao) return reply.status(404).send({ error: 'Link inválido', code: 'NOT_FOUND' })

    // Verificar expiração
    if (admissao.dataExpiracao && new Date() > admissao.dataExpiracao) {
      await prisma.admissaoDigital.update({ where: { token }, data: { status: 'expirado' } })
      return reply.status(410).send({ error: 'Este link expirou', code: 'EXPIRED' })
    }

    if (admissao.status === 'aprovado') {
      return reply.status(400).send({ error: 'Esta admissão já foi aprovada', code: 'ALREADY_APPROVED' })
    }

    // Atualizar status para em_preenchimento se ainda não foi
    if (admissao.status === 'enviado') {
      await prisma.admissaoDigital.update({ where: { token }, data: { status: 'em_preenchimento' } })
    }

    return {
      token: admissao.token,
      status: admissao.status,
      colaborador: admissao.colaborador,
      dataExpiracao: admissao.dataExpiracao,
    }
  })

  // Submeter formulário (candidato envia dados)
  app.post('/publico/:token', async (request, reply) => {
    const { token } = admissaoTokenParamSchema.parse(request.params)
    const dados = preencherAdmissaoSchema.parse(request.body)

    const admissao = await prisma.admissaoDigital.findUnique({ where: { token } })
    if (!admissao) return reply.status(404).send({ error: 'Link inválido', code: 'NOT_FOUND' })

    if (admissao.dataExpiracao && new Date() > admissao.dataExpiracao) {
      return reply.status(410).send({ error: 'Este link expirou', code: 'EXPIRED' })
    }

    if (!['em_preenchimento', 'enviado'].includes(admissao.status)) {
      return reply.status(400).send({ error: 'Formulário não pode ser preenchido no status atual', code: 'INVALID_STATUS' })
    }

    await prisma.admissaoDigital.update({
      where: { token },
      data: {
        dadosPreenchidos: dados,
        dataPreenchimento: new Date(),
        status: 'aguardando_aprovacao',
      },
    })

    return { message: 'Dados enviados com sucesso! Aguarde a aprovação do RH.' }
  })
}
