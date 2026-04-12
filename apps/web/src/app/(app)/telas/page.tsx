'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Grid2X2,
  Plus,
  Minus,
  Clock,
  User,
  Calendar,
  Trash2,
  ChevronRight,
  RotateCcw,
  Flame,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Helpers
// ============================================================

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
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
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

export default function TelasPage() {
  const { selectedUnitId, hasPermission } = useAuthStore()
  const queryClient = useQueryClient()

  const canVisualizar = hasPermission('telas', 'visualizar')
  const canCriar = hasPermission('telas', 'criar')
  const canExcluir = hasPermission('telas', 'excluir')

  // Paginacao
  const [page, setPage] = useState(1)

  // Modal de nova contagem
  const [modalOpen, setModalOpen] = useState(false)
  const [telasCruas, setTelasCruas] = useState(0)
  const [telasAssadas, setTelasAssadas] = useState(0)
  const [observacao, setObservacao] = useState('')

  // Confirmacao de exclusao
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ---- Queries ----

  const { data: summaryData } = useQuery({
    queryKey: ['telas-summary', selectedUnitId],
    queryFn: () => api.get('/telas/summary'),
    enabled: canVisualizar,
  })

  const { data: contagensData, isLoading } = useQuery({
    queryKey: ['telas', page, selectedUnitId],
    queryFn: () => api.get('/telas', { page, limit: 15 }),
    enabled: canVisualizar,
  })

  const contagens: any[] = contagensData?.data || []
  const pagination = contagensData?.pagination
  const ultimaContagem = summaryData?.ultimaContagem
  const contagensOntem: number = summaryData?.contagensOntem || 0
  const totalCruasOntem: number = summaryData?.totalCruasOntem || 0
  const totalAssadasOntem: number = summaryData?.totalAssadasOntem || 0

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/telas', data),
    onSuccess: () => {
      toast.success('Contagem registrada com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['telas'] })
      queryClient.invalidateQueries({ queryKey: ['telas-summary'] })
      setModalOpen(false)
      resetModal()
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao salvar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/telas/${id}`),
    onSuccess: () => {
      toast.success('Contagem excluida')
      queryClient.invalidateQueries({ queryKey: ['telas'] })
      queryClient.invalidateQueries({ queryKey: ['telas-summary'] })
      setDeleteId(null)
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao excluir'),
  })

  // ---- Handlers ----

  function resetModal() {
    setTelasCruas(0)
    setTelasAssadas(0)
    setObservacao('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate({
      telasCruas,
      telasAssadas,
      observacao: observacao || undefined,
    })
  }

  function adjust(setter: React.Dispatch<React.SetStateAction<number>>, delta: number) {
    setter((prev) => Math.max(0, prev + delta))
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          icon={Grid2X2}
          iconGradient="from-amber-500 to-amber-700"
          title="Telas de Pao Frances"
          description="Monitoramento de telas cruas e assadas por turno"
        />
        {canCriar && (
          <Button
            onClick={() => { resetModal(); setModalOpen(true) }}
            size="lg"
            className="w-full sm:w-auto gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20"
          >
            <Grid2X2 className="h-4 w-4" />
            Nova Contagem
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {canVisualizar && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Ultima contagem */}
          <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-warm-sm">
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground/60 font-medium">Cruas</span>
                  <span className="font-mono font-bold text-amber-600">{ultimaContagem.telasCruas}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground/60 font-medium">Assadas</span>
                  <span className="font-mono font-bold text-orange-600">{ultimaContagem.telasAssadas}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40 pt-1">
                  <User className="h-3 w-3" />
                  {ultimaContagem.responsavel?.nome}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/40 font-medium">Nenhuma contagem ainda</p>
            )}
          </div>

          {/* Telas cruas ontem */}
          <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-warm-sm">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                <Grid2X2 className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">Telas cruas ontem</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-semibold text-amber-600 tracking-tight tabular-nums">{totalCruasOntem}</span>
              <span className="text-xs text-muted-foreground/50 font-medium">telas</span>
            </div>
            <p className="text-[11px] text-muted-foreground/40 mt-1 font-medium">
              Em {contagensOntem} contagem{contagensOntem !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Telas assadas ontem */}
          <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-warm-sm">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
                <Flame className="h-4 w-4 text-orange-500" />
              </div>
              <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">Telas assadas ontem</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-semibold text-orange-600 tracking-tight tabular-nums">{totalAssadasOntem}</span>
              <span className="text-xs text-muted-foreground/50 font-medium">telas</span>
            </div>
            <p className="text-[11px] text-muted-foreground/40 mt-1 font-medium">
              Em {contagensOntem} contagem{contagensOntem !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Listagem */}
      {canVisualizar && (
        <>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-border/30 bg-card p-4 animate-shimmer" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="h-4 w-48 rounded bg-muted/30 mb-3" />
                  <div className="h-3 w-32 rounded bg-muted/20" />
                </div>
              ))}
            </div>
          ) : contagens.length === 0 ? (
            <SmartEmptyState
              icon={Grid2X2}
              title="Nenhuma contagem registrada"
              description="Registre a primeira contagem de telas para comecar o monitoramento"
              action={canCriar ? { label: 'Nova contagem', onClick: () => { resetModal(); setModalOpen(true) } } : undefined}
            />
          ) : (
            <div className="space-y-2.5">
              {contagens.map((c: any) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-border/50 bg-card shadow-warm-sm hover:shadow-warm transition-shadow p-4"
                >
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                      <Grid2X2 className="h-5 w-5 text-amber-500" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-wider flex items-center gap-1">
                          <Grid2X2 className="h-3 w-3 text-amber-500" />
                          Cruas: <span className="text-amber-600 font-mono">{c.telasCruas}</span>
                        </span>
                        <span className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-wider flex items-center gap-1">
                          <Flame className="h-3 w-3 text-orange-500" />
                          Assadas: <span className="text-orange-600 font-mono">{c.telasAssadas}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground/40 font-medium flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatDateTime(c.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-2.5 w-2.5" />
                          {c.responsavel?.nome}
                        </span>
                      </div>
                      {c.observacao && (
                        <p className="text-[11px] text-muted-foreground/40 mt-1 italic">&ldquo;{c.observacao}&rdquo;</p>
                      )}
                    </div>

                    {/* Delete */}
                    {canExcluir && (
                      <button
                        onClick={() => setDeleteId(c.id)}
                        className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Paginacao */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground/40 font-medium">
                    {pagination.total} registro{pagination.total !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 w-8 p-0">
                      <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                    </Button>
                    <span className="text-xs font-bold px-2 tabular-nums">{page} / {pagination.totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)} className="h-8 w-8 p-0">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Sem permissao de visualizar */}
      {!canVisualizar && (
        <SmartEmptyState
          icon={Grid2X2}
          title="Sem acesso"
          description="Seu perfil nao tem permissao para visualizar as contagens de telas."
        />
      )}

      {/* ============================================================ */}
      {/* Modal — Nova Contagem */}
      {/* ============================================================ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <Grid2X2 className="h-[18px] w-[18px] text-amber-600" />
              </div>
              Nova Contagem de Telas
            </DialogTitle>
            <DialogDescription>
              Informe a quantidade de telas cruas e assadas no momento da contagem.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 pt-1">
            {/* Telas Cruas */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Grid2X2 className="h-4 w-4 text-amber-500" />
                Telas Cruas
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => adjust(setTelasCruas, -1)}
                  className="h-10 w-10 rounded-xl border border-border bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min={0}
                  value={telasCruas}
                  onChange={(e) => setTelasCruas(Math.max(0, parseInt(e.target.value) || 0))}
                  className="flex-1 text-center text-2xl font-bold font-mono py-2 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => adjust(setTelasCruas, 1)}
                  className="h-10 w-10 rounded-xl border border-border bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Telas Assadas */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Telas Assadas
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => adjust(setTelasAssadas, -1)}
                  className="h-10 w-10 rounded-xl border border-border bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min={0}
                  value={telasAssadas}
                  onChange={(e) => setTelasAssadas(Math.max(0, parseInt(e.target.value) || 0))}
                  className="flex-1 text-center text-2xl font-bold font-mono py-2 rounded-xl border border-border bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => adjust(setTelasAssadas, 1)}
                  className="h-10 w-10 rounded-xl border border-border bg-muted/30 flex items-center justify-center hover:bg-muted/60 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Resumo */}
            <div className="rounded-xl bg-muted/30 px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground/60 font-medium">Total de telas</span>
              <span className="font-mono font-bold text-foreground">{telasCruas + telasAssadas}</span>
            </div>

            {/* Observacao */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Observacao <span className="text-muted-foreground/40">(opcional)</span></label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition resize-none"
                placeholder="Alguma observacao sobre esta contagem..."
              />
            </div>

            <DialogFooter className="gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
              >
                {createMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                ) : (
                  'Registrar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Dialog — Confirmar exclusao */}
      {/* ============================================================ */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir contagem</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta contagem? Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
