'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Package,
  ShoppingCart,
  ClipboardCheck,
  AlertTriangle,
  Factory,
  BellRing,
  Circle,
} from 'lucide-react'

// Type config with proper Lucide icons
const tipoConfig: Record<string, { icon: React.ElementType; color: string }> = {
  estoque_minimo: { icon: Package, color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  ciclo_compras: { icon: ShoppingCart, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
  checklist_atrasado: { icon: ClipboardCheck, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' },
  ocorrencia_critica: { icon: AlertTriangle, color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  producao_estoque_insuficiente: { icon: Factory, color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' },
  geral: { icon: BellRing, color: 'text-muted-foreground bg-muted/50' },
}

export default function NotificacoesPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [filterLida, setFilterLida] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page, filterLida],
    queryFn: () => api.get('/notifications', {
      page, limit: 20,
      lida: filterLida === '' ? undefined : filterLida === 'true',
    }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['sidebar', 'badges'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      toast.success('Todas as notificacoes marcadas como lidas')
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['sidebar', 'badges'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] })
    },
    onError: (err: any) => toast.error(err.message),
  })

  const unreadCount = data?.total || 0

  const columns = [
    { key: 'tipo', header: '', className: 'w-12', cell: (row: any) => {
      const config = tipoConfig[row.tipo] || tipoConfig.geral
      const Icon = config.icon
      return (
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${config.color}`}>
          <Icon className="h-4 w-4" />
        </div>
      )
    }},
    { key: 'titulo', header: 'Notificacao', cell: (row: any) => (
      <div className="flex items-start gap-2">
        {!row.lida && (
          <Circle className="h-2 w-2 fill-primary text-primary shrink-0 mt-1.5" />
        )}
        <div>
          <p className={`text-sm ${row.lida ? 'text-muted-foreground/70' : 'font-semibold text-foreground'}`}>{row.titulo}</p>
          <p className="text-[11px] text-muted-foreground/50 mt-0.5 line-clamp-1">{row.mensagem}</p>
        </div>
      </div>
    )},
    { key: 'createdAt', header: 'Data', className: 'w-36', cell: (row: any) => {
      const date = new Date(row.createdAt)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMin = Math.floor(diffMs / 60000)
      const diffHr = Math.floor(diffMin / 60)

      let relative = ''
      if (diffMin < 1) relative = 'Agora'
      else if (diffMin < 60) relative = `${diffMin}min atras`
      else if (diffHr < 24) relative = `${diffHr}h atras`
      else relative = date.toLocaleDateString('pt-BR')

      return (
        <span className="text-xs text-muted-foreground/50">{relative}</span>
      )
    }},
    { key: 'actions', header: '', className: 'w-28', cell: (row: any) => (
      <div className="flex gap-1">
        {!row.lida && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markReadMutation.mutate(row.id)}
            className="text-xs text-primary h-7"
          >
            Marcar lida
          </Button>
        )}
        {row.link && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(row.link)}
            className="h-7 w-7"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    )},
  ]

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-warm-sm">
            <Bell className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Notificacoes</h1>
            <p className="text-xs sm:text-sm text-muted-foreground/50">Central de notificacoes do sistema</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 border border-border/30">
            {[
              { value: '', label: 'Todas' },
              { value: 'false', label: 'Nao lidas' },
              { value: 'true', label: 'Lidas' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setFilterLida(opt.value); setPage(1) }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                  filterLida === opt.value
                    ? 'bg-card text-foreground shadow-warm-sm border border-border/30'
                    : 'text-muted-foreground/60 hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
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
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="gap-1.5"
          >
            <CheckCheck className="h-4 w-4" /> Marcar todas como lidas
          </Button>
        }
      />
    </div>
  )
}
