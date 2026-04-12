'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, Loader2, ClipboardList,
  ArrowLeft, Pause, Play, AlertCircle, CheckSquare,
  Clock, Calendar, RotateCcw, Building2, Tag,
  List, ChevronDown, Search, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Template {
  id: string
  nome: string
  status: 'ativo' | 'inativo'
  horario: string
  obrigatorio: boolean
  tempoLimiteMinutos: number | null
  recorrencia: any
  createdAt: string
  unit: { id: string; codigo: string; nome: string } | null
  sector: { id: string; nome: string } | null
  atribuidoA: { id: string; nome: string } | null
  items: any[]
  _count: { executions: number }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const horarioLabels: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  abertura: 'Abertura',
  fechamento: 'Fechamento',
}

const horarioColors: Record<string, string> = {
  manha:      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  tarde:      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  noite:      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  abertura:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  fechamento: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',
}

function recorrenciaLabel(r: any): string {
  if (!r) return 'Manual'
  const labels: Record<string, string> = {
    diario:          'Diário',
    semanal:         'Semanal',
    mensal:          'Mensal',
    anual:           'Anual',
    data_especifica: 'Datas fixas',
  }
  return labels[r.tipo] || r.tipo
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChecklistTemplatesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [page, setPage] = useState(1)
  const limit = 20

  // Delete modal
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteNome, setDeleteNome] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['checklist-templates', page, search, statusFilter],
    queryFn: () =>
      api.get('/checklist/templates', {
        page,
        limit,
        status: statusFilter,
        search: search || undefined,
      }),
  })

  const templates: Template[] = data?.data || []
  const pagination = data?.pagination

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ativo' | 'inativo' }) =>
      api.patch(`/checklist/templates/${id}/status`, { status }),
    onSuccess: (_, vars) => {
      toast.success(vars.status === 'ativo' ? 'Checklist ativado' : 'Checklist pausado')
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] })
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao alterar status'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/checklist/templates/${id}`),
    onSuccess: () => {
      toast.success('Checklist excluído com sucesso')
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] })
      setDeleteId(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao excluir checklist')
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] })
      setDeleteId(null)
    },
  })

  function confirmDelete(t: Template) {
    setDeleteId(t.id)
    setDeleteNome(t.nome)
  }

  const totalPages = pagination?.totalPages || 1
  const total = pagination?.total || 0

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/checklist')}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-warm-sm">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Checklists Cadastrados</h1>
            <p className="text-xs sm:text-sm text-muted-foreground/50">
              Gerencie, pause ou edite os modelos de checklist
            </p>
          </div>
        </div>
        <Button
          onClick={() => router.push('/checklist/builder')}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Checklist
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar checklist..."
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1) }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground/50" />
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex rounded-xl border border-border/60 overflow-hidden text-sm font-medium">
          {(['todos', 'ativo', 'inativo'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={cn(
                'px-3.5 py-2 transition-colors capitalize',
                statusFilter === s
                  ? 'bg-amber-500 text-white'
                  : 'bg-card text-muted-foreground hover:bg-accent'
              )}
            >
              {s === 'todos' ? 'Todos' : s === 'ativo' ? 'Ativos' : 'Pausados'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {!isLoading && (
        <p className="text-xs text-muted-foreground">
          {total} checklist{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </p>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
          <ClipboardList className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum checklist encontrado</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/checklist/builder')}
          >
            <Plus className="h-4 w-4 mr-1" />
            Criar primeiro checklist
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => router.push(`/checklist/builder?id=${t.id}`)}
              onToggleStatus={() =>
                toggleStatusMutation.mutate({
                  id: t.id,
                  status: t.status === 'ativo' ? 'inativo' : 'ativo',
                })
              }
              onDelete={() => confirmDelete(t)}
              togglingStatus={toggleStatusMutation.isPending && toggleStatusMutation.variables?.id === t.id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Excluir checklist
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir{' '}
              <strong className="text-foreground">"{deleteNome}"</strong>?
              <br />
              <span className="text-xs mt-1 block text-muted-foreground">
                Se houver execuções concluídas, a exclusão será bloqueada. Pause o checklist para desativá-lo sem perder o histórico.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleteMutation.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template: t,
  onEdit,
  onToggleStatus,
  onDelete,
  togglingStatus,
}: {
  template: Template
  onEdit: () => void
  onToggleStatus: () => void
  onDelete: () => void
  togglingStatus: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const isAtivo = t.status === 'ativo'

  return (
    <div className={cn(
      'rounded-2xl border bg-card transition-all duration-200',
      isAtivo ? 'border-border/50' : 'border-border/30 opacity-70'
    )}>
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        {/* Status indicator */}
        <div className={cn(
          'mt-0.5 h-2.5 w-2.5 rounded-full shrink-0',
          isAtivo ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-400'
        )} />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-semibold text-sm leading-snug">{t.nome}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {/* Horário */}
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
                  horarioColors[t.horario]
                )}>
                  <Clock className="h-3 w-3" />
                  {horarioLabels[t.horario] || t.horario}
                </span>

                {/* Recorrência */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  <RotateCcw className="h-3 w-3" />
                  {recorrenciaLabel(t.recorrencia)}
                </span>

                {/* Obrigatório */}
                {t.obrigatorio && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    Obrigatório
                  </span>
                )}

              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Pause / Activate */}
              <button
                onClick={onToggleStatus}
                disabled={togglingStatus}
                title={isAtivo ? 'Pausar checklist' : 'Ativar checklist'}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  isAtivo
                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40'
                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40'
                )}
              >
                {togglingStatus
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : isAtivo
                    ? <Pause className="h-3.5 w-3.5" />
                    : <Play className="h-3.5 w-3.5" />
                }
                {isAtivo ? 'Pausar' : 'Ativar'}
              </button>

              {/* Edit */}
              <button
                onClick={onEdit}
                title="Editar checklist"
                className="p-1.5 rounded-lg hover:bg-accent transition-colors"
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Delete */}
              <button
                onClick={onDelete}
                title="Excluir checklist"
                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-4 w-4 text-destructive/60" />
              </button>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-muted-foreground">
            {t.unit && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {t.unit.codigo}
              </span>
            )}
            {t.sector && (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {t.sector.nome}
              </span>
            )}
            {t.atribuidoA && (
              <span className="flex items-center gap-1">
                <CheckSquare className="h-3 w-3" />
                {t.atribuidoA.nome}
              </span>
            )}
            {t.tempoLimiteMinutos && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t.tempoLimiteMinutos}min
              </span>
            )}
            <span className="flex items-center gap-1">
              <List className="h-3 w-3" />
              {t.items.length} {t.items.length === 1 ? 'item' : 'itens'}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {t._count.executions} execuç{t._count.executions === 1 ? 'ão' : 'ões'}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable items list */}
      {t.items.length > 0 && (
        <>
          <div className="border-t border-border/40 mx-4" />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="font-medium">Ver {t.items.length} {t.items.length === 1 ? 'item' : 'itens'}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-180')} />
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-1.5">
              {t.items.map((item: any, idx: number) => (
                <div key={item.id} className="flex items-start gap-2.5 text-xs">
                  <span className="text-muted-foreground/50 font-mono w-4 shrink-0 text-right">{idx + 1}.</span>
                  <span className={cn('flex-1', item.isCritico && 'text-red-600 dark:text-red-400 font-medium')}>
                    {item.descricao}
                    {item.isCritico && <span className="ml-1 text-[10px] opacity-70">⚠ crítico</span>}
                    {item.obrigatorio && <span className="text-destructive ml-0.5">*</span>}
                  </span>
                  <span className="text-muted-foreground/50 capitalize shrink-0">{item.tipo}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
