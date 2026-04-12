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
import { Plus, RefreshCw, Stethoscope, AlertCircle, Trash2, Pencil, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type TipoExame = 'admissional' | 'periodico' | 'retorno_trabalho' | 'mudanca_funcao' | 'demissional'
type Resultado = 'apto' | 'apto_com_restricoes' | 'inapto'
type StatusExame = 'agendado' | 'realizado' | 'vencido' | 'cancelado'

const TIPO_LABELS: Record<TipoExame, string> = {
  admissional: 'Admissional', periodico: 'Periódico', retorno_trabalho: 'Retorno ao Trabalho',
  mudanca_funcao: 'Mudança de Função', demissional: 'Demissional',
}
const RESULTADO_CONFIG: Record<Resultado, { label: string; color: string; icon: React.ElementType }> = {
  apto:                { label: 'Apto',                   color: 'bg-green-500/15 text-green-400 border-green-500/20',  icon: CheckCircle },
  apto_com_restricoes: { label: 'Apto c/ Restrições',     color: 'bg-amber-500/15 text-amber-400 border-amber-500/20', icon: AlertTriangle },
  inapto:              { label: 'Inapto',                 color: 'bg-red-500/15 text-red-400 border-red-500/20',        icon: XCircle },
}
const STATUS_CONFIG: Record<StatusExame, { label: string; color: string }> = {
  agendado:  { label: 'Agendado',  color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  realizado: { label: 'Realizado', color: 'bg-green-500/15 text-green-400 border-green-500/20' },
  vencido:   { label: 'Vencido',   color: 'bg-red-500/15 text-red-400 border-red-500/20' },
  cancelado: { label: 'Cancelado', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
}

interface Exame {
  id: string; tipo: TipoExame; dataExame: string; dataVencimento?: string
  medico?: string; crmMedico?: string; resultado?: Resultado; restricoes?: string
  observacoes?: string; arquivoUrl?: string; status: StatusExame
  colaborador: { id: string; nome: string; matricula: string; cargo?: { nome: string }; unit?: { nome: string } }
  agendadoPor: { nome: string }
}

function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—' }
function diasParaVencer(d?: string) {
  if (!d) return null
  return Math.floor((new Date(d).getTime() - Date.now()) / 86400000)
}

export default function AsoPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const qc = useQueryClient()
  const canVis = isFullAccess || isGerenteGeral() || hasPermission('rh_aso', 'visualizar')
  const canCriar = isFullAccess || isGerenteGeral() || hasPermission('rh_aso', 'criar')
  const canEdit = isFullAccess || isGerenteGeral() || hasPermission('rh_aso', 'editar')
  const canDel = isFullAccess || isGerenteGeral() || hasPermission('rh_aso', 'excluir')

  const [filterTipo, setFilterTipo] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Exame | null>(null)
  const [detail, setDetail] = useState<Exame | null>(null)
  const [confirmDel, setConfirmDel] = useState<Exame | null>(null)

  const [fColab, setFColab] = useState('')
  const [fTipo, setFTipo] = useState<TipoExame | ''>('')
  const [fData, setFData] = useState('')
  const [fVenc, setFVenc] = useState('')
  const [fMedico, setFMedico] = useState('')
  const [fCrm, setFCrm] = useState('')
  const [fResultado, setFResultado] = useState<Resultado | ''>('')
  const [fRestricoes, setFRestricoes] = useState('')
  const [fObs, setFObs] = useState('')
  const [fUrl, setFUrl] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'aso', page, filterTipo, filterStatus],
    queryFn: () => api.get('/rh/aso', {
      page, limit: 20,
      ...(filterTipo !== 'all' ? { tipo: filterTipo } : {}),
      ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
    }) as Promise<{ items: Exame[]; total: number; pages: number }>,
    enabled: canVis,
  })

  const { data: alertas } = useQuery({
    queryKey: ['rh', 'aso', 'alertas'],
    queryFn: () => api.get('/rh/aso/alertas/vencimento', { dias: 60 }) as Promise<{ vencendo: any[]; inaptos: any[]; semExameAdmissional: any[] }>,
    enabled: canVis,
  })

  const { data: colabs } = useQuery({
    queryKey: ['rh', 'colaboradores', 'select'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 200 }) as Promise<{ items: any[] }>,
    enabled: modal,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['rh', 'aso'] })

  const saveMut = useMutation({
    mutationFn: (body: any) => editing ? api.put(`/rh/aso/${editing.id}`, body) : api.post('/rh/aso', body),
    onSuccess: () => { toast.success('Exame salvo'); closeModal(); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api.delete(`/rh/aso/${id}`),
    onSuccess: () => { toast.success('Excluído'); setConfirmDel(null); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  function openCreate() { resetForm(); setEditing(null); setModal(true) }
  function openEdit(e: Exame) {
    setFColab(e.colaborador.id); setFTipo(e.tipo)
    setFData(e.dataExame.slice(0, 10)); setFVenc(e.dataVencimento ? e.dataVencimento.slice(0, 10) : '')
    setFMedico(e.medico ?? ''); setFCrm(e.crmMedico ?? '')
    setFResultado(e.resultado ?? ''); setFRestricoes(e.restricoes ?? '')
    setFObs(e.observacoes ?? ''); setFUrl(e.arquivoUrl ?? '')
    setEditing(e); setModal(true)
  }
  function closeModal() { setModal(false); setEditing(null); resetForm() }
  function resetForm() { setFColab(''); setFTipo(''); setFData(''); setFVenc(''); setFMedico(''); setFCrm(''); setFResultado(''); setFRestricoes(''); setFObs(''); setFUrl('') }

  function handleSubmit() {
    if (!editing && !fColab) return toast.error('Selecione o colaborador')
    if (!fTipo) return toast.error('Selecione o tipo de exame')
    if (!fData) return toast.error('Informe a data do exame')
    const body: any = {
      tipo: fTipo, dataExame: new Date(fData).toISOString(),
      dataVencimento: fVenc ? new Date(fVenc).toISOString() : undefined,
      medico: fMedico || undefined, crmMedico: fCrm || undefined,
      resultado: fResultado || undefined, restricoes: fRestricoes || undefined,
      observacoes: fObs || undefined, arquivoUrl: fUrl || undefined,
    }
    if (!editing) body.colaboradorId = fColab
    saveMut.mutate(body)
  }

  if (!canVis) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Sem permissão.</p></div>

  const totalAlertas = (alertas?.vencendo?.length ?? 0) + (alertas?.inaptos?.length ?? 0) + (alertas?.semExameAdmissional?.length ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Exames Ocupacionais (ASO)</h1>
          <p className="text-muted-foreground text-sm mt-1">Controle de ASO e exames de saúde ocupacional</p>
        </div>
        {canCriar && <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Exame</Button>}
      </div>

      {/* Alertas */}
      {totalAlertas > 0 && (
        <div className="grid sm:grid-cols-3 gap-3">
          {(alertas?.vencendo?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-400">{alertas!.vencendo.length} exame(s) vencendo</p>
                <p className="text-xs text-muted-foreground">Próximos 60 dias</p>
              </div>
            </div>
          )}
          {(alertas?.inaptos?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-400">{alertas!.inaptos.length} colaborador(es) inapto(s)</p>
                <p className="text-xs text-muted-foreground">Requer atenção imediata</p>
              </div>
            </div>
          )}
          {(alertas?.semExameAdmissional?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-zinc-500/30 bg-zinc-500/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-zinc-400">{alertas!.semExameAdmissional.length} sem exame admissional</p>
                <p className="text-xs text-muted-foreground">Colaboradores ativos</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(1) }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(Object.entries(TIPO_LABELS) as [TipoExame, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.entries(STATUS_CONFIG) as [StatusExame, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border rounded-xl border-dashed">
          <Stethoscope className="h-10 w-10 opacity-30" /><p className="text-sm">Nenhum exame encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.items.map((exame) => {
            const stCfg = STATUS_CONFIG[exame.status]
            const resCfg = exame.resultado ? RESULTADO_CONFIG[exame.resultado] : null
            const ResIcon = resCfg?.icon
            const dias = diasParaVencer(exame.dataVencimento)
            return (
              <div key={exame.id} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{exame.colaborador.nome}</span>
                    <span className="text-xs text-muted-foreground">{exame.colaborador.matricula}</span>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', stCfg.color)}>{stCfg.label}</span>
                    <span className="text-xs bg-muted/30 px-2 py-0.5 rounded-full">{TIPO_LABELS[exame.tipo]}</span>
                    {resCfg && ResIcon && (
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', resCfg.color)}>
                        <ResIcon className="h-3 w-3" /> {resCfg.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>Exame: {fmtDate(exame.dataExame)}</span>
                    {exame.dataVencimento && (
                      <span className={cn(dias !== null && dias <= 30 && dias >= 0 ? 'text-amber-400' : dias !== null && dias < 0 ? 'text-red-400' : '')}>
                        Vence: {fmtDate(exame.dataVencimento)}
                        {dias !== null && dias <= 30 && dias >= 0 && ` (${dias}d)`}
                        {dias !== null && dias < 0 && ' (vencido)'}
                      </span>
                    )}
                    {exame.medico && <span>Dr(a). {exame.medico}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setDetail(exame)}><Stethoscope className="h-3.5 w-3.5" /></Button>
                  {canEdit && exame.status !== 'cancelado' && (
                    <Button size="sm" variant="ghost" onClick={() => openEdit(exame)}><Pencil className="h-3.5 w-3.5" /></Button>
                  )}
                  {canDel && (
                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setConfirmDel(exame)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(data?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {page} de {data?.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= (data?.pages ?? 1)} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
        </div>
      )}

      {/* Modal criar/editar */}
      <Dialog open={modal} onOpenChange={(v) => { if (!v) closeModal() }}>
        <DialogContent className="max-w-lg flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>{editing ? 'Editar Exame' : 'Novo Exame Ocupacional'}</DialogTitle></DialogHeader>
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
              <Label>Tipo de exame *</Label>
              <Select value={fTipo} onValueChange={(v) => setFTipo(v as TipoExame)}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>{(Object.entries(TIPO_LABELS) as [TipoExame, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data do exame *</Label><Input type="date" value={fData} onChange={(e) => setFData(e.target.value)} /></div>
              <div className="space-y-2"><Label>Data de vencimento</Label><Input type="date" value={fVenc} onChange={(e) => setFVenc(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Médico responsável</Label><Input value={fMedico} onChange={(e) => setFMedico(e.target.value)} placeholder="Dr(a). Nome" /></div>
              <div className="space-y-2"><Label>CRM</Label><Input value={fCrm} onChange={(e) => setFCrm(e.target.value)} placeholder="CRM/SP 00000" /></div>
            </div>
            <div className="space-y-2">
              <Label>Resultado</Label>
              <Select value={fResultado} onValueChange={(v) => setFResultado(v as Resultado)}>
                <SelectTrigger><SelectValue placeholder="Selecione o resultado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="apto">Apto</SelectItem>
                  <SelectItem value="apto_com_restricoes">Apto com Restrições</SelectItem>
                  <SelectItem value="inapto">Inapto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {fResultado === 'apto_com_restricoes' && (
              <div className="space-y-2"><Label>Restrições</Label><Textarea value={fRestricoes} onChange={(e) => setFRestricoes(e.target.value)} rows={2} placeholder="Descreva as restrições..." /></div>
            )}
            <div className="space-y-2"><Label>Observações</Label><Textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} /></div>
            <div className="space-y-2"><Label>URL do laudo (PDF)</Label><Input value={fUrl} onChange={(e) => setFUrl(e.target.value)} placeholder="https://..." /></div>
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button disabled={saveMut.isPending} onClick={handleSubmit}>{saveMut.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalhe */}
      <Dialog open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null) }}>
        <DialogContent className="max-w-md flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>Detalhes do Exame</DialogTitle></DialogHeader>
          </div>
          {detail && (
            <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-3 text-sm">
              <div><p className="font-semibold">{detail.colaborador.nome}</p><p className="text-xs text-muted-foreground">{detail.colaborador.matricula} • {detail.colaborador.cargo?.nome}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Tipo</span><p className="font-medium">{TIPO_LABELS[detail.tipo]}</p></div>
                <div><span className="text-muted-foreground">Status</span><p className={cn('font-medium', STATUS_CONFIG[detail.status].color.split(' ')[1])}>{STATUS_CONFIG[detail.status].label}</p></div>
                <div><span className="text-muted-foreground">Data do exame</span><p className="font-medium">{fmtDate(detail.dataExame)}</p></div>
                <div><span className="text-muted-foreground">Vencimento</span><p className="font-medium">{fmtDate(detail.dataVencimento)}</p></div>
                <div><span className="text-muted-foreground">Médico</span><p className="font-medium">{detail.medico ?? '—'}</p></div>
                <div><span className="text-muted-foreground">CRM</span><p className="font-medium">{detail.crmMedico ?? '—'}</p></div>
              </div>
              {detail.resultado && (
                <div>
                  <span className="text-muted-foreground">Resultado</span>
                  <div className="mt-1">
                    {(() => { const c = RESULTADO_CONFIG[detail.resultado!]; const I = c.icon; return <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', c.color)}><I className="h-3 w-3" />{c.label}</span> })()}
                  </div>
                </div>
              )}
              {detail.restricoes && <div><span className="text-muted-foreground">Restrições</span><p className="mt-1">{detail.restricoes}</p></div>}
              {detail.observacoes && <div><span className="text-muted-foreground">Observações</span><p className="mt-1 text-muted-foreground">{detail.observacoes}</p></div>}
              {detail.arquivoUrl && <Button variant="outline" size="sm" asChild className="w-full"><a href={detail.arquivoUrl} target="_blank" rel="noopener noreferrer">Ver Laudo (PDF)</a></Button>}
            </div>
          )}
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex justify-end">
            <Button variant="outline" onClick={() => setDetail(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar excluir */}
      <Dialog open={!!confirmDel} onOpenChange={(v) => { if (!v) setConfirmDel(null) }}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader><DialogTitle>Excluir exame?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmDel?.colaborador.nome} — {confirmDel?.tipo ? TIPO_LABELS[confirmDel.tipo] : ''} em {fmtDate(confirmDel?.dataExame)}</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={delMut.isPending} onClick={() => delMut.mutate(confirmDel!.id)}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
