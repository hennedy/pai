'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tag,
  Printer,
  Eye,
  Plus,
  Minus,
  Search,
  Calendar,
  User,
  Hash,
  Clock,
  ChevronRight,
  ChevronDown,
  Loader2,
  Package,
  ChefHat,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  StickyNote,
  QrCode,
  Copy,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// Types
// ============================================

interface LabelItem {
  id: string
  descricao: string
  lote: string
  dataProducao: string
  dataValidade: string
  responsavel: { nome: string }
  quantidade: number
  receitaId?: string
  productId?: string
  recipe?: { nome: string }
  product?: { nome: string; validadeDias?: number | null }
  unit?: { nome: string; codigo: string; endereco?: string | null }
  createdAt: string
}

interface Recipe {
  id: string
  nome: string
  validadeDias?: number
}

interface Product {
  id: string
  nome: string
  validadeDias?: number | null
}

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function formatDateFull(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTimeFull(dateStr: string) {
  const d = new Date(dateStr)
  return (
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' - ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  )
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return (
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
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

// ============================================
// Print Label Component (60mm x 60mm)
// Modelo: Suflex-style thermal label
// ============================================

function PrintLabel({ label }: { label: LabelItem }) {
  return (
    <div
      id="label-print-area"
      style={{
        width: '60mm',
        height: '60mm',
        padding: '2mm',
        boxSizing: 'border-box',
        fontFamily: "'Arial Narrow', Arial, Helvetica, sans-serif",
        fontSize: '7.5pt',
        lineHeight: '1.3',
        color: '#000',
        background: '#fff',
        display: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Product name */}
      <div style={{ fontSize: '11pt', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1.5px solid #000', paddingBottom: '1mm', marginBottom: '1mm', letterSpacing: '0.02em' }}>
        {label.descricao}
      </div>

      {/* Manipulation datetime */}
      <div style={{ marginBottom: '0.5mm' }}>
        <span style={{ fontWeight: 700 }}>MANIPULACAO:</span>{' '}
        {formatDateTimeFull(label.dataProducao)}
      </div>

      {/* Validity date */}
      <div style={{ marginBottom: '0.5mm' }}>
        <span style={{ fontWeight: 700 }}>VALIDADE:</span>{' '}
        {label.dataValidade ? formatDateTimeFull(label.dataValidade) : '---'}
      </div>

      {/* Separator */}
      <div style={{ borderBottom: '0.5px solid #000', margin: '1mm 0' }} />

      {/* Responsible */}
      <div style={{ marginBottom: '0.5mm' }}>
        <span style={{ fontWeight: 700 }}>RESP.:</span>{' '}
        {label.responsavel?.nome?.toUpperCase() || '---'}
      </div>

      {/* Unit info */}
      {label.unit && (
        <>
          <div style={{ marginBottom: '0.5mm', fontWeight: 700 }}>
            {label.unit.nome?.toUpperCase()}
          </div>
          {label.unit.endereco && (
            <div style={{ marginBottom: '0.5mm', fontSize: '6.5pt' }}>
              {label.unit.endereco.toUpperCase()}
            </div>
          )}
        </>
      )}

      {/* Separator */}
      <div style={{ borderBottom: '0.5px solid #000', margin: '1mm 0' }} />

      {/* Label ID (lote) */}
      <div style={{ fontSize: '8pt', fontWeight: 700, letterSpacing: '0.03em' }}>
        #{label.lote}
      </div>
    </div>
  )
}

function handlePrint() {
  // Force the hidden print area to show, then trigger print
  const el = document.getElementById('label-print-area')
  if (el) {
    el.style.display = 'block'
    setTimeout(() => {
      window.print()
      // After print dialog closes, hide it again
      setTimeout(() => { el.style.display = 'none' }, 500)
    }, 100)
  }
}

function getValidadeStatus(dataValidade: string): 'valida' | 'proxima' | 'vencida' {
  if (!dataValidade) return 'valida'
  const now = new Date()
  const val = new Date(dataValidade)
  const diffDays = Math.floor((val.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'vencida'
  if (diffDays <= 2) return 'proxima'
  return 'valida'
}

const STATUS_CONFIG = {
  valida: {
    label: 'Valida',
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  },
  proxima: {
    label: 'Proxima ao venc.',
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
  vencida: {
    label: 'Vencida',
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  },
}

// ============================================
// Component
// ============================================

export default function EtiquetasPage() {
  const selectedUnitId = useAuthStore((s) => s.selectedUnitId)
  const queryClient = useQueryClient()

  // Form state
  const [modalOpen, setModalOpen] = useState(false)
  const [tipoItem, setTipoItem] = useState<'receita' | 'produto'>('receita')
  const [itemId, setItemId] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataProducao, setDataProducao] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [dataValidade, setDataValidade] = useState('')

  // History state
  const [histPage, setHistPage] = useState(1)
  const [histSearch, setHistSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const limit = 15

  // Detail modal
  const [selectedLabel, setSelectedLabel] = useState<LabelItem | null>(null)

  // Expanded cards
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  // ------------------------------------------
  // Queries
  // ------------------------------------------

  const histQuery = useQuery({
    queryKey: ['labels', selectedUnitId, histPage, histSearch],
    queryFn: () =>
      api.get('/labels', {
        unitId: selectedUnitId!,
        page: histPage,
        limit,
        search: histSearch || undefined,
      }),
    enabled: !!selectedUnitId,
  })

  const receitasQuery = useQuery({
    queryKey: ['recipes-list'],
    queryFn: () => api.get('/recipes', { limit: 100 }),
  })

  const productsQuery = useQuery({
    queryKey: ['products-list-etiqueta'],
    queryFn: () => api.get('/products', { limit: 100, isEtiqueta: true }),
  })

  const receitasList: Recipe[] = receitasQuery.data?.data || []
  const productsList: Product[] = productsQuery.data?.data || []

  // ------------------------------------------
  // Computed
  // ------------------------------------------

  const labels: LabelItem[] = histQuery.data?.data || []
  const pagination = histQuery.data

  const filteredLabels = useMemo(() => {
    if (!filterStatus) return labels
    return labels.filter((l) => {
      const status = getValidadeStatus(l.dataValidade)
      return status === filterStatus
    })
  }, [labels, filterStatus])

  // Summary stats
  const stats = useMemo(() => {
    const total = labels.length
    const validas = labels.filter((l) => getValidadeStatus(l.dataValidade) === 'valida').length
    const proximas = labels.filter((l) => getValidadeStatus(l.dataValidade) === 'proxima').length
    const vencidas = labels.filter((l) => getValidadeStatus(l.dataValidade) === 'vencida').length
    const totalQty = labels.reduce((acc, l) => acc + l.quantidade, 0)
    return { total, validas, proximas, vencidas, totalQty }
  }, [labels])

  // Selected item for preview
  const selectedItem = useMemo(() => {
    if (!itemId) return null
    const list = tipoItem === 'receita' ? receitasList : productsList
    return list.find((i) => i.id === itemId) || null
  }, [itemId, tipoItem, receitasList, productsList])

  // ------------------------------------------
  // Auto-calc validity
  // ------------------------------------------

  function calcularValidade(itemIdVal: string, dataProducaoVal: string) {
    if (!itemIdVal || !dataProducaoVal) {
      setDataValidade('')
      return
    }
    const list = tipoItem === 'receita' ? receitasList : productsList
    const item = list.find((i) => i.id === itemIdVal)
    const validadeDias = item?.validadeDias
    if (validadeDias && validadeDias > 0) {
      const dtProd = new Date(dataProducaoVal)
      // Dia da producao conta como dia 1, entao soma (validadeDias - 1)
      dtProd.setDate(dtProd.getDate() + validadeDias - 1)
      const yyyy = dtProd.getFullYear()
      const mm = String(dtProd.getMonth() + 1).padStart(2, '0')
      const dd = String(dtProd.getDate()).padStart(2, '0')
      setDataValidade(`${yyyy}-${mm}-${dd}`)
    } else {
      setDataValidade('')
    }
  }

  // ------------------------------------------
  // Mutations
  // ------------------------------------------

  const gerarMutation = useMutation({
    mutationFn: (payload: any) => api.post('/labels', payload),
    onSuccess: () => {
      toast.success('Etiqueta gerada com sucesso!')
      resetForm()
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['labels'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao gerar etiqueta')
    },
  })

  function resetForm() {
    setItemId('')
    setDescricao('')
    setDataProducao('')
    setQuantidade(1)
    setDataValidade('')
    setTipoItem('receita')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUnitId) {
      toast.error('Selecione uma unidade')
      return
    }

    const payload: any = {
      unitId: selectedUnitId,
      descricao,
      dataProducao,
      dataValidade: dataValidade || undefined,
      quantidade,
    }

    if (tipoItem === 'receita') {
      payload.receitaId = itemId
    } else {
      payload.productId = itemId
    }

    gerarMutation.mutate(payload)
  }

  // Detail
  async function handleViewLabel(labelId: string) {
    try {
      const data = await api.get(`/labels/${labelId}`)
      setSelectedLabel(data)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar etiqueta')
    }
  }

  function toggleExpanded(id: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Active filters
  const activeFilters = (filterStatus ? 1 : 0)

  // ------------------------------------------
  // Render
  // ------------------------------------------

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          icon={Tag}
          iconGradient="from-rose-500 to-pink-600"
          title="Etiquetas"
          description="Impressao inteligente de etiquetas de producao"
        />
        <Button
          onClick={() => { resetForm(); setModalOpen(true) }}
          size="lg"
          className="w-full sm:w-auto gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/25"
        >
          <Tag className="h-4 w-4" />
          Nova Etiqueta
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total etiquetas */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-warm-sm hover:shadow-warm transition-shadow">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center shrink-0">
              <StickyNote className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">Total geradas</p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold tracking-tight">{stats.totalQty}</span>
            <span className="text-[11px] text-muted-foreground/40 font-medium">etiquetas</span>
          </div>
        </div>

        {/* Validas */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'valida' ? null : 'valida')}
          className={cn(
            'rounded-2xl border p-4 sm:p-5 shadow-warm-sm hover:shadow-warm transition-all text-left',
            filterStatus === 'valida'
              ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10'
              : 'border-border/50 bg-card',
          )}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">Validas</p>
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight text-emerald-600">{stats.validas}</span>
        </button>

        {/* Proximas ao vencimento */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'proxima' ? null : 'proxima')}
          className={cn(
            'rounded-2xl border p-4 sm:p-5 shadow-warm-sm hover:shadow-warm transition-all text-left',
            filterStatus === 'proxima'
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
              : 'border-border/50 bg-card',
          )}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">Proximas</p>
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight text-amber-600">{stats.proximas}</span>
        </button>

        {/* Vencidas */}
        <button
          onClick={() => setFilterStatus(filterStatus === 'vencida' ? null : 'vencida')}
          className={cn(
            'rounded-2xl border p-4 sm:p-5 shadow-warm-sm hover:shadow-warm transition-all text-left',
            filterStatus === 'vencida'
              ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10'
              : 'border-border/50 bg-card',
          )}
        >
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">Vencidas</p>
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight text-red-600">{stats.vencidas}</span>
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary/70 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por descricao, lote..."
            value={histSearch}
            onChange={(e) => { setHistSearch(e.target.value); setHistPage(1) }}
            className="w-full pl-10 pr-4 py-2.5 sm:py-2 rounded-xl border border-border/70 bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all duration-200 shadow-warm-sm hover:border-border placeholder:text-muted-foreground/40 font-medium"
          />
        </div>

        {activeFilters > 0 && (
          <button
            onClick={() => setFilterStatus(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
            Limpar filtro
          </button>
        )}
      </div>

      {/* Label Cards Timeline */}
      {histQuery.isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/30 bg-card p-4 animate-shimmer" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="h-4 w-48 rounded bg-muted/30 mb-3" />
              <div className="h-3 w-32 rounded bg-muted/20" />
            </div>
          ))}
        </div>
      ) : filteredLabels.length === 0 ? (
        <SmartEmptyState
          icon={Tag}
          iconColor="text-rose-500/40"
          iconBg="bg-rose-50 dark:bg-rose-900/20"
          title={activeFilters > 0 ? 'Nenhuma etiqueta com esse status' : 'Nenhuma etiqueta gerada'}
          description={activeFilters > 0 ? 'Tente remover o filtro para ver todas as etiquetas' : 'Clique em "Nova Etiqueta" para gerar a primeira'}
          action={activeFilters > 0
            ? { label: 'Limpar filtro', onClick: () => setFilterStatus(null) }
            : { label: 'Nova Etiqueta', onClick: () => { resetForm(); setModalOpen(true) } }
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredLabels.map((label) => {
            const status = getValidadeStatus(label.dataValidade)
            const statusConfig = STATUS_CONFIG[status]
            const StatusIcon = statusConfig.icon
            const isExpanded = expandedCards.has(label.id)
            const isReceita = !!label.receitaId
            const itemName = isReceita ? label.recipe?.nome : label.product?.nome

            return (
              <div
                key={label.id}
                className={cn(
                  'rounded-2xl border bg-card shadow-warm-sm hover:shadow-warm transition-all',
                  status === 'vencida' ? 'border-red-200/60 dark:border-red-900/40' :
                  status === 'proxima' ? 'border-amber-200/60 dark:border-amber-900/40' :
                  'border-border/50',
                )}
              >
                {/* Card header */}
                <button
                  onClick={() => toggleExpanded(label.id)}
                  className="w-full flex items-center gap-3 p-4 text-left touch-manipulation"
                >
                  {/* Label icon — mimics a sticker/etiqueta shape */}
                  <div className={cn(
                    'relative h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border',
                    statusConfig.bg, statusConfig.border,
                  )}>
                    <Tag className={cn('h-5 w-5', statusConfig.color)} />
                    {/* Corner fold effect */}
                    <div className={cn(
                      'absolute -top-px -right-px h-3 w-3 rounded-bl-lg rounded-tr-xl',
                      status === 'vencida' ? 'bg-red-200 dark:bg-red-800' :
                      status === 'proxima' ? 'bg-amber-200 dark:bg-amber-800' :
                      'bg-emerald-200 dark:bg-emerald-800',
                    )} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-bold truncate">{label.descricao}</span>
                      <Badge variant="outline" className={cn('text-[10px] gap-1 shrink-0 border', statusConfig.badge)}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Hash className="h-2.5 w-2.5" />
                        <span className="font-mono">{label.lote}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {formatDateTime(label.createdAt || label.dataProducao)}
                      </span>
                      <span className="hidden sm:inline-flex items-center gap-1">
                        <User className="h-2.5 w-2.5" />
                        {label.responsavel?.nome}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-[11px] text-muted-foreground/40 font-medium">Quantidade</p>
                      <p className="text-sm font-mono font-bold tabular-nums">{label.quantidade}</p>
                    </div>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground/30 transition-transform', isExpanded && 'rotate-180')} />
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-border/30 px-4 py-4 animate-fade-in space-y-4">
                    {/* Mini thermal label preview */}
                    <div className="flex justify-center">
                      <div
                        className="border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-black dark:text-neutral-100 rounded-sm"
                        style={{
                          width: '190px',
                          padding: '7px',
                          fontFamily: "'Arial Narrow', Arial, Helvetica, sans-serif",
                          fontSize: '8px',
                          lineHeight: '1.35',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid currentColor', paddingBottom: '2px', marginBottom: '2px', letterSpacing: '0.02em', lineHeight: '1.15' }}>
                          {label.descricao}
                        </div>
                        <div style={{ marginBottom: '1px' }}><span style={{ fontWeight: 700 }}>MANIPULACAO:</span> {formatDateTimeFull(label.dataProducao)}</div>
                        <div style={{ marginBottom: '1px' }}><span style={{ fontWeight: 700 }}>VALIDADE:</span> {label.dataValidade ? formatDateTimeFull(label.dataValidade) : '---'}</div>
                        <div style={{ borderBottom: '0.5px solid currentColor', margin: '2px 0' }} />
                        <div style={{ marginBottom: '1px' }}><span style={{ fontWeight: 700 }}>RESP.:</span> {label.responsavel?.nome?.toUpperCase()}</div>
                        {label.unit && <div style={{ fontWeight: 700, marginBottom: '1px' }}>{label.unit.nome?.toUpperCase()}</div>}
                        <div style={{ borderBottom: '0.5px solid currentColor', margin: '2px 0' }} />
                        <div style={{ fontSize: '9px', fontWeight: 700 }}>#{label.lote}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(label.lote)
                          toast.success('Lote copiado!')
                        }}
                      >
                        <Copy className="h-3 w-3" />
                        Copiar Lote
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewLabel(label.id)
                        }}
                      >
                        <Printer className="h-3 w-3" />
                        Reimprimir
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
                  disabled={histPage <= 1}
                  onClick={() => setHistPage(histPage - 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                </Button>
                <span className="text-xs font-bold px-2 tabular-nums">{histPage} / {pagination.totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={histPage >= pagination.totalPages}
                  onClick={() => setHistPage(histPage + 1)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Generate Label Modal                                          */}
      {/* ============================================================ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                <Tag className="h-[18px] w-[18px] text-rose-600" />
              </div>
              Nova Etiqueta
            </DialogTitle>
            <DialogDescription>
              Preencha os dados para gerar uma nova etiqueta de producao.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Tipo selector */}
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-foreground">Tipo de item <span className="text-destructive">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setTipoItem('receita'); setItemId(''); setDataValidade('') }}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-[13px] font-bold transition-all touch-manipulation',
                    tipoItem === 'receita'
                      ? 'border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 shadow-sm'
                      : 'border-border/50 text-muted-foreground/50 hover:border-border hover:text-muted-foreground',
                  )}
                >
                  <ChefHat className={cn('h-5 w-5', tipoItem === 'receita' ? '' : 'opacity-50')} />
                  Receita
                </button>
                <button
                  type="button"
                  onClick={() => { setTipoItem('produto'); setItemId(''); setDataValidade('') }}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-[13px] font-bold transition-all touch-manipulation',
                    tipoItem === 'produto'
                      ? 'border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 shadow-sm'
                      : 'border-border/50 text-muted-foreground/50 hover:border-border hover:text-muted-foreground',
                  )}
                >
                  <Package className={cn('h-5 w-5', tipoItem === 'produto' ? '' : 'opacity-50')} />
                  Produto
                </button>
              </div>
            </div>

            {/* Item select */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-foreground">
                {tipoItem === 'receita' ? 'Receita' : 'Produto'} <span className="text-destructive">*</span>
              </label>
              <Select
                value={itemId}
                onValueChange={(v) => {
                  setItemId(v)
                  calcularValidade(v, dataProducao)
                  // Auto-fill descricao
                  const list = tipoItem === 'receita' ? receitasList : productsList
                  const item = list.find((i) => i.id === v)
                  if (item && !descricao) setDescricao(item.nome)
                }}
              >
                <SelectTrigger className="rounded-xl border-border/70 shadow-warm-sm h-11">
                  <SelectValue placeholder={`Selecione ${tipoItem === 'receita' ? 'a receita' : 'o produto'}`} />
                </SelectTrigger>
                <SelectContent>
                  {(tipoItem === 'receita' ? receitasList : productsList).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <span>{item.nome}</span>
                        {item.validadeDias && (
                          <span className="text-[10px] text-muted-foreground/40 font-mono">{item.validadeDias}d</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descricao */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-foreground">Descricao <span className="text-destructive">*</span></label>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Bolo de chocolate - lote manha"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-border/70 bg-card text-sm shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Date + Qty row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-foreground">Producao <span className="text-destructive">*</span></label>
                <input
                  type="date"
                  value={dataProducao}
                  onChange={(e) => {
                    setDataProducao(e.target.value)
                    calcularValidade(itemId, e.target.value)
                  }}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/70 bg-card text-sm shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-foreground">
                  Validade
                  {selectedItem?.validadeDias ? (
                    <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold">auto · {selectedItem.validadeDias} dias</span>
                  ) : (
                    <span className="ml-1.5 text-[10px] text-muted-foreground/40 font-medium">(manual)</span>
                  )}
                </label>
                {selectedItem?.validadeDias ? (
                  <div className={cn(
                    'w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all',
                    dataValidade
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/15 text-emerald-700 dark:text-emerald-400'
                      : 'border-border/70 bg-muted/30 text-muted-foreground/50',
                  )}>
                    {dataValidade ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {new Date(dataValidade + 'T12:00:00').toLocaleDateString('pt-BR')}
                        <span className="text-[10px] font-normal text-muted-foreground/50">({selectedItem.validadeDias}d a partir da producao)</span>
                      </span>
                    ) : (
                      'Informe a data de producao'
                    )}
                  </div>
                ) : (
                  <input
                    type="date"
                    value={dataValidade}
                    onChange={(e) => setDataValidade(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border/70 bg-card text-sm shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold text-foreground">Quantidade <span className="text-destructive">*</span></label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                    disabled={quantidade <= 1}
                    className={cn(
                      'h-10 w-10 rounded-xl border-2 flex items-center justify-center font-bold transition-all touch-manipulation active:scale-90 disabled:cursor-not-allowed shrink-0',
                      quantidade > 1
                        ? 'border-rose-300 dark:border-rose-600 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 hover:bg-rose-100 shadow-sm disabled:opacity-40'
                        : 'border-border bg-muted/40 text-muted-foreground/40 disabled:opacity-30',
                    )}
                  >
                    <Minus className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                    className="h-10 flex-1 min-w-0 rounded-xl border-2 border-border text-center text-[15px] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantidade(quantidade + 1)}
                    className={cn(
                      'h-10 w-10 rounded-xl border-2 flex items-center justify-center font-bold transition-all touch-manipulation active:scale-90 shrink-0',
                      'border-rose-400 dark:border-rose-500 bg-rose-500 dark:bg-rose-600 text-white hover:bg-rose-600 dark:hover:bg-rose-500 shadow-md shadow-rose-500/25',
                    )}
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>

            {/* Live preview of the label that will be generated */}
            {(descricao || itemId) && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-[0.1em]">Pre-visualizacao</p>
                <div className="relative rounded-xl border-2 border-dashed border-rose-200 dark:border-rose-800/50 bg-rose-50/30 dark:bg-rose-900/10 p-4">
                  {/* Mini QR */}
                  <div className="absolute top-3 right-3 h-10 w-10 rounded-lg bg-white dark:bg-neutral-800 border border-border/30 flex items-center justify-center">
                    <QrCode className="h-6 w-6 text-muted-foreground/20" />
                  </div>
                  <div className="space-y-1.5 pr-14">
                    <p className="text-sm font-bold">{descricao || 'Descricao da etiqueta'}</p>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground/50 font-medium">
                      {dataProducao && (
                        <span>Prod: {formatDate(dataProducao)}</span>
                      )}
                      {dataValidade && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Val: {formatDate(dataValidade)}</span>
                      )}
                      <span>Qtd: {quantidade}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={gerarMutation.isPending || !itemId || !descricao}
                size="lg"
                className="text-white shadow-md min-w-[160px] bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-rose-500/20"
              >
                {gerarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Printer className="h-4 w-4 mr-1.5" />
                Gerar Etiqueta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Reprint Detail Modal                                          */}
      {/* ============================================================ */}
      <Dialog open={!!selectedLabel} onOpenChange={() => setSelectedLabel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                <Printer className="h-[18px] w-[18px] text-rose-600" />
              </div>
              Reimprimir Etiqueta
            </DialogTitle>
            <DialogDescription>
              Pre-visualizacao da etiqueta 60x60mm. Confira e envie para impressao.
            </DialogDescription>
          </DialogHeader>

          {selectedLabel && (() => {
            const status = getValidadeStatus(selectedLabel.dataValidade)
            const sc = STATUS_CONFIG[status]
            return (
              <div className="space-y-4">
                {/* Label preview — visual replica of the 60x60mm thermal label */}
                <div className="flex justify-center">
                  <div
                    className="border-2 border-neutral-800 bg-white text-black"
                    style={{
                      width: '226px', // ~60mm at 96dpi
                      height: '226px',
                      padding: '8px',
                      fontFamily: "'Arial Narrow', Arial, Helvetica, sans-serif",
                      fontSize: '9px',
                      lineHeight: '1.35',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Product name */}
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      borderBottom: '1.5px solid #000',
                      paddingBottom: '3px',
                      marginBottom: '3px',
                      letterSpacing: '0.02em',
                      lineHeight: '1.15',
                    }}>
                      {selectedLabel.descricao}
                    </div>

                    {/* Manipulation */}
                    <div style={{ marginBottom: '1px' }}>
                      <span style={{ fontWeight: 700 }}>MANIPULACAO:</span>{' '}
                      {formatDateTimeFull(selectedLabel.dataProducao)}
                    </div>

                    {/* Validity */}
                    <div style={{ marginBottom: '1px' }}>
                      <span style={{ fontWeight: 700 }}>VALIDADE:</span>{' '}
                      {selectedLabel.dataValidade ? formatDateTimeFull(selectedLabel.dataValidade) : '---'}
                    </div>

                    {/* Separator */}
                    <div style={{ borderBottom: '0.5px solid #000', margin: '3px 0' }} />

                    {/* Responsible */}
                    <div style={{ marginBottom: '1px' }}>
                      <span style={{ fontWeight: 700 }}>RESP.:</span>{' '}
                      {selectedLabel.responsavel?.nome?.toUpperCase() || '---'}
                    </div>

                    {/* Unit info */}
                    {selectedLabel.unit && (
                      <>
                        <div style={{ marginBottom: '1px', fontWeight: 700 }}>
                          {selectedLabel.unit.nome?.toUpperCase()}
                        </div>
                        {selectedLabel.unit.endereco && (
                          <div style={{ marginBottom: '1px', fontSize: '8px' }}>
                            {selectedLabel.unit.endereco.toUpperCase()}
                          </div>
                        )}
                      </>
                    )}

                    {/* Separator */}
                    <div style={{ borderBottom: '0.5px solid #000', margin: '3px 0' }} />

                    {/* Label ID */}
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.03em' }}>
                      #{selectedLabel.lote}
                    </div>
                  </div>
                </div>

                {/* Status + quantity info */}
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={cn('text-[11px] gap-1 border', sc.badge)}>
                    <sc.icon className="h-3 w-3" />
                    {sc.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground/50 font-medium">
                    Qtd: <span className="font-mono font-bold text-foreground">{selectedLabel.quantidade}</span> etiqueta{selectedLabel.quantidade !== 1 ? 's' : ''}
                  </span>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedLabel(null)}>
                    Fechar
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => {
                      handlePrint()
                      toast.success('Enviado para impressao')
                    }}
                    className="gap-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-md shadow-rose-500/20"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir {selectedLabel.quantidade > 1 ? `(${selectedLabel.quantidade}x)` : ''}
                  </Button>
                </DialogFooter>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Hidden print area — rendered off-screen, only visible during window.print() */}
      {selectedLabel && <PrintLabel label={selectedLabel} />}
    </div>
  )
}
