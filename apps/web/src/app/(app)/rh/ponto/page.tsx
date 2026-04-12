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
  Clock, Plus, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Calendar, Users, ChevronLeft, ChevronRight, Settings2, Pencil,
  ClipboardList, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoRegistro = 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida' | 'entrada_extra' | 'saida_extra'
type StatusRegistro = 'normal' | 'ajustado' | 'pendente'
type TipoOcorrencia = 'falta' | 'atraso' | 'saida_antecipada' | 'hora_extra' | 'feriado' | 'atestado' | 'afastamento' | 'folga_compensatoria'
type StatusFechamento = 'aberto' | 'fechado' | 'aprovado'

const TIPO_REGISTRO_LABELS: Record<TipoRegistro, string> = {
  entrada: 'Entrada', saida_almoco: 'Saída Almoço', retorno_almoco: 'Retorno Almoço',
  saida: 'Saída', entrada_extra: 'Entrada Extra', saida_extra: 'Saída Extra',
}
const OCORRENCIA_LABELS: Record<TipoOcorrencia, string> = {
  falta: 'Falta', atraso: 'Atraso', saida_antecipada: 'Saída Antecipada', hora_extra: 'Hora Extra',
  feriado: 'Feriado', atestado: 'Atestado', afastamento: 'Afastamento', folga_compensatoria: 'Folga Compensatória',
}
const STATUS_FECHAMENTO_CONFIG: Record<StatusFechamento, { label: string; color: string }> = {
  aberto:   { label: 'Aberto',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  fechado:  { label: 'Fechado',  color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  aprovado: { label: 'Aprovado', color: 'bg-green-500/15 text-green-400 border-green-500/20' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—' }
function fmtDateTime(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtMin(m: number) {
  const h = Math.floor(m / 60), min = m % 60
  return `${h}h${min.toString().padStart(2, '0')}`
}
function currentCompetencia() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

function TabDashboard({ canVis }: { canVis: boolean }) {
  const [colab, setColab] = useState('')
  const hoje = new Date().toISOString().slice(0, 10)

  const { data: colabs } = useQuery({
    queryKey: ['rh', 'colaboradores', 'select'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 200 }) as Promise<{ items: any[] }>,
    enabled: canVis,
  })

  const { data: dash, isLoading } = useQuery({
    queryKey: ['rh', 'ponto', 'dashboard', colab],
    queryFn: () => api.get('/rh/ponto/dashboard', colab ? { colaboradorId: colab } : {}) as Promise<any>,
    enabled: canVis,
    refetchInterval: 60000,
  })

  const { data: diaData } = useQuery({
    queryKey: ['rh', 'ponto', 'dia', colab, hoje],
    queryFn: () => api.get('/rh/ponto/registros/dia', { data: hoje, ...(colab ? { colaboradorId: colab } : {}) }) as Promise<any[]>,
    enabled: canVis,
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-5">
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex-1 min-w-48">
          <Select value={colab} onValueChange={setColab}>
            <SelectTrigger><SelectValue placeholder="Todos os colaboradores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {colabs?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.matricula}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">Atualiza a cada minuto</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Cards resumo */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Presentes hoje</p>
              <p className="text-3xl font-bold mt-1 text-green-400">{dash?.presentesHoje ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Ausentes / Faltas</p>
              <p className="text-3xl font-bold mt-1 text-red-400">{dash?.ausentesHoje ?? 0}</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">Ajustes pendentes</p>
              <p className="text-3xl font-bold mt-1 text-amber-400">{dash?.ajustesPendentes ?? 0}</p>
            </div>
          </div>

          {/* Registros do dia */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Registros de hoje — {fmtDate(hoje + 'T00:00:00.000Z')}</h3>
            {!diaData?.length ? (
              <div className="text-sm text-muted-foreground py-6 text-center border rounded-xl border-dashed">Nenhum registro hoje</div>
            ) : (
              <div className="space-y-1.5">
                {diaData.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-mono text-xs bg-muted/30 px-2 py-0.5 rounded">{new Date(r.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-xs bg-muted/30 px-2 py-0.5 rounded">{TIPO_REGISTRO_LABELS[r.tipo as TipoRegistro] ?? r.tipo}</span>
                    {r.colaborador && <span className="text-muted-foreground">{r.colaborador.nome}</span>}
                    {r.status === 'ajustado' && <span className="ml-auto text-xs text-amber-400">Ajustado</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Tab: Registros ───────────────────────────────────────────────────────────

function TabRegistros({ canVis, canRegistrar, canAjustar }: { canVis: boolean; canRegistrar: boolean; canAjustar: boolean }) {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [filterColab, setFilterColab] = useState('')
  const [filterData, setFilterData] = useState(new Date().toISOString().slice(0, 10))
  const [modal, setModal] = useState(false)
  const [ajusteModal, setAjusteModal] = useState<any>(null)

  // form registro
  const [fColab, setFColab] = useState('')
  const [fTipo, setFTipo] = useState<TipoRegistro | ''>('')
  const [fDataHora, setFDataHora] = useState(new Date().toISOString().slice(0, 16))
  const [fObs, setFObs] = useState('')

  // form ajuste
  const [ajNovaHora, setAjNovaHora] = useState('')
  const [ajMotivo, setAjMotivo] = useState('')

  const { data: colabs } = useQuery({
    queryKey: ['rh', 'colaboradores', 'select'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 200 }) as Promise<{ items: any[] }>,
    enabled: canVis,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'ponto', 'registros', page, filterColab, filterData],
    queryFn: () => api.get('/rh/ponto/registros', {
      page, limit: 30,
      ...(filterColab ? { colaboradorId: filterColab } : {}),
      ...(filterData ? { data: filterData } : {}),
    }) as Promise<{ items: any[]; total: number; pages: number }>,
    enabled: canVis,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['rh', 'ponto'] })

  const saveMut = useMutation({
    mutationFn: (body: any) => api.post('/rh/ponto/registros', body),
    onSuccess: () => { toast.success('Registro criado'); setModal(false); resetForm(); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const ajusteMut = useMutation({
    mutationFn: (body: any) => api.post('/rh/ponto/ajustes', body),
    onSuccess: () => { toast.success('Ajuste solicitado'); setAjusteModal(null); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  function resetForm() { setFColab(''); setFTipo(''); setFDataHora(new Date().toISOString().slice(0, 16)); setFObs('') }

  function handleSubmit() {
    if (!fColab) return toast.error('Selecione o colaborador')
    if (!fTipo) return toast.error('Selecione o tipo')
    if (!fDataHora) return toast.error('Informe data e hora')
    saveMut.mutate({ colaboradorId: fColab, tipo: fTipo, dataHora: new Date(fDataHora).toISOString(), observacoes: fObs || undefined })
  }

  function handleAjuste() {
    if (!ajNovaHora) return toast.error('Informe a nova hora')
    if (!ajMotivo) return toast.error('Informe o motivo')
    ajusteMut.mutate({ registroPontoId: ajusteModal.id, novaDataHora: new Date(ajNovaHora).toISOString(), motivo: ajMotivo })
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <Select value={filterColab} onValueChange={(v) => { setFilterColab(v); setPage(1) }}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todos os colaboradores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {colabs?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={filterData} onChange={(e) => { setFilterData(e.target.value); setPage(1) }} className="w-40" />
        <div className="ml-auto">
          {canRegistrar && <Button onClick={() => setModal(true)}><Plus className="h-4 w-4 mr-2" /> Registrar Ponto</Button>}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground border rounded-xl border-dashed">
          <Clock className="h-8 w-8 opacity-30" /><p className="text-sm">Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {data!.items.map((r: any) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
              <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.colaborador && <span className="font-medium">{r.colaborador.nome}</span>}
                  <span className="text-xs bg-muted/30 px-2 py-0.5 rounded">{TIPO_REGISTRO_LABELS[r.tipo as TipoRegistro] ?? r.tipo}</span>
                  {r.status === 'ajustado' && <span className="text-xs text-amber-400">Ajustado</span>}
                  {r.status === 'pendente' && <span className="text-xs text-red-400">Pendente</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(r.dataHora)}{r.observacoes ? ` — ${r.observacoes}` : ''}</p>
              </div>
              {canAjustar && (
                <Button size="sm" variant="ghost" onClick={() => { setAjusteModal(r); setAjNovaHora(new Date(r.dataHora).toISOString().slice(0, 16)); setAjMotivo('') }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {(data?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Página {page} de {data?.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Modal novo registro */}
      <Dialog open={modal} onOpenChange={(v) => { if (!v) { setModal(false); resetForm() } }}>
        <DialogContent className="max-w-md flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>Registrar Ponto Manual</DialogTitle></DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
            <div className="space-y-2">
              <Label>Colaborador *</Label>
              <Select value={fColab} onValueChange={setFColab}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colabs?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.matricula}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={fTipo} onValueChange={(v) => setFTipo(v as TipoRegistro)}>
                <SelectTrigger><SelectValue placeholder="Tipo de registro" /></SelectTrigger>
                <SelectContent>{(Object.entries(TIPO_REGISTRO_LABELS) as [TipoRegistro, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data e Hora *</Label>
              <Input type="datetime-local" value={fDataHora} onChange={(e) => setFDataHora(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} placeholder="Motivo do registro manual..." />
            </div>
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setModal(false); resetForm() }}>Cancelar</Button>
            <Button disabled={saveMut.isPending} onClick={handleSubmit}>{saveMut.isPending ? 'Salvando...' : 'Registrar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal ajuste */}
      <Dialog open={!!ajusteModal} onOpenChange={(v) => { if (!v) setAjusteModal(null) }}>
        <DialogContent className="max-w-sm flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>Solicitar Ajuste</DialogTitle></DialogHeader>
          </div>
          {ajusteModal && (
            <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
              <p className="text-xs text-muted-foreground">
                Registro original: {TIPO_REGISTRO_LABELS[ajusteModal.tipo as TipoRegistro]} em {fmtDateTime(ajusteModal.dataHora)}
              </p>
              <div className="space-y-2">
                <Label>Nova data/hora *</Label>
                <Input type="datetime-local" value={ajNovaHora} onChange={(e) => setAjNovaHora(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Textarea value={ajMotivo} onChange={(e) => setAjMotivo(e.target.value)} rows={2} placeholder="Descreva o motivo do ajuste..." />
              </div>
            </div>
          )}
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setAjusteModal(null)}>Cancelar</Button>
            <Button disabled={ajusteMut.isPending} onClick={handleAjuste}>{ajusteMut.isPending ? 'Enviando...' : 'Solicitar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tab: Ajustes ─────────────────────────────────────────────────────────────

function TabAjustes({ canVis, canAprovar }: { canVis: boolean; canAprovar: boolean }) {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('pendente')
  const [aprovModal, setAprovModal] = useState<any>(null)
  const [obsAprov, setObsAprov] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'ponto', 'ajustes', page, filterStatus],
    queryFn: () => api.get('/rh/ponto/ajustes', {
      page, limit: 30,
      ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
    }) as Promise<{ items: any[]; total: number; pages: number }>,
    enabled: canVis,
  })

  const aprovMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/rh/ponto/ajustes/${id}/aprovar`, body),
    onSuccess: () => { toast.success('Decisão registrada'); setAprovModal(null); qc.invalidateQueries({ queryKey: ['rh', 'ponto', 'ajustes'] }) },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  function handleDecisao(aprovado: boolean) {
    aprovMut.mutate({ id: aprovModal.id, body: { aprovado, observacoes: obsAprov || undefined } })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="rejeitado">Rejeitado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground border rounded-xl border-dashed">
          <ClipboardList className="h-8 w-8 opacity-30" /><p className="text-sm">Nenhum ajuste encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.items.map((aj: any) => (
            <div key={aj.id} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{aj.colaborador?.nome ?? '—'}</span>
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
                    aj.status === 'pendente' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
                    aj.status === 'aprovado' ? 'bg-green-500/15 text-green-400 border-green-500/20' :
                    'bg-red-500/15 text-red-400 border-red-500/20'
                  )}>{aj.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmtDateTime(aj.dataHoraOriginal)} → {fmtDateTime(aj.novaDataHora)} — {aj.motivo}
                </p>
                {aj.observacoes && <p className="text-xs text-muted-foreground mt-0.5 italic">{aj.observacoes}</p>}
              </div>
              {canAprovar && aj.status === 'pendente' && (
                <Button size="sm" variant="outline" onClick={() => { setAprovModal(aj); setObsAprov('') }}>
                  Analisar
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {(data?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Página {page} de {data?.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Modal aprovação */}
      <Dialog open={!!aprovModal} onOpenChange={(v) => { if (!v) setAprovModal(null) }}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader><DialogTitle>Analisar Ajuste</DialogTitle></DialogHeader>
          {aprovModal && (
            <div className="space-y-3 mt-2">
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Colaborador:</span> {aprovModal.colaborador?.nome}</p>
                <p><span className="text-muted-foreground">Original:</span> {fmtDateTime(aprovModal.dataHoraOriginal)}</p>
                <p><span className="text-muted-foreground">Nova hora:</span> {fmtDateTime(aprovModal.novaDataHora)}</p>
                <p><span className="text-muted-foreground">Motivo:</span> {aprovModal.motivo}</p>
              </div>
              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Textarea value={obsAprov} onChange={(e) => setObsAprov(e.target.value)} rows={2} placeholder="Comentário sobre a decisão..." />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setAprovModal(null)}>Cancelar</Button>
                <Button variant="destructive" disabled={aprovMut.isPending} onClick={() => handleDecisao(false)}>
                  <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                </Button>
                <Button disabled={aprovMut.isPending} onClick={() => handleDecisao(true)}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tab: Ocorrências ─────────────────────────────────────────────────────────

function TabOcorrencias({ canVis, canGerenciar }: { canVis: boolean; canGerenciar: boolean }) {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [filterColab, setFilterColab] = useState('')
  const [filterTipo, setFilterTipo] = useState('all')
  const [modal, setModal] = useState(false)
  const [confirmDel, setConfirmDel] = useState<any>(null)

  const [fColab, setFColab] = useState('')
  const [fTipo, setFTipo] = useState<TipoOcorrencia | ''>('')
  const [fData, setFData] = useState(new Date().toISOString().slice(0, 10))
  const [fMinutos, setFMinutos] = useState('')
  const [fObs, setFObs] = useState('')
  const [fJustificativa, setFJustificativa] = useState('')

  const { data: colabs } = useQuery({
    queryKey: ['rh', 'colaboradores', 'select'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 200 }) as Promise<{ items: any[] }>,
    enabled: canVis,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'ponto', 'ocorrencias', page, filterColab, filterTipo],
    queryFn: () => api.get('/rh/ponto/ocorrencias', {
      page, limit: 30,
      ...(filterColab ? { colaboradorId: filterColab } : {}),
      ...(filterTipo !== 'all' ? { tipo: filterTipo } : {}),
    }) as Promise<{ items: any[]; total: number; pages: number }>,
    enabled: canVis,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['rh', 'ponto', 'ocorrencias'] })

  const saveMut = useMutation({
    mutationFn: (body: any) => api.post('/rh/ponto/ocorrencias', body),
    onSuccess: () => { toast.success('Ocorrência registrada'); setModal(false); resetForm(); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api.delete(`/rh/ponto/ocorrencias/${id}`),
    onSuccess: () => { toast.success('Excluída'); setConfirmDel(null); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  function resetForm() { setFColab(''); setFTipo(''); setFData(new Date().toISOString().slice(0, 10)); setFMinutos(''); setFObs(''); setFJustificativa('') }

  function handleSubmit() {
    if (!fColab) return toast.error('Selecione o colaborador')
    if (!fTipo) return toast.error('Selecione o tipo')
    if (!fData) return toast.error('Informe a data')
    saveMut.mutate({
      colaboradorId: fColab,
      tipo: fTipo,
      data: new Date(fData).toISOString(),
      minutosImpacto: fMinutos ? Number(fMinutos) : undefined,
      observacoes: fObs || undefined,
      justificativa: fJustificativa || undefined,
    })
  }

  const OCOR_COLORS: Record<string, string> = {
    falta: 'bg-red-500/15 text-red-400 border-red-500/20',
    atraso: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    hora_extra: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    atestado: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={filterColab} onValueChange={(v) => { setFilterColab(v); setPage(1) }}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {colabs?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(1) }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.entries(OCORRENCIA_LABELS) as [TipoOcorrencia, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {canGerenciar && (
          <Button className="ml-auto" onClick={() => setModal(true)}><Plus className="h-4 w-4 mr-2" /> Nova Ocorrência</Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground border rounded-xl border-dashed">
          <AlertCircle className="h-8 w-8 opacity-30" /><p className="text-sm">Nenhuma ocorrência</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.items.map((oc: any) => (
            <div key={oc.id} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{oc.colaborador?.nome ?? '—'}</span>
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border',
                    OCOR_COLORS[oc.tipo] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20'
                  )}>{OCORRENCIA_LABELS[oc.tipo as TipoOcorrencia] ?? oc.tipo}</span>
                  {oc.minutosImpacto && <span className="text-xs text-muted-foreground">{fmtMin(oc.minutosImpacto)}</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{fmtDate(oc.data)}{oc.observacoes ? ` — ${oc.observacoes}` : ''}</p>
              </div>
              {canGerenciar && (
                <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setConfirmDel(oc)}>Excluir</Button>
              )}
            </div>
          ))}
        </div>
      )}

      {(data?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm text-muted-foreground">Página {page} de {data?.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Modal nova ocorrência */}
      <Dialog open={modal} onOpenChange={(v) => { if (!v) { setModal(false); resetForm() } }}>
        <DialogContent className="max-w-md flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>Nova Ocorrência</DialogTitle></DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
            <div className="space-y-2">
              <Label>Colaborador *</Label>
              <Select value={fColab} onValueChange={setFColab}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colabs?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.matricula}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={fTipo} onValueChange={(v) => setFTipo(v as TipoOcorrencia)}>
                <SelectTrigger><SelectValue placeholder="Tipo de ocorrência" /></SelectTrigger>
                <SelectContent>{(Object.entries(OCORRENCIA_LABELS) as [TipoOcorrencia, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data *</Label><Input type="date" value={fData} onChange={(e) => setFData(e.target.value)} /></div>
              <div className="space-y-2"><Label>Minutos de impacto</Label><Input type="number" value={fMinutos} onChange={(e) => setFMinutos(e.target.value)} placeholder="ex: 30" /></div>
            </div>
            <div className="space-y-2"><Label>Justificativa</Label><Input value={fJustificativa} onChange={(e) => setFJustificativa(e.target.value)} placeholder="Documento / protocolo..." /></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} /></div>
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setModal(false); resetForm() }}>Cancelar</Button>
            <Button disabled={saveMut.isPending} onClick={handleSubmit}>{saveMut.isPending ? 'Salvando...' : 'Registrar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDel} onOpenChange={(v) => { if (!v) setConfirmDel(null) }}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader><DialogTitle>Excluir ocorrência?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmDel?.colaborador?.nome} — {confirmDel?.tipo ? (OCORRENCIA_LABELS as Record<string, string>)[confirmDel.tipo] ?? '' : ''} em {fmtDate(confirmDel?.data)}</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={delMut.isPending} onClick={() => delMut.mutate(confirmDel!.id)}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tab: Fechamento ──────────────────────────────────────────────────────────

function TabFechamento({ canVis, canFechar, canAprovar }: { canVis: boolean; canFechar: boolean; canAprovar: boolean }) {
  const qc = useQueryClient()
  const [competencia, setCompetencia] = useState(currentCompetencia())
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [aprovModal, setAprovModal] = useState<any>(null)
  const [obsAprov, setObsAprov] = useState('')
  const [gerarModal, setGerarModal] = useState(false)
  const [gerarColab, setGerarColab] = useState('')
  const [gerarLote, setGerarLote] = useState(false)

  const { data: colabs } = useQuery({
    queryKey: ['rh', 'colaboradores', 'select'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 200 }) as Promise<{ items: any[] }>,
    enabled: canVis,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'ponto', 'fechamento', page, competencia, filterStatus],
    queryFn: () => api.get('/rh/ponto/fechamento', {
      page, limit: 30, competencia,
      ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
    }) as Promise<{ items: any[]; total: number; pages: number }>,
    enabled: canVis,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['rh', 'ponto', 'fechamento'] })

  const gerarMut = useMutation({
    mutationFn: (body: any) => gerarLote
      ? api.post('/rh/ponto/fechamento/gerar-lote', body)
      : api.post('/rh/ponto/fechamento/gerar', body),
    onSuccess: (res: any) => {
      toast.success(gerarLote ? `${res.gerados ?? 0} fechamentos gerados` : 'Fechamento gerado')
      setGerarModal(false); setGerarColab(''); setGerarLote(false); invalidate()
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const aprovMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/rh/ponto/fechamento/${id}/aprovar`, body),
    onSuccess: () => { toast.success('Fechamento aprovado'); setAprovModal(null); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  function handleGerar() {
    if (!gerarLote && !gerarColab) return toast.error('Selecione o colaborador')
    gerarMut.mutate(gerarLote ? { competencia } : { colaboradorId: gerarColab, competencia })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap items-center">
        <Input type="month" value={competencia} onChange={(e) => { setCompetencia(e.target.value); setPage(1) }} className="w-44" />
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1) }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.entries(STATUS_FECHAMENTO_CONFIG) as [StatusFechamento, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {canFechar && (
          <Button className="ml-auto" onClick={() => { setGerarModal(true); setGerarColab(''); setGerarLote(false) }}>
            <Calendar className="h-4 w-4 mr-2" /> Gerar Fechamento
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground border rounded-xl border-dashed">
          <Calendar className="h-8 w-8 opacity-30" /><p className="text-sm">Nenhum fechamento para {competencia}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.items.map((fc: any) => {
            const stCfg = STATUS_FECHAMENTO_CONFIG[fc.status as StatusFechamento] ?? { label: fc.status, color: '' }
            return (
              <div key={fc.id} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{fc.colaborador?.nome ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">{fc.colaborador?.matricula}</span>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', stCfg.color)}>{stCfg.label}</span>
                  </div>
                  <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    <span>Trabalhado: <span className="text-foreground font-medium">{fmtMin(fc.totalMinutosTrabalhados ?? 0)}</span></span>
                    <span>Esperado: <span className="text-foreground font-medium">{fmtMin(fc.totalMinutosEsperados ?? 0)}</span></span>
                    <span>H. Extra: <span className={cn('font-medium', (fc.totalHorasExtras ?? 0) > 0 ? 'text-blue-400' : '')}>{fmtMin(fc.totalHorasExtras ?? 0)}</span></span>
                    <span>Faltas: <span className={cn('font-medium', fc.diasFalta > 0 ? 'text-red-400' : '')}>{fc.diasFalta ?? 0}d</span></span>
                  </div>
                </div>
                {canAprovar && fc.status === 'fechado' && (
                  <Button size="sm" variant="outline" onClick={() => { setAprovModal(fc); setObsAprov('') }}>Aprovar</Button>
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

      {/* Modal gerar fechamento */}
      <Dialog open={gerarModal} onOpenChange={(v) => { if (!v) setGerarModal(false) }}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader><DialogTitle>Gerar Fechamento</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="lote" checked={gerarLote} onChange={(e) => setGerarLote(e.target.checked)} className="rounded" />
              <label htmlFor="lote" className="text-sm cursor-pointer">Gerar para todos os colaboradores</label>
            </div>
            {!gerarLote && (
              <div className="space-y-2">
                <Label>Colaborador *</Label>
                <Select value={gerarColab} onValueChange={setGerarColab}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{colabs?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.matricula}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Competência: {competencia}</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setGerarModal(false)}>Cancelar</Button>
              <Button disabled={gerarMut.isPending} onClick={handleGerar}>{gerarMut.isPending ? 'Gerando...' : 'Gerar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal aprovar fechamento */}
      <Dialog open={!!aprovModal} onOpenChange={(v) => { if (!v) setAprovModal(null) }}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader><DialogTitle>Aprovar Fechamento</DialogTitle></DialogHeader>
          {aprovModal && (
            <div className="space-y-3 mt-2">
              <p className="text-sm">{aprovModal.colaborador?.nome} — {aprovModal.competencia}</p>
              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea value={obsAprov} onChange={(e) => setObsAprov(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button variant="outline" onClick={() => setAprovModal(null)}>Cancelar</Button>
                <Button disabled={aprovMut.isPending} onClick={() => aprovMut.mutate({ id: aprovModal.id, body: { observacoes: obsAprov || undefined } })}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Escala Modal ─────────────────────────────────────────────────────────────

function EscalaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [colab, setColab] = useState('')
  const [entrada, setEntrada] = useState('08:00')
  const [inicioAlmoco, setInicioAlmoco] = useState('12:00')
  const [fimAlmoco, setFimAlmoco] = useState('13:00')
  const [saida, setSaida] = useState('17:00')
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5])
  const [cargaHoraria, setCargaHoraria] = useState('44')

  const { data: colabs } = useQuery({
    queryKey: ['rh', 'colaboradores', 'select'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 200 }) as Promise<{ items: any[] }>,
    enabled: open,
  })

  const saveMut = useMutation({
    mutationFn: (body: any) => api.post('/rh/ponto/escala', body),
    onSuccess: () => { toast.success('Escala configurada'); onClose(); qc.invalidateQueries({ queryKey: ['rh', 'ponto'] }) },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  function toggleDia(d: number) {
    setDiasSemana(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  function handleSubmit() {
    if (!colab) return toast.error('Selecione o colaborador')
    if (!diasSemana.length) return toast.error('Selecione ao menos um dia')
    saveMut.mutate({
      colaboradorId: colab,
      horarioEntrada: entrada,
      inicioAlmoco,
      fimAlmoco,
      horarioSaida: saida,
      diasSemana,
      cargaHorariaSemanal: Number(cargaHoraria),
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md flex flex-col max-h-[90dvh] overflow-hidden p-0">
        <div className="shrink-0 px-6 pt-6 pb-4">
          <DialogHeader><DialogTitle>Configurar Escala de Trabalho</DialogTitle></DialogHeader>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
          <div className="space-y-2">
            <Label>Colaborador *</Label>
            <Select value={colab} onValueChange={setColab}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{colabs?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.matricula}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dias da semana *</Label>
            <div className="flex gap-2 flex-wrap">
              {DIAS.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDia(i)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    diasSemana.includes(i)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >{d}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Entrada</Label><Input type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} /></div>
            <div className="space-y-2"><Label>Saída</Label><Input type="time" value={saida} onChange={(e) => setSaida(e.target.value)} /></div>
            <div className="space-y-2"><Label>Início almoço</Label><Input type="time" value={inicioAlmoco} onChange={(e) => setInicioAlmoco(e.target.value)} /></div>
            <div className="space-y-2"><Label>Fim almoço</Label><Input type="time" value={fimAlmoco} onChange={(e) => setFimAlmoco(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Carga horária semanal (h)</Label>
            <Input type="number" value={cargaHoraria} onChange={(e) => setCargaHoraria(e.target.value)} className="w-32" />
          </div>
        </div>
        <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={saveMut.isPending} onClick={handleSubmit}>{saveMut.isPending ? 'Salvando...' : 'Salvar Escala'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'registros' | 'ajustes' | 'ocorrencias' | 'fechamento'

export default function PontoPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [escalaModal, setEscalaModal] = useState(false)

  const canVis       = isFullAccess || isGerenteGeral() || hasPermission('rh_ponto', 'visualizar')
  const canRegistrar = isFullAccess || isGerenteGeral() || hasPermission('rh_ponto', 'registrar')
  const canAjustar   = isFullAccess || isGerenteGeral() || hasPermission('rh_ponto', 'ajustar')
  const canAprovar   = isFullAccess || isGerenteGeral() || hasPermission('rh_ponto', 'aprovar')
  const canGerenciar = isFullAccess || isGerenteGeral() || hasPermission('rh_ponto', 'gerenciar')
  const canFechar    = isFullAccess || isGerenteGeral() || hasPermission('rh_ponto', 'fechar')

  if (!canVis) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Sem permissão para acessar o Controle de Ponto.</p>
      </div>
    )
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'dashboard',   label: 'Dashboard' },
    { id: 'registros',   label: 'Registros' },
    { id: 'ajustes',     label: 'Ajustes' },
    { id: 'ocorrencias', label: 'Ocorrências' },
    { id: 'fechamento',  label: 'Fechamento' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Controle de Ponto</h1>
          <p className="text-muted-foreground text-sm mt-1">Registro, ajustes e fechamento de ponto dos colaboradores</p>
        </div>
        <div className="flex gap-2">
          {canGerenciar && (
            <Button variant="outline" onClick={() => setEscalaModal(true)}>
              <Settings2 className="h-4 w-4 mr-2" /> Escalas
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/50 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'dashboard'   && <TabDashboard canVis={canVis} />}
      {tab === 'registros'   && <TabRegistros canVis={canVis} canRegistrar={canRegistrar} canAjustar={canAjustar} />}
      {tab === 'ajustes'     && <TabAjustes canVis={canVis} canAprovar={canAprovar} />}
      {tab === 'ocorrencias' && <TabOcorrencias canVis={canVis} canGerenciar={canGerenciar} />}
      {tab === 'fechamento'  && <TabFechamento canVis={canVis} canFechar={canFechar} canAprovar={canAprovar} />}

      <EscalaModal open={escalaModal} onClose={() => setEscalaModal(false)} />
    </div>
  )
}
