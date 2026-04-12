'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import {
  Download,
  BarChart3,
  ShoppingCart,
  Package,
  ChefHat,
  ClipboardCheck,
  AlertTriangle,
  Calendar,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

const reportModules = [
  { key: 'purchases', label: 'Compras', icon: ShoppingCart, endpoint: '/reports/purchases', color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' },
  { key: 'stock', label: 'Estoque', icon: Package, endpoint: '/reports/stock', color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20' },
  { key: 'production', label: 'Producao', icon: ChefHat, endpoint: '/reports/production', color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20' },
  { key: 'checklists', label: 'Checklists', icon: ClipboardCheck, endpoint: '/reports/checklists', color: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/20' },
  { key: 'occurrences', label: 'Ocorrencias', icon: AlertTriangle, endpoint: '/reports/occurrences', color: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20' },
]

export default function RelatoriosPage() {
  const { selectedUnitId } = useAuthStore()
  const [selectedModule, setSelectedModule] = useState(reportModules[0])
  const [page, setPage] = useState(1)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [exporting, setExporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['reports', selectedModule.key, page, selectedUnitId, dataInicio, dataFim],
    queryFn: () => api.get(selectedModule.endpoint, {
      page, limit: 20,
      unitId: selectedUnitId || undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
    }),
  })

  // Dynamic columns from data
  const columns = data?.data?.[0]
    ? Object.keys(data.data[0]).map((key) => ({
        key,
        header: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        cell: (row: any) => {
          const val = row[key]
          if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val))) {
            return <span className="text-xs tabular-nums">{new Date(val).toLocaleDateString('pt-BR')}</span>
          }
          if (typeof val === 'number') return <span className="tabular-nums">{val.toLocaleString('pt-BR')}</span>
          return String(val ?? '—')
        },
      }))
    : []

  async function exportCSV() {
    try {
      setExporting(true)
      const csvData = await api.get(selectedModule.endpoint, {
        unitId: selectedUnitId || undefined,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        format: 'csv',
      })
      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-${selectedModule.key}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Relatorio exportado com sucesso')
    } catch (err: any) {
      toast.error('Erro ao exportar CSV')
    } finally {
      setExporting(false)
    }
  }

  const ModuleIcon = selectedModule.icon

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-warm-sm">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Relatorios</h1>
          <p className="text-xs sm:text-sm text-muted-foreground/50">Relatorios operacionais com exportacao CSV</p>
        </div>
      </div>

      {/* Module selector - card-style tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none">
        {reportModules.map((mod) => {
          const Icon = mod.icon
          const isActive = selectedModule.key === mod.key
          return (
            <button
              key={mod.key}
              onClick={() => { setSelectedModule(mod); setPage(1) }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0 touch-manipulation border ${
                isActive
                  ? 'bg-card border-border/50 shadow-warm-sm text-foreground'
                  : 'border-transparent text-muted-foreground/60 hover:text-foreground hover:bg-muted/30'
              }`}
            >
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isActive ? mod.color : 'bg-transparent'}`}>
                <Icon className={`h-3.5 w-3.5 ${isActive ? '' : 'text-muted-foreground/40'}`} />
              </div>
              {mod.label}
            </button>
          )
        })}
      </div>

      {/* Filters + Export */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="grid grid-cols-2 sm:flex gap-3">
          <div>
            <label className="block text-[11px] font-semibold mb-1.5 text-muted-foreground/60 uppercase tracking-wider">
              <Calendar className="h-3 w-3 inline mr-1" />Data inicio
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => { setDataInicio(e.target.value); setPage(1) }}
              className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-input bg-card text-sm shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1.5 text-muted-foreground/60 uppercase tracking-wider">
              <Calendar className="h-3 w-3 inline mr-1" />Data fim
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => { setDataFim(e.target.value); setPage(1) }}
              className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-input bg-card text-sm shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
            />
          </div>
        </div>
        <Button
          variant="outline"
          onClick={exportCSV}
          disabled={exporting}
          className="gap-2"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar CSV
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        total={data?.total || 0}
        page={page}
        limit={20}
        totalPages={data?.totalPages || 1}
        onPageChange={setPage}
        loading={isLoading}
      />
    </div>
  )
}
