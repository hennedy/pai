'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Target, Plus, RefreshCw, CheckCircle, ChevronLeft, ChevronRight,
  TrendingUp, BarChart2, Users, Pencil, Trash2, PlayCircle, XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusCiclo = 'planejamento' | 'em_andamento' | 'encerrado'
type TipoAvaliacao = 'autoavaliacao' | 'gestor' | 'par' | 'subordinado' | 'cliente_interno'
type StatusAvaliacao = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
type StatusMeta = 'em_andamento' | 'concluida' | 'nao_atingida' | 'cancelada'
type Tab = 'dashboard' | 'ciclos' | 'avaliacoes' | 'metas'

const STATUS_CICLO_CONFIG: Record<StatusCiclo, { label: string; color: string }> = {
  planejamento: { label: 'Planejamento', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  encerrado:    { label: 'Encerrado',    color: 'bg-green-500/15 text-green-400 border-green-500/20' },
}
const STATUS_AVAL_CONFIG: Record<StatusAvaliacao, { label: string; color: string }> = {
  pendente:    { label: 'Pendente',    color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  em_andamento:{ label: 'Em Andamento',color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  concluida:   { label: 'Concluída',   color: 'bg-green-500/15 text-green-400 border-green-500/20' },
  cancelada:   { label: 'Cancelada',   color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
}
const STATUS_META_CONFIG: Record<StatusMeta, { label: string; color: string }> = {
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  concluida:    { label: 'Concluída',    color: 'bg-green-500/15 text-green-400 border-green-500/20' },
  nao_atingida: { label: 'Não Atingida', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
  cancelada:    { label: 'Cancelada',    color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
}
const TIPO_AVAL_LABELS: Record<TipoAvaliacao, string> = {
  autoavaliacao: 'Autoavaliação', gestor: 'Gestor', par: 'Par',
  subordinado: 'Subordinado', cliente_interno: 'Cliente Interno',
}

function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—' }

function ProgressBar({ value, meta }: { value: number; meta?: number | null }) {
  if (!meta) return null
  const pct = Math.min(100, Math.round((value / meta) * 100))
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{value} / {meta}</span><span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-amber-500')}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Tab Dashboard ────────────────────────────────────────────────────────────

function TabDashboard({ canVis }: { canVis: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'desempenho', 'dashboard'],
    queryFn: () => api.get('/rh/desempenho/dashboard') as Promise<any>,
    enabled: canVis,
  })

  if (isLoading) return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-5">
      {data?.cicloAtivo ? (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-blue-500/15 text-blue-400 border-blue-500/20">Em andamento</span>
            <span className="font-semibold">{data.cicloAtivo.nome}</span>
          </div>
          <p className="text-xs text-muted-foreground">{fmtDate(data.cicloAtivo.dataInicio)} — {fmtDate(data.cicloAtivo.dataFim)} · Período: {data.cicloAtivo.periodoRef}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground text-center">Nenhum ciclo em andamento</div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total de Avaliações</p>
          <p className="text-3xl font-bold mt-1">{data?.avaliacoes?.total ?? 0}</p>
          <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
            <span className="text-amber-400">{data?.avaliacoes?.pendentes ?? 0} pendentes</span>
            <span className="text-green-400">{data?.avaliacoes?.concluidas ?? 0} concluídas</span>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Metas Cadastradas</p>
          <p className="text-3xl font-bold mt-1">{data?.metas?.total ?? 0}</p>
          <div className="mt-2 text-xs text-blue-400">{data?.metas?.emAndamento ?? 0} em andamento</div>
        </div>
      </div>
    </div>
  )
}

// ─── Tab Ciclos ───────────────────────────────────────────────────────────────

function TabCiclos({ canVis, canGerenciar }: { canVis: boolean; canGerenciar: boolean }) {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('all')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [confirmDel, setConfirmDel] = useState<any>(null)
  const [gerarModal, setGerarModal] = useState<any>(null)

  const [fNome, setFNome] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fPeriodo, setFPeriodo] = useState('')
  const [fInicio, setFInicio] = useState('')
  const [fFim, setFFim] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'desempenho', 'ciclos', page, filterStatus],
    queryFn: () => api.get('/rh/desempenho/ciclos', {
      page, limit: 20,
      ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
    }) as Promise<{ items: any[]; total: number; pages: number }>,
    enabled: canVis,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['rh', 'desempenho', 'ciclos'] })

  const saveMut = useMutation({
    mutationFn: (body: any) => editing
      ? api.put(`/rh/desempenho/ciclos/${editing.id}`, body)
      : api.post('/rh/desempenho/ciclos', body),
    onSuccess: () => { toast.success('Ciclo salvo'); closeModal(); invalidate(); qc.invalidateQueries({ queryKey: ['rh', 'desempenho', 'dashboard'] }) },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/rh/desempenho/ciclos/${id}/status`, { status }),
    onSuccess: () => { toast.success('Status atualizado'); invalidate(); qc.invalidateQueries({ queryKey: ['rh', 'desempenho', 'dashboard'] }) },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api.delete(`/rh/desempenho/ciclos/${id}`),
    onSuccess: () => { toast.success('Ciclo excluído'); setConfirmDel(null); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const gerarMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      api.post(`/rh/desempenho/ciclos/${id}/gerar-avaliacoes`, body),
    onSuccess: (res: any) => { toast.success(`${res.criadas} avaliações geradas`); setGerarModal(null) },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  function openCreate() { resetForm(); setEditing(null); setModal(true) }
  function openEdit(c: any) {
    setFNome(c.nome); setFDesc(c.descricao ?? ''); setFPeriodo(c.periodoRef)
    setFInicio(c.dataInicio.slice(0, 10)); setFFim(c.dataFim.slice(0, 10))
    setEditing(c); setModal(true)
  }
  function closeModal() { setModal(false); setEditing(null); resetForm() }
  function resetForm() { setFNome(''); setFDesc(''); setFPeriodo(''); setFInicio(''); setFFim('') }

  function handleSubmit() {
    if (!fNome) return toast.error('Informe o nome do ciclo')
    if (!fPeriodo) return toast.error('Informe o período de referência')
    if (!fInicio || !fFim) return toast.error('Informe as datas')
    saveMut.mutate({
      nome: fNome, descricao: fDesc || undefined, periodoRef: fPeriodo,
      dataInicio: new Date(fInicio).toISOString(), dataFim: new Date(fFim).toISOString(),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1) }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.entries(STATUS_CICLO_CONFIG) as [StatusCiclo, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {canGerenciar && <Button className="ml-auto" onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Ciclo</Button>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground border rounded-xl border-dashed">
          <Target className="h-8 w-8 opacity-30" /><p className="text-sm">Nenhum ciclo de avaliação</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.items.map((ciclo: any) => {
            const stCfg = STATUS_CICLO_CONFIG[ciclo.status as StatusCiclo]
            return (
              <div key={ciclo.id} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                  <BarChart2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{ciclo.nome}</span>
                    <span className="text-xs text-muted-foreground">{ciclo.periodoRef}</span>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', stCfg.color)}>{stCfg.label}</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>{fmtDate(ciclo.dataInicio)} — {fmtDate(ciclo.dataFim)}</span>
                    <span>{ciclo._count?.avaliacoes ?? 0} avaliações</span>
                    <span>{ciclo._count?.metas ?? 0} metas</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canGerenciar && (
                    <>
                      {ciclo.status === 'planejamento' && (
                        <Button size="sm" variant="ghost" className="text-blue-400"
                          onClick={() => statusMut.mutate({ id: ciclo.id, status: 'em_andamento' })}>
                          <PlayCircle className="h-3.5 w-3.5 mr-1" /> Iniciar
                        </Button>
                      )}
                      {ciclo.status === 'em_andamento' && (
                        <Button size="sm" variant="ghost" className="text-green-400"
                          onClick={() => statusMut.mutate({ id: ciclo.id, status: 'encerrado' })}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Encerrar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost"
                        title="Gerar avaliações em lote"
                        onClick={() => setGerarModal(ciclo)}>
                        <Users className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(ciclo)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {ciclo.status === 'planejamento' && (
                        <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setConfirmDel(ciclo)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(data?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Página {page} de {data?.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Modal criar/editar ciclo */}
      <Dialog open={modal} onOpenChange={(v) => { if (!v) closeModal() }}>
        <DialogContent className="max-w-md flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>{editing ? 'Editar Ciclo' : 'Novo Ciclo de Avaliação'}</DialogTitle></DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
            <div className="space-y-2"><Label>Nome do ciclo *</Label><Input value={fNome} onChange={(e) => setFNome(e.target.value)} placeholder="Ex: Avaliação 2025 S1" /></div>
            <div className="space-y-2"><Label>Período de referência *</Label><Input value={fPeriodo} onChange={(e) => setFPeriodo(e.target.value)} placeholder="Ex: 2025-S1, 2025-Anual" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Início *</Label><Input type="date" value={fInicio} onChange={(e) => setFInicio(e.target.value)} /></div>
              <div className="space-y-2"><Label>Fim *</Label><Input type="date" value={fFim} onChange={(e) => setFFim(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={2} /></div>
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button disabled={saveMut.isPending} onClick={handleSubmit}>{saveMut.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal gerar avaliações */}
      <Dialog open={!!gerarModal} onOpenChange={(v) => { if (!v) setGerarModal(null) }}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader><DialogTitle>Gerar Avaliações em Lote</DialogTitle></DialogHeader>
          {gerarModal && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">Ciclo: <span className="text-foreground font-medium">{gerarModal.nome}</span></p>
              <p className="text-xs text-muted-foreground">Serão criadas avaliações de autoavaliação e por gestor para todos os colaboradores ativos que ainda não possuem avaliação neste ciclo.</p>
              <div className="flex gap-3 justify-end pt-2">
                <Button variant="outline" onClick={() => setGerarModal(null)}>Cancelar</Button>
                <Button disabled={gerarMut.isPending}
                  onClick={() => gerarMut.mutate({ id: gerarModal.id, body: { tipos: ['autoavaliacao', 'gestor'] } })}>
                  {gerarMut.isPending ? 'Gerando...' : 'Gerar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <Dialog open={!!confirmDel} onOpenChange={(v) => { if (!v) setConfirmDel(null) }}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader><DialogTitle>Excluir ciclo?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmDel?.nome} — {confirmDel?.periodoRef}</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={delMut.isPending} onClick={() => delMut.mutate(confirmDel!.id)}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tab Avaliações ───────────────────────────────────────────────────────────

function TabAvaliacoes({ canVis, canGerenciar, canAvaliar }: { canVis: boolean; canGerenciar: boolean; canAvaliar: boolean }) {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCiclo, setFilterCiclo] = useState('')
  const [fillModal, setFillModal] = useState<any>(null)
  const [fPontuacao, setFPontuacao] = useState('')
  const [fComentarios, setFComentarios] = useState('')
  const [fPlano, setFPlano] = useState('')

  const { data: ciclos } = useQuery({
    queryKey: ['rh', 'desempenho', 'ciclos', 'all'],
    queryFn: () => api.get('/rh/desempenho/ciclos', { limit: 100 }) as Promise<{ items: any[] }>,
    enabled: canVis,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'desempenho', 'avaliacoes', page, filterStatus, filterCiclo],
    queryFn: () => api.get('/rh/desempenho/avaliacoes', {
      page, limit: 20,
      ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
      ...(filterCiclo ? { cicloId: filterCiclo } : {}),
    }) as Promise<{ items: any[]; total: number; pages: number }>,
    enabled: canVis,
  })

  const fillMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.put(`/rh/desempenho/avaliacoes/${id}`, body),
    onSuccess: () => {
      toast.success('Avaliação salva')
      setFillModal(null)
      qc.invalidateQueries({ queryKey: ['rh', 'desempenho', 'avaliacoes'] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  function openFill(av: any) {
    setFPontuacao(av.pontuacaoTotal?.toString() ?? '')
    setFComentarios(av.comentarios ?? '')
    setFPlano(av.planoDesenvolvimento ?? '')
    setFillModal(av)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={filterCiclo} onValueChange={(v) => { setFilterCiclo(v); setPage(1) }}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todos os ciclos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {ciclos?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.entries(STATUS_AVAL_CONFIG) as [StatusAvaliacao, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground border rounded-xl border-dashed">
          <TrendingUp className="h-8 w-8 opacity-30" /><p className="text-sm">Nenhuma avaliação</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.items.map((av: any) => {
            const stCfg = STATUS_AVAL_CONFIG[av.status as StatusAvaliacao] ?? { label: av.status, color: '' }
            return (
              <div key={av.id} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{av.colaborador?.nome}</span>
                    <span className="text-xs bg-muted/30 px-2 py-0.5 rounded">{TIPO_AVAL_LABELS[av.tipo as TipoAvaliacao] ?? av.tipo}</span>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', stCfg.color)}>{stCfg.label}</span>
                    {av.pontuacaoTotal !== null && av.pontuacaoTotal !== undefined && (
                      <span className="text-xs text-muted-foreground">{av.pontuacaoTotal} pts</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                    <span>Ciclo: {av.ciclo?.nome}</span>
                    {av.avaliador && <span>Avaliador: {av.avaliador.nome}</span>}
                    {av.dataEnvio && <span>Enviado: {fmtDate(av.dataEnvio)}</span>}
                  </div>
                </div>
                {(canAvaliar || canGerenciar) && !['concluida', 'cancelada'].includes(av.status) && (
                  <Button size="sm" variant="outline" onClick={() => openFill(av)}>Preencher</Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(data?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Página {page} de {data?.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Modal preencher avaliação */}
      <Dialog open={!!fillModal} onOpenChange={(v) => { if (!v) setFillModal(null) }}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle>Preencher Avaliação</DialogTitle>
            </DialogHeader>
            {fillModal && (
              <p className="text-xs text-muted-foreground mt-1">
                {fillModal.colaborador?.nome} · {TIPO_AVAL_LABELS[fillModal.tipo as TipoAvaliacao]}
                {fillModal.avaliador ? ` · Avaliador: ${fillModal.avaliador.nome}` : ''}
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
            <div className="space-y-2">
              <Label>Pontuação (0–100)</Label>
              <Input type="number" min="0" max="100" value={fPontuacao} onChange={(e) => setFPontuacao(e.target.value)} placeholder="Ex: 85" />
            </div>
            <div className="space-y-2">
              <Label>Comentários gerais</Label>
              <Textarea value={fComentarios} onChange={(e) => setFComentarios(e.target.value)} rows={3} placeholder="Pontos fortes, observações..." />
            </div>
            <div className="space-y-2">
              <Label>Plano de desenvolvimento</Label>
              <Textarea value={fPlano} onChange={(e) => setFPlano(e.target.value)} rows={3} placeholder="Ações de desenvolvimento sugeridas..." />
            </div>
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setFillModal(null)}>Cancelar</Button>
            <Button variant="outline" disabled={fillMut.isPending}
              onClick={() => fillMut.mutate({ id: fillModal!.id, body: { status: 'em_andamento', pontuacaoTotal: fPontuacao ? Number(fPontuacao) : undefined, comentarios: fComentarios || undefined, planoDesenvolvimento: fPlano || undefined } })}>
              Salvar rascunho
            </Button>
            <Button disabled={fillMut.isPending}
              onClick={() => fillMut.mutate({ id: fillModal!.id, body: { status: 'concluida', pontuacaoTotal: fPontuacao ? Number(fPontuacao) : undefined, comentarios: fComentarios || undefined, planoDesenvolvimento: fPlano || undefined } })}>
              {fillMut.isPending ? 'Enviando...' : 'Concluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tab Metas ────────────────────────────────────────────────────────────────

function TabMetas({ canVis, canGerenciar }: { canVis: boolean; canGerenciar: boolean }) {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterColab, setFilterColab] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [confirmDel, setConfirmDel] = useState<any>(null)

  const [fColab, setFColab] = useState('')
  const [fCiclo, setFCiclo] = useState('')
  const [fTitulo, setFTitulo] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fCategoria, setFCategoria] = useState('')
  const [fIndicador, setFIndicador] = useState('')
  const [fMetaValor, setFMetaValor] = useState('')
  const [fValorAtual, setFValorAtual] = useState('')
  const [fUnidade, setFUnidade] = useState('')
  const [fDataLimite, setFDataLimite] = useState('')
  const [fStatus, setFStatus] = useState<StatusMeta>('em_andamento')

  const { data: colabs } = useQuery({
    queryKey: ['rh', 'colaboradores', 'select'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 200 }) as Promise<{ items: any[] }>,
    enabled: canVis,
  })
  const { data: ciclos } = useQuery({
    queryKey: ['rh', 'desempenho', 'ciclos', 'all'],
    queryFn: () => api.get('/rh/desempenho/ciclos', { limit: 100 }) as Promise<{ items: any[] }>,
    enabled: canVis,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'desempenho', 'metas', page, filterStatus, filterColab],
    queryFn: () => api.get('/rh/desempenho/metas', {
      page, limit: 20,
      ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
      ...(filterColab ? { colaboradorId: filterColab } : {}),
    }) as Promise<{ items: any[]; total: number; pages: number }>,
    enabled: canVis,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['rh', 'desempenho', 'metas'] })

  const saveMut = useMutation({
    mutationFn: (body: any) => editing
      ? api.put(`/rh/desempenho/metas/${editing.id}`, body)
      : api.post('/rh/desempenho/metas', body),
    onSuccess: () => { toast.success('Meta salva'); closeModal(); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api.delete(`/rh/desempenho/metas/${id}`),
    onSuccess: () => { toast.success('Meta excluída'); setConfirmDel(null); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  function openCreate() { resetForm(); setEditing(null); setModal(true) }
  function openEdit(m: any) {
    setFColab(m.colaborador?.id ?? ''); setFCiclo(m.ciclo?.id ?? '')
    setFTitulo(m.titulo); setFDesc(m.descricao ?? ''); setFCategoria(m.categoria ?? '')
    setFIndicador(m.indicador ?? ''); setFMetaValor(m.metaValor?.toString() ?? '')
    setFValorAtual(m.valorAtual?.toString() ?? '0'); setFUnidade(m.unidade ?? '')
    setFDataLimite(m.dataLimite ? m.dataLimite.slice(0, 10) : '')
    setFStatus(m.status); setEditing(m); setModal(true)
  }
  function closeModal() { setModal(false); setEditing(null); resetForm() }
  function resetForm() { setFColab(''); setFCiclo(''); setFTitulo(''); setFDesc(''); setFCategoria(''); setFIndicador(''); setFMetaValor(''); setFValorAtual('0'); setFUnidade(''); setFDataLimite(''); setFStatus('em_andamento') }

  function handleSubmit() {
    if (!editing && !fColab) return toast.error('Selecione o colaborador')
    if (!fTitulo) return toast.error('Informe o título da meta')
    const body: any = {
      titulo: fTitulo, descricao: fDesc || undefined,
      categoria: fCategoria || undefined, indicador: fIndicador || undefined,
      metaValor: fMetaValor ? Number(fMetaValor) : undefined,
      valorAtual: fValorAtual ? Number(fValorAtual) : undefined,
      unidade: fUnidade || undefined,
      dataLimite: fDataLimite || undefined, status: fStatus,
      cicloId: fCiclo || undefined,
    }
    if (!editing) body.colaboradorId = fColab
    saveMut.mutate(body)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={filterColab} onValueChange={(v) => { setFilterColab(v); setPage(1) }}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todos os colaboradores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {colabs?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.entries(STATUS_META_CONFIG) as [StatusMeta, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {canGerenciar && <Button className="ml-auto" onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nova Meta</Button>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground border rounded-xl border-dashed">
          <Target className="h-8 w-8 opacity-30" /><p className="text-sm">Nenhuma meta cadastrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.items.map((meta: any) => {
            const stCfg = STATUS_META_CONFIG[meta.status as StatusMeta] ?? { label: meta.status, color: '' }
            return (
              <div key={meta.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{meta.colaborador?.nome}</span>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', stCfg.color)}>{stCfg.label}</span>
                      {meta.categoria && <span className="text-xs bg-muted/30 px-2 py-0.5 rounded">{meta.categoria}</span>}
                    </div>
                    <p className="text-sm font-medium mt-1">{meta.titulo}</p>
                    {meta.indicador && <p className="text-xs text-muted-foreground mt-0.5">Indicador: {meta.indicador}</p>}
                    {meta.metaValor !== null && (
                      <ProgressBar value={meta.valorAtual} meta={meta.metaValor} />
                    )}
                    {(!meta.metaValor && meta.dataLimite) && <p className="text-xs text-muted-foreground mt-1">Prazo: {fmtDate(meta.dataLimite)}</p>}
                  </div>
                  {canGerenciar && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(meta)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setConfirmDel(meta)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(data?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Página {page} de {data?.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Modal meta */}
      <Dialog open={modal} onOpenChange={(v) => { if (!v) closeModal() }}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>{editing ? 'Editar Meta' : 'Nova Meta'}</DialogTitle></DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
            {!editing && (
              <div className="space-y-2">
                <Label>Colaborador *</Label>
                <Select value={fColab} onValueChange={setFColab}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{colabs?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.matricula}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Ciclo (opcional)</Label>
              <Select value={fCiclo} onValueChange={setFCiclo}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {ciclos?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Título *</Label><Input value={fTitulo} onChange={(e) => setFTitulo(e.target.value)} placeholder="Ex: Aumentar vendas em 20%" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Categoria</Label><Input value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} placeholder="Ex: Vendas" /></div>
              <div className="space-y-2"><Label>Unidade</Label><Input value={fUnidade} onChange={(e) => setFUnidade(e.target.value)} placeholder="%, R$, qtd..." /></div>
            </div>
            <div className="space-y-2"><Label>Indicador</Label><Input value={fIndicador} onChange={(e) => setFIndicador(e.target.value)} placeholder="Como será medido..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Meta (valor)</Label><Input type="number" value={fMetaValor} onChange={(e) => setFMetaValor(e.target.value)} /></div>
              <div className="space-y-2"><Label>Valor atual</Label><Input type="number" value={fValorAtual} onChange={(e) => setFValorAtual(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Prazo</Label><Input type="date" value={fDataLimite} onChange={(e) => setFDataLimite(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={fStatus} onValueChange={(v) => setFStatus(v as StatusMeta)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.entries(STATUS_META_CONFIG) as [StatusMeta, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={2} /></div>
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button disabled={saveMut.isPending} onClick={handleSubmit}>{saveMut.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDel} onOpenChange={(v) => { if (!v) setConfirmDel(null) }}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader><DialogTitle>Excluir meta?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmDel?.titulo}</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={delMut.isPending} onClick={() => delMut.mutate(confirmDel!.id)}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DesempenhoPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const [tab, setTab] = useState<Tab>('dashboard')

  const canVis       = isFullAccess || isGerenteGeral() || hasPermission('rh_desempenho', 'visualizar')
  const canAvaliar   = isFullAccess || isGerenteGeral() || hasPermission('rh_desempenho', 'avaliar')
  const canGerenciar = isFullAccess || isGerenteGeral() || hasPermission('rh_desempenho', 'gerenciar')

  if (!canVis) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Sem permissão para acessar a Gestão de Desempenho.</p>
      </div>
    )
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'dashboard',  label: 'Visão Geral' },
    { id: 'ciclos',     label: 'Ciclos' },
    { id: 'avaliacoes', label: 'Avaliações' },
    { id: 'metas',      label: 'Metas' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Desempenho</h1>
        <p className="text-muted-foreground text-sm mt-1">Ciclos de avaliação, metas e PDI dos colaboradores</p>
      </div>

      <div className="flex gap-1 border-b border-border/50 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}>{t.label}</button>
        ))}
      </div>

      {tab === 'dashboard'  && <TabDashboard canVis={canVis} />}
      {tab === 'ciclos'     && <TabCiclos canVis={canVis} canGerenciar={canGerenciar} />}
      {tab === 'avaliacoes' && <TabAvaliacoes canVis={canVis} canGerenciar={canGerenciar} canAvaliar={canAvaliar} />}
      {tab === 'metas'      && <TabMetas canVis={canVis} canGerenciar={canGerenciar} />}
    </div>
  )
}
