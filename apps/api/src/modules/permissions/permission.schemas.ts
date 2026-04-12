import { z } from 'zod'

// Todos os modulos do sistema e suas acoes disponiveis
export const SYSTEM_MODULES = {
  dashboard: {
    label: 'Dashboard',
    actions: ['visualizar'],
  },
  unidades: {
    label: 'Unidades',
    actions: ['visualizar', 'criar', 'editar', 'excluir'],
  },
  usuarios: {
    label: 'Usuarios',
    actions: ['visualizar', 'criar', 'editar', 'excluir'],
  },
  produtos: {
    label: 'Produtos',
    actions: ['visualizar', 'criar', 'editar', 'excluir'],
  },
  categorias: {
    label: 'Categorias',
    actions: ['visualizar', 'criar', 'editar', 'excluir'],
  },
  receitas: {
    label: 'Receitas',
    actions: ['visualizar', 'criar', 'editar'],
  },
  producao: {
    label: 'Producao',
    actions: ['visualizar', 'criar', 'iniciar', 'concluir', 'cancelar'],
  },
  estoque: {
    label: 'Estoque',
    actions: ['visualizar', 'entrada', 'saida', 'ajuste', 'perda', 'inventario'],
  },
  compras: {
    label: 'Compras',
    actions: ['visualizar', 'criar_ciclo', 'fechar_ciclo', 'reabrir_ciclo', 'excluir_ciclo', 'criar_pedido', 'editar_pedido', 'consolidar'],
  },
  etiquetas: {
    label: 'Etiquetas',
    actions: ['visualizar', 'gerar', 'reimprimir'],
  },
  utensilios: {
    label: 'Utensilios',
    actions: ['visualizar', 'criar', 'editar', 'movimentar', 'contagem', 'reposicao'],
  },
  checklist: {
    label: 'Checklist',
    actions: ['visualizar', 'criar_template', 'editar_template', 'executar', 'concluir'],
  },
  ocorrencias: {
    label: 'Ocorrencias',
    actions: ['visualizar', 'criar', 'editar', 'alterar_status', 'comentar'],
  },
  notificacoes: {
    label: 'Notificacoes',
    actions: ['visualizar'],
  },
  relatorios: {
    label: 'Relatorios',
    actions: ['visualizar', 'exportar'],
  },
  integracoes: {
    label: 'Integracoes',
    actions: ['visualizar', 'criar', 'editar', 'excluir'],
  },
  auditoria: {
    label: 'Auditoria',
    actions: ['visualizar'],
  },
  perfis: {
    label: 'Perfis e Permissoes',
    actions: ['visualizar', 'editar'],
  },
  telas: {
    label: 'Telas de Pao Frances',
    actions: ['visualizar', 'criar', 'excluir'],
  },
  rh_colaboradores: {
    label: 'RH - Colaboradores',
    actions: ['visualizar', 'criar', 'editar', 'excluir', 'ver_salario', 'editar_salario', 'vincular_usuario'],
  },
  rh_cargos: {
    label: 'RH - Cargos e Salarios',
    actions: ['visualizar', 'criar', 'editar', 'excluir', 'faixas'],
  },
  rh_admissao: {
    label: 'RH - Admissao Digital',
    actions: ['visualizar', 'criar', 'editar', 'aprovar', 'rejeitar'],
  },
  rh_desligamento: {
    label: 'RH - Desligamento',
    actions: ['visualizar', 'criar', 'editar', 'concluir', 'cancelar'],
  },
  rh_ferias: {
    label: 'RH - Ferias',
    actions: ['visualizar', 'criar', 'aprovar', 'reprovar', 'cancelar'],
  },
  rh_documentos: {
    label: 'RH - Documentos e Contratos',
    actions: ['visualizar', 'criar', 'editar', 'excluir'],
  },
  rh_holerites: {
    label: 'RH - Holerites',
    actions: ['visualizar', 'criar', 'editar', 'publicar', 'excluir'],
  },
  rh_beneficios: {
    label: 'RH - Beneficios',
    actions: ['visualizar', 'criar', 'editar'],
  },
  rh_aso: {
    label: 'RH - Exames Ocupacionais (ASO)',
    actions: ['visualizar', 'criar', 'editar', 'excluir'],
  },
  rh_ponto: {
    label: 'RH - Controle de Ponto',
    actions: ['visualizar', 'registrar', 'ajustar', 'aprovar', 'gerenciar', 'fechar'],
  },
  rh_desempenho: {
    label: 'RH - Gestão de Desempenho',
    actions: ['visualizar', 'avaliar', 'gerenciar'],
  },
  rh_comunicados: {
    label: 'RH - Comunicação Interna',
    actions: ['visualizar', 'criar', 'editar', 'publicar', 'excluir'],
  },
  rh_organograma: {
    label: 'RH - Organograma',
    actions: ['visualizar'],
  },
  rh_relatorios: {
    label: 'RH - Relatórios e Indicadores',
    actions: ['visualizar', 'exportar'],
  },
} as const

export type ModuleName = keyof typeof SYSTEM_MODULES

// Schema para salvar permissoes de um role
export const saveRolePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      modulo: z.string().min(1),
      acao: z.string().min(1),
    })
  ),
})

export type SaveRolePermissionsInput = z.infer<typeof saveRolePermissionsSchema>
