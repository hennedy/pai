'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Briefcase,
  Plus,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Layers,
  Users,
  TrendingUp,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface FamiliaCargo {
  id: string
  nome: string
  descricao: string | null
  _count: { cargos: number }
}

interface Cargo {
  id: string
  nome: string
  codigo: string | null
  nivel: string
  status: string
  descricao: string | null
  familiaId: string | null
  familia: { id: string; nome: string } | null
  cargaHorariaSemanal: number
  _count: { colaboradores: number; faixas: number }
}

interface EstruturaResponse {
  familias: (FamiliaCargo & { cargos: Cargo[] })[]
  semFamilia: Cargo[]
}

// ============================================================
// Config
// ============================================================

const NIVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  junior:       { label: 'Junior',       color: 'text-sky-600',    bg: 'bg-sky-50 dark:bg-sky-900/20' },
  pleno:        { label: 'Pleno',        color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  senior:       { label: 'Senior',       color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  especialista: { label: 'Especialista', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  coordenador:  { label: 'Coordenador',  color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
  gerente:      { label: 'Gerente',      color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  diretor:      { label: 'Diretor',      color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20' },
}

const NIVEIS = ['junior', 'pleno', 'senior', 'especialista', 'coordenador', 'gerente', 'diretor']

// ============================================================
// Page
// ============================================================

export default function CargosPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const canVisualizar = isFullAccess || isGerenteGeral() || hasPermission('rh_cargos', 'visualizar')
  const canCriar = isFullAccess || isGerenteGeral() || hasPermission('rh_cargos', 'criar')
  const canEditar = isFullAccess || isGerenteGeral() || hasPermission('rh_cargos', 'editar')
  const canExcluir = isFullAccess || isGerenteGeral() || hasPermission('rh_cargos', 'excluir')

  const queryClient = useQueryClient()
  const [expandedFamilias, setExpandedFamilias] = useState<Set<string>>(new Set(['__all__']))

  // Modal states
  const [familiaModal, setFamiliaModal] = useState<{ open: boolean; editing?: FamiliaCargo }>({ open: false })
  const [cargoModal, setCargoModal] = useState<{ open: boolean; editing?: Cargo; familiaId?: string }>({ open: false })
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; tipo: 'familia' | 'cargo'; id: string; nome: string } | null>(null)

  // Form state — família
  const [familiaForm, setFamiliaForm] = useState({ nome: '', descricao: '' })

  // Form state — cargo
  const [cargoForm, setCargoForm] = useState({
    nome: '', codigo: '', nivel: 'pleno', familiaId: '', descricao: '',
    responsabilidades: '', requisitos: '', cargaHorariaSemanal: 44,
  })

  // ============================================================
  // Queries
  // ============================================================

  const { data: estrutura, isLoading } = useQuery<EstruturaResponse>({
    queryKey: ['rh', 'cargos', 'estrutura'],
    queryFn: () => api.get('/rh/cargos/estrutura'),
    enabled: canVisualizar,
  })

  const { data: familias } = useQuery<FamiliaCargo[]>({
    queryKey: ['rh', 'familias'],
    queryFn: () => api.get('/rh/cargos/familias'),
    enabled: canVisualizar,
  })

  // ============================================================
  // Mutations
  // ============================================================

  const createFamiliaMutation = useMutation({
    mutationFn: (data: any) => api.post('/rh/cargos/familias', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh', 'cargos'] })
      toast.success('Familia criada com sucesso')
      setFamiliaModal({ open: false })
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao criar familia'),
  })

  const updateFamiliaMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/rh/cargos/familias/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh', 'cargos'] })
      toast.success('Familia atualizada')
      setFamiliaModal({ open: false })
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar familia'),
  })

  const deleteFamiliaMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/rh/cargos/familias/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh', 'cargos'] })
      toast.success('Familia removida')
      setDeleteModal(null)
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao remover familia'),
  })

  const createCargoMutation = useMutation({
    mutationFn: (data: any) => api.post('/rh/cargos', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh', 'cargos'] })
      toast.success('Cargo criado com sucesso')
      setCargoModal({ open: false })
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao criar cargo'),
  })

  const updateCargoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/rh/cargos/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh', 'cargos'] })
      toast.success('Cargo atualizado')
      setCargoModal({ open: false })
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar cargo'),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/rh/cargos/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh', 'cargos'] })
      toast.success('Status atualizado')
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar status'),
  })

  // ============================================================
  // Handlers
  // ============================================================

  function openCreateFamilia() {
    setFamiliaForm({ nome: '', descricao: '' })
    setFamiliaModal({ open: true })
  }

  function openEditFamilia(f: FamiliaCargo) {
    setFamiliaForm({ nome: f.nome, descricao: f.descricao || '' })
    setFamiliaModal({ open: true, editing: f })
  }

  function submitFamilia(e: React.FormEvent) {
    e.preventDefault()
    const data = { nome: familiaForm.nome, descricao: familiaForm.descricao || undefined }
    if (familiaModal.editing) {
      updateFamiliaMutation.mutate({ id: familiaModal.editing.id, data })
    } else {
      createFamiliaMutation.mutate(data)
    }
  }

  function openCreateCargo(familiaId?: string) {
    setCargoForm({ nome: '', codigo: '', nivel: 'pleno', familiaId: familiaId || '', descricao: '', responsabilidades: '', requisitos: '', cargaHorariaSemanal: 44 })
    setCargoModal({ open: true, familiaId })
  }

  function openEditCargo(c: Cargo) {
    setCargoForm({
      nome: c.nome, codigo: c.codigo || '', nivel: c.nivel,
      familiaId: c.familiaId || '', descricao: c.descricao || '',
      responsabilidades: '', requisitos: '', cargaHorariaSemanal: c.cargaHorariaSemanal,
    })
    setCargoModal({ open: true, editing: c })
  }

  function submitCargo(e: React.FormEvent) {
    e.preventDefault()
    const data: any = {
      nome: cargoForm.nome,
      nivel: cargoForm.nivel,
      cargaHorariaSemanal: cargoForm.cargaHorariaSemanal,
    }
    if (cargoForm.codigo) data.codigo = cargoForm.codigo
    if (cargoForm.familiaId) data.familiaId = cargoForm.familiaId
    if (cargoForm.descricao) data.descricao = cargoForm.descricao
    if (cargoForm.responsabilidades) data.responsabilidades = cargoForm.responsabilidades
    if (cargoForm.requisitos) data.requisitos = cargoForm.requisitos

    if (cargoModal.editing) {
      updateCargoMutation.mutate({ id: cargoModal.editing.id, data })
    } else {
      createCargoMutation.mutate(data)
    }
  }

  function toggleFamilia(id: string) {
    setExpandedFamilias(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ============================================================
  // Render helpers
  // ============================================================

  function NivelBadge({ nivel }: { nivel: string }) {
    const cfg = NIVEL_CONFIG[nivel] || { label: nivel, color: 'text-muted-foreground', bg: 'bg-muted' }
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold', cfg.bg, cfg.color)}>
        {cfg.label}
      </span>
    )
  }

  function CargoRow({ cargo }: { cargo: Cargo }) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/30 bg-card hover:border-border/60 transition-all group">
        <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
          <Briefcase className="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cn('text-sm font-semibold', cargo.status === 'inativo' && 'text-muted-foreground/50 line-through')}>
              {cargo.nome}
            </p>
            <NivelBadge nivel={cargo.nivel} />
            {cargo.codigo && (
              <span className="text-[10px] font-mono text-muted-foreground/40 bg-muted/30 px-1.5 py-0.5 rounded">
                {cargo.codigo}
              </span>
            )}
          </div>
          {cargo.descricao && (
            <p className="text-[11px] text-muted-foreground/40 mt-0.5 truncate">{cargo.descricao}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
            <Users className="h-3 w-3" />
            {cargo._count.colaboradores}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canEditar && (
              <>
                <button
                  onClick={() => toggleStatusMutation.mutate({ id: cargo.id, status: cargo.status === 'ativo' ? 'inativo' : 'ativo' })}
                  className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground transition-all"
                  title={cargo.status === 'ativo' ? 'Inativar' : 'Ativar'}
                >
                  <span className={cn('h-2 w-2 rounded-full', cargo.status === 'ativo' ? 'bg-emerald-400' : 'bg-red-400')} />
                </button>
                <button
                  onClick={() => openEditCargo(cargo)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground transition-all"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {canExcluir && cargo._count.colaboradores === 0 && (
              <button
                onClick={() => setDeleteModal({ open: true, tipo: 'cargo', id: cargo.id, nome: cargo.nome })}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground/40 hover:text-red-500 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // Totais
  // ============================================================
  const totalCargos = (estrutura?.familias.reduce((acc, f) => acc + f.cargos.length, 0) || 0) + (estrutura?.semFamilia.length || 0)
  const totalFamilias = estrutura?.familias.length || 0
  const totalColaboradores = [
    ...(estrutura?.familias.flatMap(f => f.cargos) || []),
    ...(estrutura?.semFamilia || []),
  ].reduce((acc, c) => acc + c._count.colaboradores, 0)

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          icon={Briefcase}
          iconGradient="from-indigo-500 to-indigo-700"
          title="Cargos e Salarios"
          description="Estrutura de cargos, familias e faixas salariais"
        />
        {canCriar && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={openCreateFamilia}
              variant="outline"
              size="lg"
              className="flex-1 sm:flex-none gap-2 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
            >
              <Layers className="h-4 w-4" />
              Nova Familia
            </Button>
            <Button
              onClick={() => openCreateCargo()}
              size="lg"
              className="flex-1 sm:flex-none gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-md shadow-indigo-500/20"
            >
              <Plus className="h-4 w-4" />
              Novo Cargo
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {canVisualizar && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Familias', value: totalFamilias, icon: Layers, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
            { label: 'Cargos', value: totalCargos, icon: Briefcase, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
            { label: 'Colaboradores', value: totalColaboradores, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-border/50 bg-card p-4 shadow-warm-sm">
              <div className="flex items-center gap-2.5 mb-2">
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', card.bg)}>
                  <card.icon className={cn('h-4 w-4', card.color)} />
                </div>
                <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">{card.label}</p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Estrutura de Cargos */}
      {canVisualizar && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
            </div>
          ) : (
            <>
              {/* Famílias com cargos */}
              {estrutura?.familias.map(familia => (
                <div key={familia.id} className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-warm-sm">
                  {/* Header da família */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => toggleFamilia(familia.id)}
                  >
                    <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                      <Layers className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{familia.nome}</p>
                      {familia.descricao && (
                        <p className="text-[11px] text-muted-foreground/40 truncate">{familia.descricao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{familia.cargos.length} cargos</Badge>
                      {canEditar && (
                        <button
                          onClick={e => { e.stopPropagation(); openEditFamilia(familia) }}
                          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted/60 text-muted-foreground/40 hover:text-muted-foreground transition-all"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canExcluir && familia._count.cargos === 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteModal({ open: true, tipo: 'familia', id: familia.id, nome: familia.nome }) }}
                          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground/40 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canCriar && (
                        <button
                          onClick={e => { e.stopPropagation(); openCreateCargo(familia.id) }}
                          className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-muted-foreground/40 hover:text-indigo-500 transition-all"
                          title="Adicionar cargo nesta familia"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {expandedFamilias.has(familia.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </div>
                  </div>

                  {/* Cargos da família */}
                  {expandedFamilias.has(familia.id) && familia.cargos.length > 0 && (
                    <div className="px-4 pb-4 space-y-2">
                      <div className="h-px bg-border/50 mb-3" />
                      {familia.cargos.map(cargo => (
                        <CargoRow key={cargo.id} cargo={cargo} />
                      ))}
                    </div>
                  )}

                  {expandedFamilias.has(familia.id) && familia.cargos.length === 0 && (
                    <div className="px-4 pb-4">
                      <div className="h-px bg-border/50 mb-3" />
                      <p className="text-xs text-muted-foreground/30 text-center py-4">Nenhum cargo nesta familia</p>
                    </div>
                  )}
                </div>
              ))}

              {/* Cargos sem família */}
              {estrutura && estrutura.semFamilia.length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-warm-sm">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => toggleFamilia('__sem_familia__')}
                  >
                    <div className="h-9 w-9 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-muted-foreground/60">Sem familia</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{estrutura.semFamilia.length} cargos</Badge>
                    {expandedFamilias.has('__sem_familia__') ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>

                  {expandedFamilias.has('__sem_familia__') && (
                    <div className="px-4 pb-4 space-y-2">
                      <div className="h-px bg-border/50 mb-3" />
                      {estrutura.semFamilia.map(cargo => (
                        <CargoRow key={cargo.id} cargo={cargo} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {estrutura && estrutura.familias.length === 0 && estrutura.semFamilia.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/50 p-12 text-center">
                  <Briefcase className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground/50">Nenhum cargo cadastrado</p>
                  <p className="text-xs text-muted-foreground/30 mt-1">Crie familias e cargos para estruturar seu quadro</p>
                  {canCriar && (
                    <Button onClick={() => openCreateCargo()} variant="outline" size="sm" className="mt-4 gap-2">
                      <Plus className="h-3.5 w-3.5" />
                      Criar primeiro cargo
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Modal — Familia */}
      {/* ============================================================ */}
      <Dialog open={familiaModal.open} onOpenChange={open => setFamiliaModal({ open })}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                <Layers className="h-[18px] w-[18px] text-indigo-600" />
              </div>
              {familiaModal.editing ? 'Editar Familia' : 'Nova Familia'}
            </DialogTitle>
            <DialogDescription>Agrupe cargos relacionados em uma familia.</DialogDescription>
          </DialogHeader>

          <form onSubmit={submitFamilia} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Nome <span className="text-destructive">*</span></label>
              <input
                value={familiaForm.nome}
                onChange={e => setFamiliaForm(p => ({ ...p, nome: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                placeholder="Ex: Operacao, Gestao, Administrativo..."
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Descricao <span className="text-muted-foreground/40">(opcional)</span></label>
              <textarea
                value={familiaForm.descricao}
                onChange={e => setFamiliaForm(p => ({ ...p, descricao: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
                rows={2}
                placeholder="Descricao da familia de cargos..."
              />
            </div>
            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setFamiliaModal({ open: false })}>Cancelar</Button>
              <Button
                type="submit"
                disabled={createFamiliaMutation.isPending || updateFamiliaMutation.isPending}
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white"
              >
                {(createFamiliaMutation.isPending || updateFamiliaMutation.isPending) ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                ) : familiaModal.editing ? 'Salvar' : 'Criar Familia'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Modal — Cargo */}
      {/* ============================================================ */}
      <Dialog open={cargoModal.open} onOpenChange={open => setCargoModal({ open })}>
        <DialogContent className="w-full max-w-lg flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                  <Briefcase className="h-[18px] w-[18px] text-indigo-600" />
                </div>
                {cargoModal.editing ? 'Editar Cargo' : 'Novo Cargo'}
              </DialogTitle>
              <DialogDescription>Preencha os dados do cargo.</DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={submitCargo} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-semibold">Nome do cargo <span className="text-destructive">*</span></label>
                  <input
                    value={cargoForm.nome}
                    onChange={e => setCargoForm(p => ({ ...p, nome: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="Ex: Padeiro, Atendente, Gerente..."
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Nivel <span className="text-destructive">*</span></label>
                  <select
                    value={cargoForm.nivel}
                    onChange={e => setCargoForm(p => ({ ...p, nivel: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  >
                    {NIVEIS.map(n => (
                      <option key={n} value={n}>{NIVEL_CONFIG[n]?.label || n}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Codigo <span className="text-muted-foreground/40 text-xs font-normal">(opcional)</span></label>
                  <input
                    value={cargoForm.codigo}
                    onChange={e => setCargoForm(p => ({ ...p, codigo: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="PAD-001"
                    maxLength={20}
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-semibold">Familia <span className="text-muted-foreground/40 text-xs font-normal">(opcional)</span></label>
                  <select
                    value={cargoForm.familiaId}
                    onChange={e => setCargoForm(p => ({ ...p, familiaId: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  >
                    <option value="">Sem familia</option>
                    {familias?.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-semibold">Carga horaria semanal <span className="text-destructive">*</span></label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={cargoForm.cargaHorariaSemanal}
                      onChange={e => setCargoForm(p => ({ ...p, cargaHorariaSemanal: parseInt(e.target.value) || 44 }))}
                      className="w-24 px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    />
                    <span className="text-sm text-muted-foreground/50">horas / semana</span>
                  </div>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Descricao <span className="text-muted-foreground/40">(opcional)</span></label>
                  <textarea
                    value={cargoForm.descricao}
                    onChange={e => setCargoForm(p => ({ ...p, descricao: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
                    rows={2}
                    placeholder="Breve descricao do cargo..."
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background">
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setCargoModal({ open: false })}>Cancelar</Button>
                <Button
                  type="submit"
                  disabled={createCargoMutation.isPending || updateCargoMutation.isPending}
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white"
                >
                  {(createCargoMutation.isPending || updateCargoMutation.isPending) ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                  ) : cargoModal.editing ? 'Salvar Alteracoes' : 'Criar Cargo'}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Modal — Confirmacao de exclusao */}
      {/* ============================================================ */}
      <Dialog open={!!deleteModal?.open} onOpenChange={() => setDeleteModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              Confirmar exclusao
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir {deleteModal?.tipo === 'familia' ? 'a familia' : 'o cargo'} <strong>{deleteModal?.nome}</strong>? Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteModal(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteFamiliaMutation.isPending}
              onClick={() => {
                if (!deleteModal) return
                if (deleteModal.tipo === 'familia') deleteFamiliaMutation.mutate(deleteModal.id)
              }}
            >
              {deleteFamiliaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
