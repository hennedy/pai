'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { SmartEmptyState } from '@/components/ui/smart-empty-state'
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
  ClipboardList,
  Plus,
  Minus,
  PackagePlus,
  Sun,
  Sunset,
  Loader2,
  Calendar,
  User,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Eye,
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  Clock,
  Hash,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Config
// ============================================================

const TURNO_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; activeBg: string; activeBorder: string }> = {
  manha: {
    label: 'Manha',
    icon: Sun,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    activeBg: 'bg-amber-50 dark:bg-amber-900/30',
    activeBorder: 'border-amber-400 dark:border-amber-600',
  },
  tarde: {
    label: 'Tarde',
    icon: Sunset,
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    activeBg: 'bg-orange-50 dark:bg-orange-900/30',
    activeBorder: 'border-orange-400 dark:border-orange-600',
  },
}

const TIPO_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; border: string; bg: string }> = {
  contagem: { label: 'Contagem', icon: ClipboardList, color: 'text-blue-600', border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  reposicao: { label: 'Reposicao', icon: PackagePlus, color: 'text-emerald-600', border: 'border-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatRelativeDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min atras`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h atras`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d atras`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ============================================================
// Component
// ============================================================

export default function UtensiliosPage() {
  const { selectedUnitId, hasPermission } = useAuthStore()
  const queryClient = useQueryClient()

  const canVisualizar = hasPermission('utensilios', 'visualizar')
  const canContagem = hasPermission('utensilios', 'contagem')
  const canReposicao = hasPermission('utensilios', 'reposicao')

  // Filters
  const [filterTipo, setFilterTipo] = useState<string | null>(null)
  const [filterTurno, setFilterTurno] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTipo, setModalTipo] = useState<'contagem' | 'reposicao'>('contagem')
  const [modalTurno, setModalTurno] = useState<string>('manha')
  const [modalObs, setModalObs] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  // Detail modal
  const [detailId, setDetailId] = useState<string | null>(null)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Fetch products (utensilios)
  const { data: productsData } = useQuery({
    queryKey: ['utensil-products'],
    queryFn: () => api.get('/utensil-counts/products'),
  })
  const products: any[] = productsData?.data || []

  // Fetch counts
  const { data: countsData, isLoading } = useQuery({
    queryKey: ['utensil-counts', page, filterTipo, filterTurno, selectedUnitId],
    queryFn: () => api.get('/utensil-counts', {
      page,
      limit: 15,
      ...(filterTipo ? { tipo: filterTipo } : {}),
      ...(filterTurno ? { turno: filterTurno } : {}),
    }),
    enabled: canVisualizar,
  })
  const counts: any[] = countsData?.data || []
  const pagination = countsData?.pagination

  // Fetch summary
  const { data: summaryData } = useQuery({
    queryKey: ['utensil-counts-summary', selectedUnitId],
    queryFn: () => api.get('/utensil-counts/summary'),
  })

  // Fetch detail
  const { data: detailData } = useQuery({
    queryKey: ['utensil-count-detail', detailId],
    queryFn: () => api.get(`/utensil-counts/${detailId}`),
    enabled: !!detailId,
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/utensil-counts', data),
    onSuccess: () => {
      toast.success(modalTipo === 'contagem' ? 'Contagem registrada com sucesso!' : 'Reposicao registrada com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['utensil-counts'] })
      queryClient.invalidateQueries({ queryKey: ['utensil-counts-summary'] })
      setModalOpen(false)
      resetModal()
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao salvar'),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/utensil-counts/${id}`),
    onSuccess: () => {
      toast.success('Registro excluido')
      queryClient.invalidateQueries({ queryKey: ['utensil-counts'] })
      queryClient.invalidateQueries({ queryKey: ['utensil-counts-summary'] })
      setDeleteId(null)
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao excluir'),
  })

  function resetModal() {
    setModalTurno('manha')
    setModalObs('')
    setQuantities({})
  }

  function openModal(tipo: 'contagem' | 'reposicao') {
    setModalTipo(tipo)
    resetModal()
    setModalOpen(true)
  }

  function handleQuantityChange(productId: string, delta: number) {
    setQuantities(prev => {
      const current = prev[productId] || 0
      const next = Math.max(0, current + delta)
      return { ...prev, [productId]: next }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantidade]) => ({ productId, quantidade }))

    if (items.length === 0) {
      toast.error('Informe a quantidade de pelo menos um item')
      return
    }

    createMutation.mutate({
      turno: modalTurno,
      tipo: modalTipo,
      observacao: modalObs || undefined,
      items,
    })
  }

  function toggleExpanded(id: string) {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Summary cards data
  const summary = summaryData
  const ultimaContagem = summary?.ultimaContagem
  const contagemAnterior = summary?.contagemAnterior
  const reposicoesUltimoMes = summary?.reposicoesUltimoMes || []

  // Compute diff between last two counts
  const countDiffs = useMemo(() => {
    if (!ultimaContagem || !contagemAnterior) return null
    const prevMap = new Map<string, number>()
    for (const item of contagemAnterior.items || []) {
      prevMap.set(item.productId, item.quantidade)
    }
    return (ultimaContagem.items || []).map((item: any) => {
      const prev = prevMap.get(item.productId) || 0
      return {
        productId: item.productId,
        nome: item.product?.nome || 'Produto',
        atual: item.quantidade,
        anterior: prev,
        diff: item.quantidade - prev,
      }
    })
  }, [ultimaContagem, contagemAnterior])

  const totalReposto = reposicoesUltimoMes.reduce((acc: number, r: any) => acc + r.totalReposto, 0)

  // Active filter count
  const activeFilters = (filterTipo ? 1 : 0) + (filterTurno ? 1 : 0)

  // Items filled count for modal
  const filledCount = Object.values(quantities).filter(q => q > 0).length
  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header with prominent action buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          icon={ClipboardList}
          iconGradient="from-warm-500 to-warm-700"
          title="Contagem de Utensilios"
          description="Controle periodico de contagem e reposicao"
        />
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {canReposicao && (
            <Button
              onClick={() => openModal('reposicao')}
              variant="outline"
              size="lg"
              className="flex-1 sm:flex-none gap-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:border-emerald-400 dark:hover:border-emerald-600 shadow-sm"
            >
              <PackagePlus className="h-4 w-4" />
              Reposicao
            </Button>
          )}
          {canContagem && (
            <Button
              onClick={() => openModal('contagem')}
              size="lg"
              className="flex-1 sm:flex-none gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/25"
            >
              <ClipboardList className="h-4 w-4" />
              Nova Contagem
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {(canVisualizar || canReposicao) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Ultima contagem */}
          {canVisualizar && (
            <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-warm-sm hover:shadow-warm transition-shadow">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">Ultima contagem</p>
                </div>
                {ultimaContagem && (
                  <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                    <Calendar className="h-2.5 w-2.5" />
                    {formatRelativeDate(ultimaContagem.createdAt)}
                  </Badge>
                )}
              </div>
              {ultimaContagem ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {(() => { const T = TURNO_CONFIG[ultimaContagem.turno]; return T ? <T.icon className={cn('h-4 w-4', T.color)} /> : null })()}
                    <span className="text-sm font-semibold">{TURNO_CONFIG[ultimaContagem.turno]?.label}</span>
                    <span className="text-xs text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground/50 font-medium">{ultimaContagem.items?.length || 0} itens</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
                    <User className="h-3 w-3" />
                    {ultimaContagem.responsavel?.nome}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/40 font-medium">Nenhuma contagem ainda</p>
              )}
            </div>
          )}

          {/* Variacao */}
          {canVisualizar && (
            <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-warm-sm hover:shadow-warm transition-shadow">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                  <ArrowUpDown className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">Variacao vs anterior</p>
              </div>
              {countDiffs ? (
                <div className="space-y-1.5">
                  {countDiffs.slice(0, 4).map((d: any) => (
                    <div key={d.productId} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[120px] font-medium">{d.nome}</span>
                      <span className={cn(
                        'font-mono font-bold tabular-nums',
                        d.diff > 0 ? 'text-emerald-600' : d.diff < 0 ? 'text-red-500' : 'text-muted-foreground/40',
                      )}>
                        {d.diff > 0 ? '+' : ''}{d.diff}
                      </span>
                    </div>
                  ))}
                  {countDiffs.length > 4 && (
                    <p className="text-[10px] text-muted-foreground/30 text-center font-medium">+{countDiffs.length - 4} itens</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/40 font-medium">Necessario 2+ contagens</p>
              )}
            </div>
          )}

          {/* Reposicoes ultimo mes */}
          {canReposicao && (
            <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-warm-sm hover:shadow-warm transition-shadow sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                  <RefreshCw className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">Reposicoes (30 dias)</p>
              </div>
              {reposicoesUltimoMes.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="font-display text-2xl font-semibold text-emerald-600 tracking-tight">{totalReposto}</span>
                    <span className="text-xs text-muted-foreground/50 font-medium">itens repostos</span>
                  </div>
                  {reposicoesUltimoMes.slice(0, 3).map((r: any) => (
                    <div key={r.productId} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[140px] font-medium">{r.nome}</span>
                      <span className="font-mono font-bold text-emerald-600 tabular-nums">+{r.totalReposto}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground/40 font-medium">Nenhuma reposicao no periodo</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters + Listing — apenas para quem pode visualizar */}
      {canVisualizar && (
      <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-wider mr-1">Filtros:</span>
        {/* Tipo filter */}
        {Object.entries(TIPO_CONFIG).map(([value, cfg]) => {
          const Icon = cfg.icon
          const active = filterTipo === value
          return (
            <button
              key={value}
              onClick={() => { setFilterTipo(active ? null : value); setPage(1) }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-bold transition-all touch-manipulation',
                active
                  ? `${cfg.border} ${cfg.bg} ${cfg.color} border-2`
                  : 'border-border/50 text-muted-foreground/60 hover:border-border hover:text-foreground',
              )}
            >
              <Icon className="h-3 w-3" />
              {cfg.label}
            </button>
          )
        })}

        <div className="w-px h-5 bg-border/30 mx-1" />

        {/* Turno filter */}
        {Object.entries(TURNO_CONFIG).map(([value, cfg]) => {
          const Icon = cfg.icon
          const active = filterTurno === value
          return (
            <button
              key={value}
              onClick={() => { setFilterTurno(active ? null : value); setPage(1) }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-bold transition-all touch-manipulation',
                active
                  ? `${cfg.bg} ${cfg.color} border-2 ${cfg.activeBorder}`
                  : 'border-border/50 text-muted-foreground/60 hover:border-border hover:text-foreground',
              )}
            >
              <Icon className="h-3 w-3" />
              {cfg.label}
            </button>
          )
        })}

        {activeFilters > 0 && (
          <button
            onClick={() => { setFilterTipo(null); setFilterTurno(null); setPage(1) }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Limpar
          </button>
        )}
      </div>

      {/* Timeline / Card List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/30 bg-card p-4 animate-shimmer" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="h-4 w-48 rounded bg-muted/30 mb-3" />
              <div className="h-3 w-32 rounded bg-muted/20" />
            </div>
          ))}
        </div>
      ) : counts.length === 0 ? (
        <SmartEmptyState
          icon={ClipboardList}
          title="Nenhum registro encontrado"
          description={activeFilters > 0 ? 'Tente remover os filtros para ver todos os registros' : 'Registre a primeira contagem ou reposicao de utensilios'}
          action={activeFilters > 0 ? { label: 'Limpar filtros', onClick: () => { setFilterTipo(null); setFilterTurno(null) } } : { label: 'Nova contagem', onClick: () => openModal('contagem') }}
        />
      ) : (
        <div className="space-y-3">
          {counts.map((count: any) => {
            const tipoConfig = TIPO_CONFIG[count.tipo]
            const turnoConfig = TURNO_CONFIG[count.turno]
            const isExpanded = expandedCards.has(count.id)
            const TipoIcon = tipoConfig?.icon || ClipboardList
            const TurnoIcon = turnoConfig?.icon || Sun
            const totalItems = (count.items || []).reduce((sum: number, i: any) => sum + i.quantidade, 0)

            return (
              <div
                key={count.id}
                className="rounded-2xl border border-border/50 bg-card shadow-warm-sm hover:shadow-warm transition-shadow"
              >
                {/* Card header */}
                <button
                  onClick={() => toggleExpanded(count.id)}
                  className="w-full flex items-center gap-3 p-4 text-left touch-manipulation"
                >
                  <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', tipoConfig?.bg)}>
                    <TipoIcon className={cn('h-4 w-4', tipoConfig?.color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold">{tipoConfig?.label}</span>
                      <Badge variant="outline" className="text-[10px] gap-1 shrink-0 font-semibold">
                        <TurnoIcon className="h-2.5 w-2.5" />
                        {turnoConfig?.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {formatDateTime(count.createdAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="h-2.5 w-2.5" />
                        {count.responsavel?.nome}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-[11px] text-muted-foreground/40 font-medium">{(count.items || []).length} itens</p>
                      <p className="text-sm font-mono font-bold tabular-nums">{totalItems} un.</p>
                    </div>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground/30 transition-transform', isExpanded && 'rotate-180')} />
                  </div>
                </button>

                {/* Card body (expanded) */}
                {isExpanded && (
                  <div className="border-t border-border/30 px-4 py-3 animate-fade-in">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {(count.items || []).map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/30"
                        >
                          <span className="text-xs text-muted-foreground truncate mr-2 font-medium">{item.product?.nome || 'Produto'}</span>
                          <span className={cn(
                            'font-mono text-sm font-bold shrink-0 tabular-nums',
                            count.tipo === 'reposicao' ? 'text-emerald-600' : 'text-foreground',
                          )}>
                            {count.tipo === 'reposicao' && '+'}{item.quantidade}
                          </span>
                        </div>
                      ))}
                    </div>

                    {count.observacao && (
                      <p className="text-xs text-muted-foreground/50 mt-2 italic font-medium">&ldquo;{count.observacao}&rdquo;</p>
                    )}

                    <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-border/20">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(count.id) }}
                      >
                        <Trash2 className="h-3 w-3" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground/40 font-medium">
                {pagination.total} registro{pagination.total !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                </Button>
                <span className="text-xs font-bold px-2 tabular-nums">{page} / {pagination.totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* ============================================================ */}
      {/* Create Count / Replacement Modal */}
      {/* ============================================================ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-full max-w-lg sm:max-w-lg flex flex-col max-h-[90dvh] overflow-hidden p-0">
          {/* Header — fixed */}
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                {modalTipo === 'contagem' ? (
                  <>
                    <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                      <ClipboardList className="h-[18px] w-[18px] text-blue-600" />
                    </div>
                    Nova Contagem
                  </>
                ) : (
                  <>
                    <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                      <PackagePlus className="h-[18px] w-[18px] text-emerald-600" />
                    </div>
                    Nova Reposicao
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {modalTipo === 'contagem'
                  ? 'Registre a contagem de utensilios por turno.'
                  : 'Registre a quantidade de itens repostos (quebrados/substituidos).'}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Scrollable body */}
          <form id="utensil-form" onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 space-y-5 pb-2">
              {/* Turno selector */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Turno <span className="text-destructive">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TURNO_CONFIG).map(([value, cfg]) => {
                    const Icon = cfg.icon
                    const active = modalTurno === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setModalTurno(value)}
                        className={cn(
                          'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all touch-manipulation',
                          active
                            ? `${cfg.activeBg} ${cfg.color} ${cfg.activeBorder} shadow-sm`
                            : 'border-border/50 text-muted-foreground/50 hover:border-border hover:text-muted-foreground',
                        )}
                      >
                        <Icon className={cn('h-4 w-4', active ? '' : 'opacity-50')} />
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">
                    {modalTipo === 'contagem' ? 'Quantidades' : 'Itens repostos'} <span className="text-destructive">*</span>
                  </label>
                  {filledCount > 0 && (
                    <span className="text-[11px] font-semibold text-muted-foreground/50">
                      {filledCount} {filledCount === 1 ? 'item' : 'itens'} · {totalQty} un.
                    </span>
                  )}
                </div>
                {products.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/50 p-6 text-center">
                    <p className="text-xs text-muted-foreground/50 font-medium">Nenhum produto marcado como utensilio.</p>
                    <p className="text-[10px] text-muted-foreground/30 mt-1">Cadastre produtos com a opcao &quot;utensilio&quot; ativada.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {products.map((product: any) => {
                      const qty = quantities[product.id] || 0
                      const isActive = qty > 0
                      const activeRowCls = modalTipo === 'reposicao'
                        ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-900/15 shadow-sm'
                        : 'border-blue-300 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-900/15 shadow-sm'
                      const btnMinusCls = isActive
                        ? modalTipo === 'reposicao'
                          ? 'border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 shadow-sm disabled:opacity-40'
                          : 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 shadow-sm disabled:opacity-40'
                        : 'border-border bg-muted/40 text-muted-foreground/40 disabled:opacity-30'
                      const btnPlusCls = isActive
                        ? modalTipo === 'reposicao'
                          ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-500 dark:bg-emerald-600 text-white hover:bg-emerald-600 dark:hover:bg-emerald-500 shadow-md shadow-emerald-500/25'
                          : 'border-blue-400 dark:border-blue-500 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-500 shadow-md shadow-blue-500/25'
                        : 'border-border bg-muted/40 text-foreground/70 hover:bg-muted hover:border-foreground/20 hover:text-foreground'
                      const inputCls = isActive
                        ? modalTipo === 'reposicao'
                          ? 'border-emerald-300 dark:border-emerald-600 bg-white dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                          : 'border-blue-300 dark:border-blue-600 bg-white dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-border bg-card text-foreground'

                      return (
                        <div
                          key={product.id}
                          className={cn(
                            'flex items-center gap-3 px-3 py-3 rounded-xl border transition-all',
                            isActive ? activeRowCls : 'border-border/30 bg-card',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{product.nome}</p>
                            {product.sku && (
                              <p className="text-[10px] text-muted-foreground/40 font-mono">{product.sku}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(product.id, -1)}
                              disabled={qty === 0}
                              className={cn('h-10 w-10 rounded-xl border-2 flex items-center justify-center transition-all touch-manipulation active:scale-90 disabled:cursor-not-allowed', btnMinusCls)}
                            >
                              <Minus className="h-4 w-4" strokeWidth={2.5} />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={qty}
                              onChange={(e) => setQuantities(prev => ({ ...prev, [product.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                              className={cn('h-10 w-14 rounded-xl border-2 text-center text-base font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all tabular-nums', inputCls)}
                            />
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(product.id, 1)}
                              className={cn('h-10 w-10 rounded-xl border-2 flex items-center justify-center transition-all touch-manipulation active:scale-90', btnPlusCls)}
                            >
                              <Plus className="h-4 w-4" strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Resumo */}
              {filledCount > 0 && (
                <div className="rounded-xl bg-muted/30 px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground/60 font-medium">Total de itens</span>
                  <span className="font-mono font-bold text-foreground tabular-nums">{totalQty} un. em {filledCount} {filledCount === 1 ? 'produto' : 'produtos'}</span>
                </div>
              )}

              {/* Obs */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Observacao <span className="text-muted-foreground/40">(opcional)</span></label>
                <textarea
                  value={modalObs}
                  onChange={(e) => setModalObs(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
                  rows={2}
                  placeholder="Observacoes opcionais..."
                />
              </div>
            </div>

            {/* Footer — fixed at bottom */}
            <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background">
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || products.length === 0}
                  className={cn(
                    'text-white shadow-md',
                    modalTipo === 'reposicao'
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20',
                  )}
                >
                  {createMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{modalTipo === 'contagem' ? 'Salvando...' : 'Salvando...'}</>
                  ) : (
                    modalTipo === 'contagem' ? 'Salvar Contagem' : 'Salvar Reposicao'
                  )}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Delete Confirmation */}
      {/* ============================================================ */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              Excluir registro
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este registro? Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
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
