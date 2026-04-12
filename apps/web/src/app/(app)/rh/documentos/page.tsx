'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Search, Plus, FileText, AlertCircle, Trash2, Pencil, RefreshCw, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

type TipoDoc = 'contrato_trabalho' | 'contrato_experiencia' | 'termo_confidencialidade' | 'atestado' | 'declaracao' | 'comprovante_residencia' | 'identidade' | 'cnh' | 'certificado' | 'outros'
type StatusDoc = 'ativo' | 'vencido' | 'cancelado' | 'pendente_assinatura'

const TIPO_LABELS: Record<TipoDoc, string> = {
  contrato_trabalho: 'Contrato de Trabalho', contrato_experiencia: 'Contrato de Experiência',
  termo_confidencialidade: 'Termo de Confidencialidade', atestado: 'Atestado',
  declaracao: 'Declaração', comprovante_residencia: 'Comp. Residência',
  identidade: 'Identidade (RG/CNH)', cnh: 'CNH', certificado: 'Certificado', outros: 'Outros',
}

const STATUS_CONFIG: Record<StatusDoc, { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'bg-green-500/15 text-green-400 border-green-500/20' },
  vencido: { label: 'Vencido', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
  cancelado: { label: 'Cancelado', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
  pendente_assinatura: { label: 'Pend. Assinatura', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
}

interface Documento {
  id: string; tipo: TipoDoc; nome: string; descricao?: string; arquivoUrl?: string
  vencimento?: string; status: StatusDoc; createdAt: string
  colaborador: { id: string; nome: string; matricula: string }
  uploadPor: { nome: string }
}

function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—' }
function isVencendo(d?: string) {
  if (!d) return false
  const diff = (new Date(d).getTime() - Date.now()) / 86400000
  return diff <= 30 && diff >= 0
}

export default function DocumentosPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const qc = useQueryClient()
  const canVis = isFullAccess || isGerenteGeral() || hasPermission('rh_documentos', 'visualizar')
  const canCriar = isFullAccess || isGerenteGeral() || hasPermission('rh_documentos', 'criar')
  const canEdit = isFullAccess || isGerenteGeral() || hasPermission('rh_documentos', 'editar')
  const canDel = isFullAccess || isGerenteGeral() || hasPermission('rh_documentos', 'excluir')

  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Documento | null>(null)
  const [confirmDel, setConfirmDel] = useState<Documento | null>(null)

  const [fColab, setFColab] = useState('')
  const [fTipo, setFTipo] = useState<TipoDoc | ''>('')
  const [fNome, setFNome] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fUrl, setFUrl] = useState('')
  const [fVenc, setFVenc] = useState('')
  const [fStatus, setFStatus] = useState<StatusDoc>('ativo')

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'documentos', page, filterTipo, filterStatus],
    queryFn: () => api.get('/rh/documentos', {
      page, limit: 20,
      ...(filterTipo !== 'all' ? { tipo: filterTipo } : {}),
      ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
    }) as Promise<{ items: Documento[]; total: number; pages: number }>,
    enabled: canVis,
  })

  const { data: alertas } = useQuery({
    queryKey: ['rh', 'documentos', 'alertas'],
    queryFn: () => api.get('/rh/documentos/alertas/vencimento', { dias: 30 }) as Promise<Documento[]>,
    enabled: canVis,
  })

  const { data: colabs } = useQuery({
    queryKey: ['rh', 'colaboradores', 'select'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 200 }) as Promise<{ items: any[] }>,
    enabled: modal,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['rh', 'documentos'] })

  const criarMut = useMutation({
    mutationFn: (body: any) => editing
      ? api.put(`/rh/documentos/${editing.id}`, body)
      : api.post('/rh/documentos', body),
    onSuccess: () => { toast.success(editing ? 'Documento atualizado' : 'Documento criado'); closeModal(); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api.delete(`/rh/documentos/${id}`),
    onSuccess: () => { toast.success('Documento excluído'); setConfirmDel(null); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  function openCreate() { resetForm(); setEditing(null); setModal(true) }
  function openEdit(d: Documento) {
    setFColab(d.colaborador.id); setFTipo(d.tipo); setFNome(d.nome)
    setFDesc(d.descricao ?? ''); setFUrl(d.arquivoUrl ?? '')
    setFVenc(d.vencimento ? d.vencimento.slice(0, 10) : ''); setFStatus(d.status)
    setEditing(d); setModal(true)
  }
  function closeModal() { setModal(false); setEditing(null); resetForm() }
  function resetForm() { setFColab(''); setFTipo(''); setFNome(''); setFDesc(''); setFUrl(''); setFVenc(''); setFStatus('ativo') }

  function handleSubmit() {
    if (!fTipo || !fNome) return toast.error('Preencha os campos obrigatórios')
    const body: any = { tipo: fTipo, nome: fNome, descricao: fDesc || undefined, arquivoUrl: fUrl || undefined, status: fStatus }
    if (!editing) body.colaboradorId = fColab
    if (fVenc) body.vencimento = new Date(fVenc).toISOString()
    criarMut.mutate(body)
  }

  if (!canVis) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Sem permissão.</p></div>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documentos e Contratos</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie contratos e documentos dos colaboradores</p>
        </div>
        {canCriar && <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Documento</Button>}
      </div>

      {/* Alertas vencimento */}
      {alertas && alertas.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">{alertas.length} documento(s) vencendo nos próximos 30 dias</p>
            <p className="text-xs text-muted-foreground mt-1">{alertas.map((a) => a.colaborador.nome).slice(0, 3).join(', ')}{alertas.length > 3 ? ` e mais ${alertas.length - 3}` : ''}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(1) }}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(Object.entries(TIPO_LABELS) as [TipoDoc, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1) }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.entries(STATUS_CONFIG) as [StatusDoc, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border rounded-xl border-dashed">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum documento encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.items.map((doc) => {
            const cfg = STATUS_CONFIG[doc.status]
            const venc = isVencendo(doc.vencimento)
            return (
              <div key={doc.id} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{doc.nome}</span>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', cfg.color)}>{cfg.label}</span>
                    <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">{TIPO_LABELS[doc.tipo]}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                    <span>{doc.colaborador.nome} • {doc.colaborador.matricula}</span>
                    {doc.vencimento && (
                      <span className={cn(venc ? 'text-amber-400' : '')}>
                        {venc && <AlertCircle className="inline h-3 w-3 mr-0.5" />}
                        Vence {fmtDate(doc.vencimento)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {doc.arquivoUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={doc.arquivoUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  {canEdit && <Button size="sm" variant="ghost" onClick={() => openEdit(doc)}><Pencil className="h-3.5 w-3.5" /></Button>}
                  {canDel && <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => setConfirmDel(doc)}><Trash2 className="h-3.5 w-3.5" /></Button>}
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
        <DialogContent className="max-w-md flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>{editing ? 'Editar Documento' : 'Novo Documento'}</DialogTitle></DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
            {!editing && (
              <div className="space-y-2">
                <Label>Colaborador *</Label>
                <Select value={fColab} onValueChange={setFColab}>
                  <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                  <SelectContent>
                    {colabs?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.matricula}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={fTipo} onValueChange={(v) => setFTipo(v as TipoDoc)}>
                <SelectTrigger><SelectValue placeholder="Tipo de documento" /></SelectTrigger>
                <SelectContent>{(Object.entries(TIPO_LABELS) as [TipoDoc, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={fNome} onChange={(e) => setFNome(e.target.value)} placeholder="Ex: Contrato CLT - Jan/2025" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>URL do arquivo</Label>
              <Input value={fUrl} onChange={(e) => setFUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Data de vencimento</Label>
              <Input type="date" value={fVenc} onChange={(e) => setFVenc(e.target.value)} />
            </div>
            {editing && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={fStatus} onValueChange={(v) => setFStatus(v as StatusDoc)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.entries(STATUS_CONFIG) as [StatusDoc, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button disabled={criarMut.isPending || (!editing && !fColab) || !fTipo || !fNome} onClick={handleSubmit}>
              {criarMut.isPending ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar excluir */}
      <Dialog open={!!confirmDel} onOpenChange={(v) => { if (!v) setConfirmDel(null) }}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader><DialogTitle>Excluir documento?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">"{confirmDel?.nome}" será excluído permanentemente.</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={delMut.isPending} onClick={() => delMut.mutate(confirmDel!.id)}>
              {delMut.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
