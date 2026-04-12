'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  ShieldCheck,
  Crown,
  UserCog,
  User as UserIcon,
  Loader2,
  Save,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Plus,
  Trash2,
} from 'lucide-react'

// Tipos
interface RolePermission {
  modulo: string
  acao: string
}

interface RoleWithPermissions {
  id: string
  nome: string
  rolePermissions: RolePermission[]
}

interface SystemModule {
  key: string
  label: string
  actions: string[]
}

// Labels amigaveis para acoes
const ACTION_LABELS: Record<string, string> = {
  visualizar: 'Visualizar',
  criar: 'Criar',
  editar: 'Editar',
  excluir: 'Excluir',
  gerenciar: 'Gerenciar',
  entrada: 'Entrada',
  saida: 'Saida',
  ajuste: 'Ajuste',
  perda: 'Perda',
  inventario: 'Inventario',
  criar_ciclo: 'Criar Ciclo',
  fechar_ciclo: 'Fechar Ciclo',
  reabrir_ciclo: 'Reabrir Ciclo',
  criar_pedido: 'Criar Pedido',
  editar_pedido: 'Editar Pedido',
  consolidar: 'Consolidar',
  gerar: 'Gerar',
  reimprimir: 'Reimprimir',
  movimentar: 'Movimentar',
  contagem: 'Contagem',
  reposicao: 'Reposicao',
  criar_template: 'Criar Template',
  editar_template: 'Editar Template',
  executar: 'Executar',
  concluir: 'Concluir',
  iniciar: 'Iniciar',
  cancelar: 'Cancelar',
  alterar_status: 'Alterar Status',
  comentar: 'Comentar',
  exportar: 'Exportar',
  excluir_ciclo: 'Excluir Ciclo',
}

// Cores e icones conhecidos para perfis padrao + fallback para perfis dinamicos
const KNOWN_ROLES: Record<string, { icon: React.ElementType; color: string }> = {
  gerente_geral: { icon: Crown, color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800/30' },
  gerente_unidade: { icon: ShieldCheck, color: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800/30' },
  supervisor: { icon: UserCog, color: 'text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-900/20 dark:border-violet-800/30' },
  producao: { icon: UserIcon, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800/30' },
  administrativo: { icon: UserIcon, color: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900/20 dark:border-slate-800/30' },
}

const DYNAMIC_COLORS = [
  'text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-900/20 dark:border-cyan-800/30',
  'text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/20 dark:border-rose-800/30',
  'text-teal-600 bg-teal-50 border-teal-200 dark:text-teal-400 dark:bg-teal-900/20 dark:border-teal-800/30',
  'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-800/30',
  'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800/30',
]

function getRoleVisual(nome: string, index: number) {
  const known = KNOWN_ROLES[nome]
  if (known) return known
  return {
    icon: ShieldCheck,
    color: DYNAMIC_COLORS[index % DYNAMIC_COLORS.length],
  }
}

function formatRoleName(nome: string): string {
  return nome
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function PerfisPage() {
  const queryClient = useQueryClient()
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [editingPermissions, setEditingPermissions] = useState<Record<string, Set<string>>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Buscar roles com permissoes
  const { data: roles, isLoading: rolesLoading, error: rolesError } = useQuery<RoleWithPermissions[]>({
    queryKey: ['permissions', 'roles'],
    queryFn: () => api.get('/permissions/roles'),
    retry: 1,
  })

  // Buscar modulos do sistema
  const { data: modules } = useQuery<SystemModule[]>({
    queryKey: ['permissions', 'modules'],
    queryFn: () => api.get('/permissions/modules'),
    retry: 1,
  })

  // Mutation para salvar permissoes
  const saveMutation = useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: string; permissions: { modulo: string; acao: string }[] }) =>
      api.put(`/permissions/roles/${roleId}`, { permissions }),
    onSuccess: () => {
      toast.success('Permissoes salvas com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      setIsDirty(false)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar permissoes')
    },
  })

  // Mutation para criar perfil
  const createMutation = useMutation({
    mutationFn: (nome: string) => api.post('/permissions/roles', { nome }),
    onSuccess: (data: RoleWithPermissions) => {
      toast.success('Perfil criado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setCreateModalOpen(false)
      setNewRoleName('')
      // Selecionar o novo perfil automaticamente
      selectRole(data)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar perfil')
    },
  })

  // Mutation para excluir perfil
  const deleteMutation = useMutation({
    mutationFn: (roleId: string) => api.delete(`/permissions/roles/${roleId}`),
    onSuccess: () => {
      toast.success('Perfil excluido com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setDeleteConfirmId(null)
      if (selectedRoleId === deleteConfirmId) {
        setSelectedRoleId(null)
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir perfil')
      setDeleteConfirmId(null)
    },
  })

  function selectRole(role: RoleWithPermissions) {
    if (role.nome === 'gerente_geral') return
    setSelectedRoleId(role.id)
    setIsDirty(false)

    // Converter permissoes para o estado editavel
    const perms: Record<string, Set<string>> = {}
    for (const p of role.rolePermissions) {
      if (!perms[p.modulo]) perms[p.modulo] = new Set()
      perms[p.modulo].add(p.acao)
    }
    setEditingPermissions(perms)

    // Expandir todos os modulos
    if (modules) {
      setExpandedModules(new Set(modules.map((m) => m.key)))
    }
  }

  function toggleAction(modulo: string, acao: string) {
    setEditingPermissions((prev) => {
      const next = { ...prev }
      if (!next[modulo]) next[modulo] = new Set()
      else next[modulo] = new Set(next[modulo])

      if (next[modulo].has(acao)) {
        next[modulo].delete(acao)
        if (next[modulo].size === 0) delete next[modulo]
      } else {
        next[modulo].add(acao)
      }
      return next
    })
    setIsDirty(true)
  }

  function toggleModule(modulo: string, actions: readonly string[]) {
    setEditingPermissions((prev) => {
      const next = { ...prev }
      const currentSet = next[modulo] || new Set()
      const allChecked = actions.every((a) => currentSet.has(a))

      if (allChecked) {
        delete next[modulo]
      } else {
        next[modulo] = new Set(actions)
      }
      return next
    })
    setIsDirty(true)
  }

  function toggleExpand(modulo: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(modulo)) next.delete(modulo)
      else next.add(modulo)
      return next
    })
  }

  function handleSave() {
    if (!selectedRoleId) return
    const permissions: { modulo: string; acao: string }[] = []
    for (const [modulo, acoes] of Object.entries(editingPermissions)) {
      for (const acao of acoes) {
        permissions.push({ modulo, acao })
      }
    }
    saveMutation.mutate({ roleId: selectedRoleId, permissions })
  }

  function selectAllModules() {
    if (!modules) return
    const perms: Record<string, Set<string>> = {}
    for (const mod of modules) {
      perms[mod.key] = new Set(mod.actions)
    }
    setEditingPermissions(perms)
    setIsDirty(true)
  }

  function clearAllModules() {
    setEditingPermissions({})
    setIsDirty(true)
  }

  const selectedRole = roles?.find((r) => r.id === selectedRoleId)
  const selectedRoleIndex = roles?.findIndex((r) => r.id === selectedRoleId) ?? 0
  const selectedRoleVisual = selectedRole ? getRoleVisual(selectedRole.nome, selectedRoleIndex) : null
  const deleteConfirmRole = roles?.find((r) => r.id === deleteConfirmId)

  function getPermissionCount(role: RoleWithPermissions): number {
    return role.rolePermissions.length
  }

  function getTotalActions(): number {
    if (!modules) return 0
    return modules.reduce((sum, m) => sum + m.actions.length, 0)
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-warm-sm">
          <KeyRound className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Perfis e Permissoes</h1>
          <p className="text-xs sm:text-sm text-muted-foreground/50">Defina quais modulos e funcoes cada perfil pode acessar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Lista de Perfis */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-border bg-card shadow-warm-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Perfis do Sistema</h2>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">Selecione um perfil para configurar</p>
              </div>
              <Button
                size="sm"
                onClick={() => setCreateModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 px-2.5"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo
              </Button>
            </div>

            {rolesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
              </div>
            ) : rolesError ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-destructive font-medium">Erro ao carregar perfis</p>
                <p className="text-[11px] text-muted-foreground/50 mt-1">Verifique se o servidor foi reiniciado apos a atualizacao.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {roles?.map((role, idx) => {
                  const visual = getRoleVisual(role.nome, idx)
                  const Icon = visual.icon
                  const isSelected = selectedRoleId === role.id
                  const isGerenteGeral = role.nome === 'gerente_geral'
                  const permCount = getPermissionCount(role)
                  const totalActions = getTotalActions()

                  return (
                    <div
                      key={role.id}
                      className={`relative group flex items-center transition-all ${
                        isSelected
                          ? 'bg-primary/5 border-l-2 border-l-primary'
                          : isGerenteGeral
                            ? 'opacity-60 border-l-2 border-l-transparent'
                            : 'hover:bg-muted/30 border-l-2 border-l-transparent'
                      }`}
                    >
                      <button
                        onClick={() => selectRole(role)}
                        disabled={isGerenteGeral}
                        className={`flex-1 text-left px-4 py-3.5 ${isGerenteGeral ? 'cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${visual.color} shrink-0`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate">{formatRoleName(role.nome)}</p>
                              {isGerenteGeral && (
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                  Acesso Total
                                </Badge>
                              )}
                            </div>
                            {!isGerenteGeral && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <div className="h-1.5 flex-1 rounded-full bg-muted/50 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary/60 transition-all"
                                    style={{ width: `${totalActions > 0 ? (permCount / totalActions) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground/40 tabular-nums whitespace-nowrap">
                                  {permCount}/{totalActions}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Botao excluir - aparece no hover, exceto gerente_geral */}
                      {!isGerenteGeral && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(role.id) }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                          title="Excluir perfil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Editor de Permissoes */}
        <div className="lg:col-span-8">
          {!selectedRoleId ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 flex flex-col items-center justify-center py-20">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground/40 font-medium">Selecione um perfil para configurar as permissoes</p>
              <p className="text-[11px] text-muted-foreground/30 mt-1">Clique em um dos perfis ao lado</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card shadow-warm-sm overflow-hidden">
              {/* Header do editor */}
              <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  {selectedRoleVisual && (
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${selectedRoleVisual.color}`}>
                      <selectedRoleVisual.icon className="h-3.5 w-3.5" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-sm font-semibold">{selectedRole ? formatRoleName(selectedRole.nome) : ''}</h2>
                    <p className="text-[10px] text-muted-foreground/50">
                      {Object.values(editingPermissions).reduce((sum, s) => sum + s.size, 0)} permissoes selecionadas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllModules}
                    className="text-xs h-7 px-2"
                  >
                    <Check className="h-3 w-3 mr-1" /> Marcar Todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllModules}
                    className="text-xs h-7 px-2"
                  >
                    <X className="h-3 w-3 mr-1" /> Limpar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!isDirty || saveMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-7 px-3"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Salvar
                  </Button>
                </div>
              </div>

              {/* Lista de modulos */}
              <div className="divide-y divide-border/30 max-h-[calc(100vh-280px)] overflow-y-auto">
                {modules?.map((mod) => {
                  const modulePerms = editingPermissions[mod.key] || new Set()
                  const allChecked = mod.actions.every((a) => modulePerms.has(a))
                  const someChecked = mod.actions.some((a) => modulePerms.has(a))
                  const isExpanded = expandedModules.has(mod.key)

                  return (
                    <div key={mod.key}>
                      {/* Modulo header */}
                      <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                        <button
                          onClick={() => toggleExpand(mod.key)}
                          className="p-0.5 rounded hover:bg-muted/40 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </button>

                        <label className="flex items-center gap-2.5 flex-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => {
                              if (el) el.indeterminate = someChecked && !allChecked
                            }}
                            onChange={() => toggleModule(mod.key, mod.actions)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30 cursor-pointer"
                          />
                          <span className="text-sm font-semibold">{mod.label}</span>
                          <span className="text-[10px] text-muted-foreground/40">
                            {modulePerms.size}/{mod.actions.length}
                          </span>
                        </label>

                        {someChecked && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                            {allChecked ? 'Acesso Total' : 'Parcial'}
                          </Badge>
                        )}
                      </div>

                      {/* Acoes do modulo */}
                      {isExpanded && (
                        <div className="pl-12 pr-4 pb-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                          {mod.actions.map((acao) => {
                            const isChecked = modulePerms.has(acao)
                            return (
                              <label
                                key={acao}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer select-none transition-colors text-xs ${
                                  isChecked
                                    ? 'bg-primary/5 text-foreground'
                                    : 'hover:bg-muted/30 text-muted-foreground/60'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleAction(mod.key, acao)}
                                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary/30 cursor-pointer"
                                />
                                <span className="font-medium">{ACTION_LABELS[acao] || acao}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Criar Perfil */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Perfil</DialogTitle>
            <DialogDescription>
              Crie um novo perfil de acesso para o sistema.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (newRoleName.trim()) createMutation.mutate(newRoleName.trim())
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome do Perfil <span className="text-destructive">*</span></label>
              <input
                type="text"
                required
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
                placeholder="Ex: Caixa, Atendente, Gerente Regional..."
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground/50">
                O nome sera normalizado automaticamente (ex: &quot;Gerente Regional&quot; → gerente_regional)
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setCreateModalOpen(false); setNewRoleName('') }}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={!newRoleName.trim() || createMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Perfil
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusao */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Perfil</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o perfil <strong>{deleteConfirmRole ? formatRoleName(deleteConfirmRole.nome) : ''}</strong>?
              Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
