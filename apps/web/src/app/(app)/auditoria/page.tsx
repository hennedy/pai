'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Eye,
  LogIn,
  LogOut,
  RotateCcw,
  FileCode,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react'

// Action config with icons and colors
const actionConfig: Record<string, { icon: React.ElementType; variant: 'default' | 'success' | 'warning' | 'destructive' | 'info'; label: string }> = {
  CREATE: { icon: Plus, variant: 'success', label: 'Criacao' },
  UPDATE: { icon: Pencil, variant: 'warning', label: 'Atualizacao' },
  DELETE: { icon: Trash2, variant: 'destructive', label: 'Exclusao' },
  LOGIN: { icon: LogIn, variant: 'info', label: 'Login' },
  LOGOUT: { icon: LogOut, variant: 'default', label: 'Logout' },
  RESTORE: { icon: RotateCcw, variant: 'success', label: 'Restauracao' },
  VIEW: { icon: Eye, variant: 'default', label: 'Visualizacao' },
}

// Entity labels
const entityLabels: Record<string, string> = {
  User: 'Usuario',
  Unit: 'Unidade',
  PurchaseCycle: 'Ciclo Compras',
  StockEntry: 'Movimentacao',
  ProductionOrder: 'Ordem Producao',
  Occurrence: 'Ocorrencia',
  Checklist: 'Checklist',
  Product: 'Produto',
  Integration: 'Integracao',
  Recipe: 'Receita',
}

function PayloadViewer({ payload }: { payload: any }) {
  const [open, setOpen] = useState(false)
  if (!payload) return <span className="text-muted-foreground/40">—</span>

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors py-1"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {open ? 'Ocultar' : 'Ver detalhes'}
      </button>
      {open && (
        <pre className="mt-1.5 p-3 rounded-xl bg-muted/50 border border-border/30 text-[11px] font-mono overflow-auto max-w-xs max-h-40 text-foreground/70 animate-fade-in">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function AuditoriaPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterEntidade, setFilterEntidade] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, filterEntidade, dataInicio, dataFim],
    queryFn: () => api.get('/audit-logs', {
      page, limit: 20,
      entidade: filterEntidade || undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
    }),
  })

  const activeFilters = [filterEntidade, dataInicio, dataFim].filter(Boolean).length

  const columns = [
    { key: 'createdAt', header: 'Data/Hora', cell: (row: any) => (
      <div>
        <span className="text-xs font-mono tabular-nums text-foreground/80">
          {new Date(row.createdAt).toLocaleDateString('pt-BR')}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/50 ml-1.5">
          {new Date(row.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    )},
    { key: 'user', header: 'Usuario', cell: (row: any) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white text-[10px] font-bold shrink-0">
          {(row.user?.nome || 'S')[0].toUpperCase()}
        </div>
        <span className="text-sm font-medium">{row.user?.nome || 'Sistema'}</span>
      </div>
    )},
    { key: 'acao', header: 'Acao', cell: (row: any) => {
      const config = actionConfig[row.acao] || { icon: FileCode, variant: 'default' as const, label: row.acao }
      const Icon = config.icon
      return (
        <Badge variant={config.variant} className="gap-1">
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      )
    }},
    { key: 'entidade', header: 'Entidade', cell: (row: any) => (
      <span className="text-sm text-foreground/70">{entityLabels[row.entidade] || row.entidade}</span>
    )},
    { key: 'entityId', header: 'ID', cell: (row: any) => (
      row.entityId
        ? <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground/60">{row.entityId.slice(0, 8)}</span>
        : <span className="text-muted-foreground/40">—</span>
    )},
    { key: 'ip', header: 'IP', cell: (row: any) => (
      row.ip
        ? <span className="font-mono text-[11px] text-muted-foreground/50">{row.ip}</span>
        : <span className="text-muted-foreground/40">—</span>
    )},
    { key: 'payload', header: 'Detalhes', cell: (row: any) => (
      <PayloadViewer payload={row.payload} />
    )},
  ]

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-warm-sm">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Auditoria</h1>
            <p className="text-xs sm:text-sm text-muted-foreground/50">Rastreamento de todas as acoes do sistema</p>
          </div>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border/50 bg-card/80 text-sm font-medium hover:shadow-warm transition-all touch-manipulation"
        >
          <Filter className="h-4 w-4 text-muted-foreground/60" />
          Filtros
          {activeFilters > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end p-4 rounded-xl bg-muted/20 border border-border/30 animate-slide-in-down">
          <div className="w-full sm:w-auto">
            <label className="block text-[11px] font-semibold mb-1.5 text-muted-foreground/60 uppercase tracking-wider">Entidade</label>
            <select
              value={filterEntidade}
              onChange={(e) => { setFilterEntidade(e.target.value); setPage(1) }}
              className="w-full sm:w-auto px-3.5 py-2.5 sm:py-2 rounded-xl border border-input bg-card text-sm shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
            >
              <option value="">Todas</option>
              {Object.entries(entityLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1.5 text-muted-foreground/60 uppercase tracking-wider">Data inicio</label>
              <input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setPage(1) }} className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-input bg-card text-sm shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1.5 text-muted-foreground/60 uppercase tracking-wider">Data fim</label>
              <input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setPage(1) }} className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-input bg-card text-sm shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all" />
            </div>
          </div>
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterEntidade(''); setDataInicio(''); setDataFim(''); setPage(1) }}
              className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors py-2 touch-manipulation"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.data || []}
        total={data?.total || 0}
        page={page}
        limit={20}
        totalPages={data?.totalPages || 1}
        onPageChange={setPage}
        loading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por acao ou entidade..."
      />
    </div>
  )
}
