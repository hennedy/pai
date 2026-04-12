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
  Megaphone, Plus, RefreshCw, Pin, Trash2, Pencil, Eye, Send,
  ChevronLeft, ChevronRight, AlertTriangle, Info, FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoComunicado = 'aviso' | 'comunicado' | 'politica' | 'treinamento' | 'outro'
type Prioridade = 'normal' | 'importante' | 'urgente'

const TIPO_CONFIG: Record<TipoComunicado, { label: string; icon: React.ElementType }> = {
  aviso:       { label: 'Aviso',       icon: AlertTriangle },
  comunicado:  { label: 'Comunicado',  icon: Megaphone },
  politica:    { label: 'Política',    icon: FileText },
  treinamento: { label: 'Treinamento', icon: Info },
  outro:       { label: 'Outro',       icon: Info },
}
const PRIORIDADE_CONFIG: Record<Prioridade, { label: string; color: string }> = {
  normal:     { label: 'Normal',     color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
  importante: { label: 'Importante', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  urgente:    { label: 'Urgente',    color: 'bg-red-500/15 text-red-400 border-red-500/20' },
}

function fmtDateTime(d?: string | null) {
  if (!d) return null
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Comunicado {
  id: string; titulo: string; conteudo: string
  tipo: TipoComunicado; prioridade: Prioridade
  fixado: boolean; publicadoEm?: string | null; expiresAt?: string | null
  arquivoUrl?: string; destinatarios: string[]
  criadoPor: { id: string; nome: string }
  _count: { visualizacoes: number }
  createdAt: string
}

export default function ComunicadosPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const qc = useQueryClient()

  const canVis      = isFullAccess || isGerenteGeral() || hasPermission('rh_comunicados', 'visualizar')
  const canCriar    = isFullAccess || isGerenteGeral() || hasPermission('rh_comunicados', 'criar')
  const canEditar   = isFullAccess || isGerenteGeral() || hasPermission('rh_comunicados', 'editar')
  const canPublicar = isFullAccess || isGerenteGeral() || hasPermission('rh_comunicados', 'publicar')
  const canExcluir  = isFullAccess || isGerenteGeral() || hasPermission('rh_comunicados', 'excluir')

  const [page, setPage] = useState(1)
  const [filterTipo, setFilterTipo] = useState('all')
  const [filterPrioridade, setFilterPrioridade] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Comunicado | null>(null)
  const [detail, setDetail] = useState<Comunicado | null>(null)
  const [leitoresModal, setLeitoresModal] = useState<Comunicado | null>(null)
  const [confirmDel, setConfirmDel] = useState<Comunicado | null>(null)

  // form
  const [fTitulo, setFTitulo] = useState('')
  const [fConteudo, setFConteudo] = useState('')
  const [fTipo, setFTipo] = useState<TipoComunicado>('comunicado')
  const [fPrioridade, setFPrioridade] = useState<Prioridade>('normal')
  const [fFixado, setFFixado] = useState(false)
  const [fArquivo, setFArquivo] = useState('')
  const [fPublicadoEm, setFPublicadoEm] = useState('')
  const [fExpiresAt, setFExpiresAt] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'comunicados', page, filterTipo, filterPrioridade, search],
    queryFn: () => api.get('/rh/comunicados', {
      page, limit: 20,
      ...(filterTipo !== 'all' ? { tipo: filterTipo } : {}),
      ...(filterPrioridade !== 'all' ? { prioridade: filterPrioridade } : {}),
      ...(search ? { search } : {}),
    }) as Promise<{ items: Comunicado[]; total: number; pages: number }>,
    enabled: canVis,
  })

  const { data: leitores, isLoading: loadingLeitores } = useQuery({
    queryKey: ['rh', 'comunicados', leitoresModal?.id, 'leitores'],
    queryFn: () => api.get(`/rh/comunicados/${leitoresModal!.id}/leitores`) as Promise<any[]>,
    enabled: !!leitoresModal,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['rh', 'comunicados'] })

  const saveMut = useMutation({
    mutationFn: (body: any) => editing
      ? api.put(`/rh/comunicados/${editing.id}`, body)
      : api.post('/rh/comunicados', body),
    onSuccess: () => { toast.success('Comunicado salvo'); closeModal(); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const publicarMut = useMutation({
    mutationFn: (id: string) => api.patch(`/rh/comunicados/${id}/publicar`, {}),
    onSuccess: () => { toast.success('Publicado'); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const despublicarMut = useMutation({
    mutationFn: (id: string) => api.patch(`/rh/comunicados/${id}/despublicar`, {}),
    onSuccess: () => { toast.success('Despublicado'); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api.delete(`/rh/comunicados/${id}`),
    onSuccess: () => { toast.success('Excluído'); setConfirmDel(null); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  function openCreate() { resetForm(); setEditing(null); setModal(true) }
  function openEdit(c: Comunicado) {
    setFTitulo(c.titulo); setFConteudo(c.conteudo)
    setFTipo(c.tipo); setFPrioridade(c.prioridade)
    setFFixado(c.fixado); setFArquivo(c.arquivoUrl ?? '')
    setFPublicadoEm(c.publicadoEm ? new Date(c.publicadoEm).toISOString().slice(0, 16) : '')
    setFExpiresAt(c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 16) : '')
    setEditing(c); setModal(true)
  }
  function closeModal() { setModal(false); setEditing(null); resetForm() }
  function resetForm() { setFTitulo(''); setFConteudo(''); setFTipo('comunicado'); setFPrioridade('normal'); setFFixado(false); setFArquivo(''); setFPublicadoEm(''); setFExpiresAt('') }

  function handleSubmit() {
    if (!fTitulo) return toast.error('Informe o título')
    if (!fConteudo) return toast.error('Informe o conteúdo')
    saveMut.mutate({
      titulo: fTitulo, conteudo: fConteudo, tipo: fTipo, prioridade: fPrioridade,
      fixado: fFixado, arquivoUrl: fArquivo || undefined,
      publicadoEm: fPublicadoEm ? new Date(fPublicadoEm).toISOString() : undefined,
      expiresAt: fExpiresAt ? new Date(fExpiresAt).toISOString() : undefined,
    })
  }

  const isPublicado = (c: Comunicado) => !!c.publicadoEm && new Date(c.publicadoEm) <= new Date()

  if (!canVis) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Sem permissão para acessar os Comunicados.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comunicação Interna</h1>
          <p className="text-muted-foreground text-sm mt-1">Comunicados, avisos e políticas para os colaboradores</p>
        </div>
        {canCriar && <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Comunicado</Button>}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Buscar comunicados..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-52"
        />
        <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(Object.entries(TIPO_CONFIG) as [TipoComunicado, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPrioridade} onValueChange={(v) => { setFilterPrioridade(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {(Object.entries(PRIORIDADE_CONFIG) as [Prioridade, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border rounded-xl border-dashed">
          <Megaphone className="h-10 w-10 opacity-30" /><p className="text-sm">Nenhum comunicado encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.items.map((c) => {
            const tipoCfg = TIPO_CONFIG[c.tipo] ?? TIPO_CONFIG.outro
            const TipoIcon = tipoCfg.icon
            const priCfg = PRIORIDADE_CONFIG[c.prioridade]
            const pub = isPublicado(c)
            return (
              <div key={c.id} className={cn(
                'rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3',
                c.fixado && 'border-amber-500/30 bg-amber-500/5'
              )}>
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  c.prioridade === 'urgente' ? 'bg-red-500/10 text-red-400' :
                  c.prioridade === 'importante' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-indigo-500/10 text-indigo-400'
                )}>
                  <TipoIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.fixado && <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                    <span className="font-semibold text-sm">{c.titulo}</span>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', priCfg.color)}>{priCfg.label}</span>
                    <span className="text-xs bg-muted/30 px-2 py-0.5 rounded">{tipoCfg.label}</span>
                    {pub
                      ? <span className="text-xs text-green-400">Publicado {fmtDateTime(c.publicadoEm)}</span>
                      : <span className="text-xs text-muted-foreground">Rascunho</span>
                    }
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>Por {c.criadoPor.nome}</span>
                    <span>{c._count.visualizacoes} leitura(s)</span>
                    {c.expiresAt && <span>Expira: {fmtDateTime(c.expiresAt)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setDetail(c)}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setLeitoresModal(c)}>
                    <Eye className="h-3.5 w-3.5 mr-1" />{c._count.visualizacoes}
                  </Button>
                  {canPublicar && !pub && (
                    <Button size="sm" variant="ghost" className="text-green-400"
                      onClick={() => publicarMut.mutate(c.id)}>
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canEditar && pub && (
                    <Button size="sm" variant="ghost" className="text-amber-400"
                      onClick={() => despublicarMut.mutate(c.id)}>
                      Despublicar
                    </Button>
                  )}
                  {canEditar && <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>}
                  {canExcluir && <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setConfirmDel(c)}><Trash2 className="h-3.5 w-3.5" /></Button>}
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

      {/* Modal criar/editar */}
      <Dialog open={modal} onOpenChange={(v) => { if (!v) closeModal() }}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>{editing ? 'Editar Comunicado' : 'Novo Comunicado'}</DialogTitle></DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
            <div className="space-y-2"><Label>Título *</Label><Input value={fTitulo} onChange={(e) => setFTitulo(e.target.value)} placeholder="Título do comunicado" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={fTipo} onValueChange={(v) => setFTipo(v as TipoComunicado)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.entries(TIPO_CONFIG) as [TipoComunicado, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={fPrioridade} onValueChange={(v) => setFPrioridade(v as Prioridade)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.entries(PRIORIDADE_CONFIG) as [Prioridade, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Conteúdo *</Label><Textarea value={fConteudo} onChange={(e) => setFConteudo(e.target.value)} rows={6} placeholder="Escreva o conteúdo do comunicado..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data de publicação</Label><Input type="datetime-local" value={fPublicadoEm} onChange={(e) => setFPublicadoEm(e.target.value)} /></div>
              <div className="space-y-2"><Label>Data de expiração</Label><Input type="datetime-local" value={fExpiresAt} onChange={(e) => setFExpiresAt(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>URL do anexo (PDF)</Label><Input value={fArquivo} onChange={(e) => setFArquivo(e.target.value)} placeholder="https://..." /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="fixado" checked={fFixado} onChange={(e) => setFFixado(e.target.checked)} className="rounded" />
              <label htmlFor="fixado" className="text-sm cursor-pointer">Fixar comunicado no topo</label>
            </div>
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button disabled={saveMut.isPending} onClick={handleSubmit}>{saveMut.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalhe */}
      <Dialog open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null) }}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>{detail?.titulo}</DialogTitle></DialogHeader>
            {detail && (
              <div className="flex gap-2 flex-wrap mt-2">
                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', PRIORIDADE_CONFIG[detail.prioridade].color)}>{PRIORIDADE_CONFIG[detail.prioridade].label}</span>
                <span className="text-xs bg-muted/30 px-2 py-0.5 rounded">{TIPO_CONFIG[detail.tipo]?.label}</span>
                <span className="text-xs text-muted-foreground">Por {detail.criadoPor.nome}</span>
                {detail.publicadoEm && <span className="text-xs text-green-400">Publicado {fmtDateTime(detail.publicadoEm)}</span>}
              </div>
            )}
          </div>
          {detail && (
            <div className="flex-1 overflow-y-auto px-6 pb-2">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{detail.conteudo}</p>
              {detail.arquivoUrl && (
                <Button variant="outline" size="sm" asChild className="mt-4">
                  <a href={detail.arquivoUrl} target="_blank" rel="noopener noreferrer">Ver Anexo</a>
                </Button>
              )}
            </div>
          )}
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex justify-end">
            <Button variant="outline" onClick={() => setDetail(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal leitores */}
      <Dialog open={!!leitoresModal} onOpenChange={(v) => { if (!v) setLeitoresModal(null) }}>
        <DialogContent className="max-w-md flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>Leitores — {leitoresModal?.titulo}</DialogTitle></DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2">
            {loadingLeitores ? (
              <div className="flex justify-center py-6"><RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : !leitores?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma leitura registrada</p>
            ) : (
              <div className="space-y-1.5">
                {leitores.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg hover:bg-muted/30">
                    <span>{l.colaborador.nome}</span>
                    <span className="text-xs text-muted-foreground">{fmtDateTime(l.visualizadoEm)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex justify-end">
            <Button variant="outline" onClick={() => setLeitoresModal(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <Dialog open={!!confirmDel} onOpenChange={(v) => { if (!v) setConfirmDel(null) }}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader><DialogTitle>Excluir comunicado?</DialogTitle></DialogHeader>
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
