import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

// bcrypt hash para "Admin@123" com 12 rounds (pre-computado para o seed)
const ADMIN_PASSWORD_HASH = '$2b$12$iz28LQlz3i3QgkTILmv.h.v0TW8Zvd7xQzM3tU8OEz0CNFWKEvt.W'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed do banco de dados...')

  // Limpar dados existentes (ordem inversa das dependencias)
  await prisma.checklistItemResponse.deleteMany()
  await prisma.checklistExecution.deleteMany()
  await prisma.checklistItem.deleteMany()
  await prisma.checklistTemplate.deleteMany()
  await prisma.occurrenceHistory.deleteMany()
  await prisma.occurrenceComment.deleteMany()
  await prisma.occurrence.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.integrationLog.deleteMany()
  await prisma.integrationMapping.deleteMany()
  await prisma.integration.deleteMany()
  await prisma.label.deleteMany()
  await prisma.labelTemplate.deleteMany()
  await prisma.productionOrderIngredient.deleteMany()
  await prisma.productionOrder.deleteMany()
  await prisma.recipeIngredient.deleteMany()
  await prisma.recipe.deleteMany()
  await prisma.purchaseRequest.deleteMany()
  await prisma.purchaseCycle.deleteMany()
  await prisma.stockEntry.deleteMany()
  await prisma.stockBalance.deleteMany()
  await prisma.product.deleteMany()
  await prisma.subgroup.deleteMany()
  await prisma.productGroup.deleteMany()
  await prisma.category.deleteMany()
  await prisma.utensilMovement.deleteMany()
  await prisma.utensil.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.rolePermission.deleteMany()
  await prisma.userPermission.deleteMany()
  await prisma.userUnit.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.user.deleteMany()
  await prisma.role.deleteMany()
  await prisma.unit.deleteMany()

  // --- Roles ---
  console.log('Criando roles...')
  const defaultRoles = ['gerente_geral', 'gerente_unidade', 'supervisor', 'producao', 'administrativo']
  const roles = await Promise.all(
    defaultRoles.map((nome) =>
      prisma.role.create({ data: { nome } })
    )
  )
  const roleMap = Object.fromEntries(roles.map((r) => [r.nome, r.id]))

  // --- Permissoes padroes dos roles ---
  console.log('Criando permissoes padrao dos perfis...')

  // Gerente Unidade - acesso amplo exceto sistema e auditoria
  const gerenteUnidadePerms = [
    { modulo: 'dashboard', acoes: ['visualizar'] },
    { modulo: 'unidades', acoes: ['visualizar', 'editar'] },
    { modulo: 'usuarios', acoes: ['visualizar', 'criar', 'editar'] },
    { modulo: 'produtos', acoes: ['visualizar', 'criar', 'editar', 'excluir'] },
    { modulo: 'categorias', acoes: ['visualizar', 'criar', 'editar', 'excluir'] },
    { modulo: 'receitas', acoes: ['visualizar', 'criar', 'editar'] },
    { modulo: 'producao', acoes: ['visualizar', 'criar', 'iniciar', 'concluir', 'cancelar'] },
    { modulo: 'estoque', acoes: ['visualizar', 'entrada', 'saida', 'ajuste', 'perda', 'inventario'] },
    { modulo: 'compras', acoes: ['visualizar', 'criar_ciclo', 'fechar_ciclo', 'criar_pedido', 'editar_pedido', 'consolidar'] },
    { modulo: 'etiquetas', acoes: ['visualizar', 'gerar', 'reimprimir'] },
    { modulo: 'utensilios', acoes: ['visualizar', 'criar', 'editar', 'movimentar', 'contagem'] },
    { modulo: 'checklist', acoes: ['visualizar', 'criar_template', 'editar_template', 'executar', 'concluir'] },
    { modulo: 'ocorrencias', acoes: ['visualizar', 'criar', 'editar', 'alterar_status', 'comentar'] },
    { modulo: 'notificacoes', acoes: ['visualizar'] },
    { modulo: 'relatorios', acoes: ['visualizar', 'exportar'] },
  ]

  // Supervisor - operacoes e qualidade, sem gestao
  const supervisorPerms = [
    { modulo: 'dashboard', acoes: ['visualizar'] },
    { modulo: 'produtos', acoes: ['visualizar'] },
    { modulo: 'receitas', acoes: ['visualizar'] },
    { modulo: 'producao', acoes: ['visualizar', 'criar', 'iniciar', 'concluir'] },
    { modulo: 'estoque', acoes: ['visualizar', 'entrada', 'saida'] },
    { modulo: 'compras', acoes: ['visualizar', 'criar_pedido'] },
    { modulo: 'etiquetas', acoes: ['visualizar', 'gerar', 'reimprimir'] },
    { modulo: 'utensilios', acoes: ['visualizar', 'movimentar', 'contagem'] },
    { modulo: 'checklist', acoes: ['visualizar', 'executar', 'concluir'] },
    { modulo: 'ocorrencias', acoes: ['visualizar', 'criar', 'comentar'] },
    { modulo: 'notificacoes', acoes: ['visualizar'] },
    { modulo: 'relatorios', acoes: ['visualizar'] },
  ]

  // Producao - foco em producao e estoque
  const producaoPerms = [
    { modulo: 'dashboard', acoes: ['visualizar'] },
    { modulo: 'receitas', acoes: ['visualizar'] },
    { modulo: 'producao', acoes: ['visualizar', 'iniciar', 'concluir'] },
    { modulo: 'estoque', acoes: ['visualizar', 'entrada', 'saida'] },
    { modulo: 'etiquetas', acoes: ['visualizar', 'gerar'] },
    { modulo: 'checklist', acoes: ['visualizar', 'executar', 'concluir'] },
    { modulo: 'notificacoes', acoes: ['visualizar'] },
  ]

  // Administrativo - compras, relatorios, integracoes
  const administrativoPerms = [
    { modulo: 'dashboard', acoes: ['visualizar'] },
    { modulo: 'produtos', acoes: ['visualizar', 'criar', 'editar'] },
    { modulo: 'categorias', acoes: ['visualizar', 'criar', 'editar'] },
    { modulo: 'compras', acoes: ['visualizar', 'criar_ciclo', 'fechar_ciclo', 'criar_pedido', 'editar_pedido', 'consolidar'] },
    { modulo: 'estoque', acoes: ['visualizar'] },
    { modulo: 'notificacoes', acoes: ['visualizar'] },
    { modulo: 'relatorios', acoes: ['visualizar', 'exportar'] },
    { modulo: 'integracoes', acoes: ['visualizar', 'criar', 'editar'] },
  ]

  const rolePermsMap: Record<string, { modulo: string; acoes: string[] }[]> = {
    gerente_unidade: gerenteUnidadePerms,
    supervisor: supervisorPerms,
    producao: producaoPerms,
    administrativo: administrativoPerms,
  }

  for (const [roleName, perms] of Object.entries(rolePermsMap)) {
    const roleId = roleMap[roleName]
    for (const { modulo, acoes } of perms) {
      for (const acao of acoes) {
        await prisma.rolePermission.create({
          data: { roleId, modulo, acao },
        })
      }
    }
  }

  // --- Unidades ---
  console.log('Criando unidades...')
  const units = await Promise.all([
    prisma.unit.create({
      data: { nome: 'Unidade Centro', codigo: 'PAD-001', endereco: 'Rua Central, 100 - Centro', telefone: '(11) 3000-0001' },
    }),
    prisma.unit.create({
      data: { nome: 'Unidade Norte', codigo: 'PAD-002', endereco: 'Av. Norte, 500 - Zona Norte', telefone: '(11) 3000-0002' },
    }),
    prisma.unit.create({
      data: { nome: 'Unidade Sul', codigo: 'PAD-003', endereco: 'Rua Sul, 200 - Zona Sul', telefone: '(11) 3000-0003' },
    }),
  ])

  // --- Usuario admin ---
  console.log('Criando usuario admin...')
  // Hash bcrypt gerado com: await bcrypt.hash('Admin@123', 12)
  const admin = await prisma.user.create({
    data: {
      nome: 'Administrador Geral',
      email: 'admin@padaria.com',
      senha: ADMIN_PASSWORD_HASH,
    },
  })

  // Vincular admin a todas as unidades como gerente_geral
  await Promise.all(
    units.map((unit) =>
      prisma.userUnit.create({
        data: {
          userId: admin.id,
          unitId: unit.id,
          roleId: roleMap.gerente_geral,
        },
      })
    )
  )

  // --- Categorias ---
  console.log('Criando categorias...')
  const categorias = await Promise.all([
    prisma.category.create({ data: { nome: 'Farinhas e Cereais' } }),
    prisma.category.create({ data: { nome: 'Acucares e Adocantes' } }),
    prisma.category.create({ data: { nome: 'Laticinios' } }),
    prisma.category.create({ data: { nome: 'Ovos' } }),
    prisma.category.create({ data: { nome: 'Gorduras e Oleos' } }),
    prisma.category.create({ data: { nome: 'Fermentos e Melhoradores' } }),
    prisma.category.create({ data: { nome: 'Frutas e Polpas' } }),
    prisma.category.create({ data: { nome: 'Chocolates e Coberturas' } }),
    prisma.category.create({ data: { nome: 'Embalagens' } }),
    prisma.category.create({ data: { nome: 'Temperos e Condimentos' } }),
  ])
  const catMap = Object.fromEntries(categorias.map((c) => [c.nome, c.id]))

  // --- Grupos ---
  console.log('Criando grupos...')
  const grupos = await Promise.all([
    prisma.productGroup.create({ data: { nome: 'Insumos de Panificacao' } }),
    prisma.productGroup.create({ data: { nome: 'Insumos de Confeitaria' } }),
    prisma.productGroup.create({ data: { nome: 'Materiais de Embalagem' } }),
  ])

  // --- Produtos ---
  console.log('Criando produtos...')
  const produtos = await Promise.all([
    prisma.product.create({ data: { nome: 'Farinha de Trigo Especial', sku: 'FAR-001', categoriaId: catMap['Farinhas e Cereais'], grupoId: grupos[0].id, unidadeMedida: 'kg', estoqueMinimo: 50, custoMedio: 4.50 } }),
    prisma.product.create({ data: { nome: 'Farinha de Trigo Integral', sku: 'FAR-002', categoriaId: catMap['Farinhas e Cereais'], grupoId: grupos[0].id, unidadeMedida: 'kg', estoqueMinimo: 20, custoMedio: 6.00 } }),
    prisma.product.create({ data: { nome: 'Acucar Cristal', sku: 'ACU-001', categoriaId: catMap['Acucares e Adocantes'], grupoId: grupos[0].id, unidadeMedida: 'kg', estoqueMinimo: 30, custoMedio: 3.80 } }),
    prisma.product.create({ data: { nome: 'Acucar Refinado', sku: 'ACU-002', categoriaId: catMap['Acucares e Adocantes'], grupoId: grupos[0].id, unidadeMedida: 'kg', estoqueMinimo: 20, custoMedio: 4.20 } }),
    prisma.product.create({ data: { nome: 'Ovos (caixa 30un)', sku: 'OVO-001', categoriaId: catMap['Ovos'], grupoId: grupos[0].id, unidadeMedida: 'cx', estoqueMinimo: 10, custoMedio: 18.00 } }),
    prisma.product.create({ data: { nome: 'Leite Integral', sku: 'LAT-001', categoriaId: catMap['Laticinios'], grupoId: grupos[0].id, unidadeMedida: 'lt', estoqueMinimo: 40, custoMedio: 5.50 } }),
    prisma.product.create({ data: { nome: 'Manteiga sem Sal', sku: 'LAT-002', categoriaId: catMap['Laticinios'], grupoId: grupos[0].id, unidadeMedida: 'kg', estoqueMinimo: 10, custoMedio: 35.00 } }),
    prisma.product.create({ data: { nome: 'Creme de Leite', sku: 'LAT-003', categoriaId: catMap['Laticinios'], grupoId: grupos[1].id, unidadeMedida: 'lt', estoqueMinimo: 15, custoMedio: 8.00 } }),
    prisma.product.create({ data: { nome: 'Fermento Biologico Seco', sku: 'FER-001', categoriaId: catMap['Fermentos e Melhoradores'], grupoId: grupos[0].id, unidadeMedida: 'kg', estoqueMinimo: 5, custoMedio: 25.00 } }),
    prisma.product.create({ data: { nome: 'Fermento Quimico', sku: 'FER-002', categoriaId: catMap['Fermentos e Melhoradores'], grupoId: grupos[1].id, unidadeMedida: 'kg', estoqueMinimo: 3, custoMedio: 12.00 } }),
    prisma.product.create({ data: { nome: 'Oleo de Soja', sku: 'OLE-001', categoriaId: catMap['Gorduras e Oleos'], grupoId: grupos[0].id, unidadeMedida: 'lt', estoqueMinimo: 20, custoMedio: 7.00 } }),
    prisma.product.create({ data: { nome: 'Gordura Vegetal Hidrogenada', sku: 'OLE-002', categoriaId: catMap['Gorduras e Oleos'], grupoId: grupos[0].id, unidadeMedida: 'kg', estoqueMinimo: 10, custoMedio: 14.00 } }),
    prisma.product.create({ data: { nome: 'Chocolate em Po', sku: 'CHO-001', categoriaId: catMap['Chocolates e Coberturas'], grupoId: grupos[1].id, unidadeMedida: 'kg', estoqueMinimo: 5, custoMedio: 22.00 } }),
    prisma.product.create({ data: { nome: 'Chocolate Meio Amargo', sku: 'CHO-002', categoriaId: catMap['Chocolates e Coberturas'], grupoId: grupos[1].id, unidadeMedida: 'kg', estoqueMinimo: 5, custoMedio: 40.00 } }),
    prisma.product.create({ data: { nome: 'Polpa de Morango', sku: 'FRU-001', categoriaId: catMap['Frutas e Polpas'], grupoId: grupos[1].id, unidadeMedida: 'kg', estoqueMinimo: 5, custoMedio: 18.00 } }),
    prisma.product.create({ data: { nome: 'Sal Refinado', sku: 'TEM-001', categoriaId: catMap['Temperos e Condimentos'], grupoId: grupos[0].id, unidadeMedida: 'kg', estoqueMinimo: 10, custoMedio: 2.50 } }),
    prisma.product.create({ data: { nome: 'Essencia de Baunilha', sku: 'TEM-002', categoriaId: catMap['Temperos e Condimentos'], grupoId: grupos[1].id, unidadeMedida: 'lt', estoqueMinimo: 2, custoMedio: 30.00 } }),
    prisma.product.create({ data: { nome: 'Leite Condensado', sku: 'LAT-004', categoriaId: catMap['Laticinios'], grupoId: grupos[1].id, unidadeMedida: 'un', estoqueMinimo: 20, custoMedio: 6.50 } }),
    prisma.product.create({ data: { nome: 'Saco de Papel Kraft', sku: 'EMB-001', categoriaId: catMap['Embalagens'], grupoId: grupos[2].id, unidadeMedida: 'pct', estoqueMinimo: 50, custoMedio: 15.00 } }),
    prisma.product.create({ data: { nome: 'Caixa para Bolo', sku: 'EMB-002', categoriaId: catMap['Embalagens'], grupoId: grupos[2].id, unidadeMedida: 'un', estoqueMinimo: 30, custoMedio: 3.50 } }),
  ])
  const prodMap = Object.fromEntries(produtos.map((p) => [p.sku, p.id]))

  // --- Receitas ---
  console.log('Criando receitas...')
  const receitas = await Promise.all([
    prisma.recipe.create({
      data: {
        nome: 'Pao Frances',
        categoria: 'Panificacao',
        rendimento: 50,
        unidadeMedida: 'un',
        custoEstimado: 25.00,
        ingredients: {
          create: [
            { productId: prodMap['FAR-001'], quantidade: 5, unidadeMedida: 'kg' },
            { productId: prodMap['FER-001'], quantidade: 0.1, unidadeMedida: 'kg' },
            { productId: prodMap['TEM-001'], quantidade: 0.1, unidadeMedida: 'kg' },
            { productId: prodMap['OLE-001'], quantidade: 0.2, unidadeMedida: 'lt' },
          ],
        },
      },
    }),
    prisma.recipe.create({
      data: {
        nome: 'Bolo de Chocolate',
        categoria: 'Confeitaria',
        rendimento: 1,
        unidadeMedida: 'un',
        custoEstimado: 35.00,
        ingredients: {
          create: [
            { productId: prodMap['FAR-001'], quantidade: 0.5, unidadeMedida: 'kg' },
            { productId: prodMap['ACU-002'], quantidade: 0.4, unidadeMedida: 'kg' },
            { productId: prodMap['OVO-001'], quantidade: 0.5, unidadeMedida: 'cx', observacao: '15 ovos' },
            { productId: prodMap['CHO-001'], quantidade: 0.2, unidadeMedida: 'kg' },
            { productId: prodMap['LAT-001'], quantidade: 0.5, unidadeMedida: 'lt' },
            { productId: prodMap['LAT-002'], quantidade: 0.2, unidadeMedida: 'kg' },
            { productId: prodMap['FER-002'], quantidade: 0.02, unidadeMedida: 'kg' },
          ],
        },
      },
    }),
    prisma.recipe.create({
      data: {
        nome: 'Croissant',
        categoria: 'Panificacao',
        rendimento: 20,
        unidadeMedida: 'un',
        custoEstimado: 60.00,
        ingredients: {
          create: [
            { productId: prodMap['FAR-001'], quantidade: 2, unidadeMedida: 'kg' },
            { productId: prodMap['LAT-002'], quantidade: 0.5, unidadeMedida: 'kg' },
            { productId: prodMap['ACU-002'], quantidade: 0.15, unidadeMedida: 'kg' },
            { productId: prodMap['FER-001'], quantidade: 0.05, unidadeMedida: 'kg' },
            { productId: prodMap['LAT-001'], quantidade: 0.3, unidadeMedida: 'lt' },
            { productId: prodMap['OVO-001'], quantidade: 0.2, unidadeMedida: 'cx' },
            { productId: prodMap['TEM-001'], quantidade: 0.03, unidadeMedida: 'kg' },
          ],
        },
      },
    }),
    prisma.recipe.create({
      data: {
        nome: 'Brigadeiro',
        categoria: 'Confeitaria',
        rendimento: 40,
        unidadeMedida: 'un',
        custoEstimado: 20.00,
        ingredients: {
          create: [
            { productId: prodMap['LAT-004'], quantidade: 2, unidadeMedida: 'un' },
            { productId: prodMap['CHO-001'], quantidade: 0.1, unidadeMedida: 'kg' },
            { productId: prodMap['LAT-002'], quantidade: 0.03, unidadeMedida: 'kg' },
          ],
        },
      },
    }),
    prisma.recipe.create({
      data: {
        nome: 'Pao de Queijo',
        categoria: 'Panificacao',
        rendimento: 30,
        unidadeMedida: 'un',
        custoEstimado: 28.00,
        ingredients: {
          create: [
            { productId: prodMap['FAR-002'], quantidade: 1, unidadeMedida: 'kg', observacao: 'Polvilho azedo, usar farinha integral como substituto no seed' },
            { productId: prodMap['OVO-001'], quantidade: 0.3, unidadeMedida: 'cx' },
            { productId: prodMap['LAT-001'], quantidade: 0.5, unidadeMedida: 'lt' },
            { productId: prodMap['OLE-001'], quantidade: 0.2, unidadeMedida: 'lt' },
            { productId: prodMap['TEM-001'], quantidade: 0.02, unidadeMedida: 'kg' },
          ],
        },
      },
    }),
  ])

  // --- Saldo inicial de estoque (Unidade Centro) ---
  console.log('Criando saldo inicial de estoque...')
  for (const produto of produtos) {
    await prisma.stockBalance.create({
      data: {
        productId: produto.id,
        unitId: units[0].id,
        quantidade: produto.estoqueMinimo * 2, // dobro do minimo
      },
    })
    await prisma.stockEntry.create({
      data: {
        productId: produto.id,
        unitId: units[0].id,
        quantidade: produto.estoqueMinimo * 2,
        tipo: 'entrada',
        motivo: 'Saldo inicial - seed',
        responsavelId: admin.id,
      },
    })
  }

  // --- Templates de Checklist ---
  console.log('Criando templates de checklist...')
  const checklistAbertura = await prisma.checklistTemplate.create({
    data: {
      nome: 'Checklist de Abertura',
      setor: 'Operacao',
      horario: 'abertura',
      obrigatorio: true,
      items: {
        create: [
          { descricao: 'Verificar temperatura das geladeiras', ordem: 1, tipo: 'checkbox', obrigatorio: true },
          { descricao: 'Verificar limpeza do balcao', ordem: 2, tipo: 'checkbox', obrigatorio: true },
          { descricao: 'Verificar estoque de paes para o turno', ordem: 3, tipo: 'checkbox', obrigatorio: true },
          { descricao: 'Ligar equipamentos de producao', ordem: 4, tipo: 'checkbox', obrigatorio: true },
          { descricao: 'Foto do balcao montado', ordem: 5, tipo: 'foto', obrigatorio: true },
          { descricao: 'Observacoes gerais', ordem: 6, tipo: 'texto', obrigatorio: false },
        ],
      },
    },
  })

  const checklistFechamento = await prisma.checklistTemplate.create({
    data: {
      nome: 'Checklist de Fechamento',
      setor: 'Operacao',
      horario: 'fechamento',
      obrigatorio: true,
      items: {
        create: [
          { descricao: 'Desligar todos os equipamentos', ordem: 1, tipo: 'checkbox', obrigatorio: true },
          { descricao: 'Limpar area de producao', ordem: 2, tipo: 'checkbox', obrigatorio: true },
          { descricao: 'Registrar sobras do dia', ordem: 3, tipo: 'texto', obrigatorio: true },
          { descricao: 'Verificar trancas e alarmes', ordem: 4, tipo: 'checkbox', obrigatorio: true },
          { descricao: 'Foto da area limpa', ordem: 5, tipo: 'foto', obrigatorio: true },
        ],
      },
    },
  })

  // --- Label Templates ---
  console.log('Criando templates de etiquetas...')
  await Promise.all(
    receitas.map((receita) =>
      prisma.labelTemplate.create({
        data: {
          recipeId: receita.id,
          diasValidade: receita.categoria === 'Confeitaria' ? 3 : 1,
        },
      })
    )
  )

  console.log('Seed concluido com sucesso!')
  console.log(`Admin: admin@padaria.com / Admin@123`)
  console.log(`Unidades: ${units.map((u) => u.nome).join(', ')}`)
  console.log(`Produtos: ${produtos.length}`)
  console.log(`Receitas: ${receitas.length}`)
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
