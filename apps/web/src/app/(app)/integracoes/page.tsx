'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { DataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
  Plus,
  Plug,
  RefreshCw,
  Eye,
  ArrowLeft,
  Webhook,
  Server,
  Globe,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
} from 'lucide-react'

// Type icons for integration types
const typeIcons: Record<string, React.ElementType> = {
  webhook: Webhook,
  api: Globe,
  erp: Server,
}

export default function IntegracoesPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [showLogs, setShowLogs] = useState<any>(null)
  const [logPage, setLogPage] = useState(1)
  const [form, setForm] = useState({ nome: '', tipo: '', configuracao: '{}' })

  const { data, isLoading } = useQuery({
    queryKey: ['integrations', page],
    queryFn: () => api.get('/integrations', { page, limit: 20 }),
  })

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['integration-logs', showLogs?.id, logPage],
    queryFn: () => api.get(`/integrations/${showLogs.id}/logs`, { page: logPage, limit: 20 }),
    enabled: !!showLogs?.id,
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/integrations', {
      ...data,
      configuracao: JSON.parse(data.configuracao || '{}'),
    }),
    onSuccess: () => {
      toast.success('Integracao criada')
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      setModalOpen(false)
      setForm({ nome: '', tipo: '', configuracao: '{}' })
    },
    onError: (err: any) => toast.error(err.message),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/integrations/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status atualizado')
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    },
    onError: (err: any) => toast.error(err.message),
  })

  const reprocessMutation = useMutation({
    mutationFn: ({ integrationId, logId }: { integrationId: string; logId: string }) =>
      api.post(`/integrations/${integrationId}/reprocess/${logId}`),
    onSuccess: () => {
      toast.success('Reprocessamento iniciado')
      queryClient.invalidateQueries({ queryKey: ['integration-logs'] })
    },
    onError: (err: any) => toast.error(err.message),
  })

  const columns = [
    { key: 'nome', header: 'Integracao', cell: (row: any) => {
      const TypeIcon = typeIcons[row.tipo?.toLowerCase()] || Plug
      return (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-warm-sm shrink-0">
            <TypeIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium">{row.nome}</p>
            <p className="text-[11px] text-muted-foreground/50 capitalize">{row.tipo}</p>
          </div>
        </div>
      )
    }},
    { key: 'status', header: 'Status', cell: (row: any) => (
      <div className="flex items-center gap-2.5">
        <Switch
          checked={row.status === 'ativo'}
          onCheckedChange={(checked) =>
            toggleStatusMutation.mutate({ id: row.id, status: checked ? 'ativo' : 'inativo' })
          }
        />
        <Badge variant={row.status === 'ativo' ? 'success' : 'secondary'}>
          {row.status === 'ativo' ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>
    )},
    { key: 'createdAt', header: 'Criado em', cell: (row: any) => (
      <span className="text-xs text-muted-foreground/60">{new Date(row.createdAt).toLocaleDateString('pt-BR')}</span>
    )},
    { key: 'actions', header: '', className: 'w-20', cell: (row: any) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { setShowLogs(row); setLogPage(1) }}
        className="text-xs gap-1.5"
      >
        <Eye className="h-3.5 w-3.5" /> Logs
      </Button>
    )},
  ]

  const logColumns = [
    { key: 'tipo', header: 'Tipo', cell: (row: any) => (
      <span className="text-xs font-medium capitalize">{row.tipo}</span>
    )},
    { key: 'status', header: 'Status', cell: (row: any) => {
      const isSuccess = row.status === 'sucesso'
      return (
        <Badge variant={isSuccess ? 'success' : 'destructive'} className="gap-1">
          {isSuccess ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {row.status}
        </Badge>
      )
    }},
    { key: 'createdAt', header: 'Data', cell: (row: any) => (
      <div className="flex items-center gap-1.5 text-muted-foreground/60">
        <Clock className="h-3 w-3" />
        <span className="text-xs">{new Date(row.createdAt).toLocaleString('pt-BR')}</span>
      </div>
    )},
    { key: 'erro', header: 'Erro', cell: (row: any) => row.erro
      ? <span className="text-xs text-red-500/80 truncate max-w-[200px] block">{row.erro}</span>
      : <span className="text-muted-foreground/40">—</span>
    },
    { key: 'actions', header: '', cell: (row: any) => row.status === 'falha' && (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => reprocessMutation.mutate({ integrationId: showLogs.id, logId: row.id })}
        disabled={reprocessMutation.isPending}
        className="text-xs gap-1 text-amber-600 hover:text-amber-700"
      >
        <RefreshCw className={`h-3 w-3 ${reprocessMutation.isPending ? 'animate-spin' : ''}`} /> Reprocessar
      </Button>
    )},
  ]

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-warm-sm">
          <Plug className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Integracoes</h1>
          <p className="text-xs sm:text-sm text-muted-foreground/50">Gerenciamento de integracoes externas</p>
        </div>
      </div>

      {!showLogs ? (
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
            <Button onClick={() => setModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white">
              <Plus className="h-4 w-4 mr-2" /> Nova Integracao
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Logs sub-header */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
            <button
              onClick={() => setShowLogs(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors touch-manipulation"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2.5 flex-1">
              <Zap className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-semibold">{showLogs.nome}</p>
                <p className="text-[11px] text-muted-foreground/50">Historico de execucoes</p>
              </div>
            </div>
            <Badge variant={showLogs.status === 'ativo' ? 'success' : 'secondary'}>
              {showLogs.status}
            </Badge>
          </div>

          <DataTable
            columns={logColumns}
            data={logsData?.data || []}
            total={logsData?.total || 0}
            page={logPage}
            limit={20}
            totalPages={logsData?.totalPages || 1}
            onPageChange={setLogPage}
            loading={logsLoading}
          />
        </div>
      )}

      {/* Create Integration Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Integracao</DialogTitle>
            <DialogDescription>Configure uma nova integracao externa.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form) }} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome <span className="text-destructive">*</span></label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-input bg-card text-sm shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                placeholder="Nome da integracao"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo <span className="text-destructive">*</span></label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-input bg-card text-sm shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              >
                <option value="">Selecione o tipo</option>
                <option value="webhook">Webhook</option>
                <option value="api">API</option>
                <option value="erp">ERP</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Configuracao (JSON)</label>
              <textarea
                value={form.configuracao}
                onChange={(e) => setForm({ ...form, configuracao: e.target.value })}
                rows={4}
                className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-input bg-card text-sm font-mono shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
