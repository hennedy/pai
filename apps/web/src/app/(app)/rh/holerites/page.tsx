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
import { Plus, FileText, RefreshCw, Trash2, Send, Eye, ChevronDown, ChevronUp, PlusCircle, X, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatusHol = 'rascunho' | 'publicado' | 'visualizado'

const STATUS_CONFIG: Record<StatusHol, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
  publicado: { label: 'Publicado', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  visualizado: { label: 'Visualizado', color: 'bg-green-500/15 text-green-400 border-green-500/20' },
}

interface ItemHolerite { descricao: string; valor: number }
interface Holerite {
  id: string; competencia: string; salarioBruto: number; descontos: ItemHolerite[]
  proventos: ItemHolerite[]; salarioLiquido: number; status: StatusHol
  arquivoUrl?: string; observacoes?: string; publicadoEm?: string
  colaborador: { id: string; nome: string; matricula: string; cargo?: { nome: string } }
  geradoPor: { nome: string }
}

function fmt(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

function compMeses() {
  const list: string[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return list
}

export default function HoleritesPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const qc = useQueryClient()
  const canVis = isFullAccess || isGerenteGeral() || hasPermission('rh_holerites', 'visualizar')
  const canCriar = isFullAccess || isGerenteGeral() || hasPermission('rh_holerites', 'criar')
  const canEdit = isFullAccess || isGerenteGeral() || hasPermission('rh_holerites', 'editar')
  const canPublish = isFullAccess || isGerenteGeral() || hasPermission('rh_holerites', 'publicar')
  const canDel = isFullAccess || isGerenteGeral() || hasPermission('rh_holerites', 'excluir')

  const [filterComp, setFilterComp] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [loteModal, setLoteModal] = useState(false)
  const [editing, setEditing] = useState<Holerite | null>(null)
  const [detail, setDetail] = useState<Holerite | null>(null)
  const [confirmDel, setConfirmDel] = useState<Holerite | null>(null)

  // form
  const [fColab, setFColab] = useState('')
  const [fComp, setFComp] = useState(compMeses()[0])
  const [fBruto, setFBruto] = useState('')
  const [fDescontos, setFDescontos] = useState<ItemHolerite[]>([])
  const [fProventos, setFProventos] = useState<ItemHolerite[]>([])
  const [fObs, setFObs] = useState('')
  const [fUrl, setFUrl] = useState('')
  const [loteComp, setLoteComp] = useState(compMeses()[0])

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'holerites', page, filterComp, filterStatus],
    queryFn: () => api.get('/rh/holerites', {
      page, limit: 20,
      ...(filterComp ? { competencia: filterComp } : {}),
      ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
    }) as Promise<{ items: Holerite[]; total: number; pages: number }>,
    enabled: canVis,
  })

  const { data: colabs } = useQuery({
    queryKey: ['rh', 'colaboradores', 'select'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 200 }) as Promise<{ items: any[] }>,
    enabled: modal,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['rh', 'holerites'] })

  const saveMut = useMutation({
    mutationFn: (body: any) => editing
      ? api.put(`/rh/holerites/${editing.id}`, body)
      : api.post('/rh/holerites', body),
    onSuccess: () => { toast.success('Holerite salvo'); closeModal(); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const publishMut = useMutation({
    mutationFn: (id: string) => api.patch(`/rh/holerites/${id}/publicar`, {}),
    onSuccess: () => { toast.success('Holerite publicado'); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const loteMut = useMutation({
    mutationFn: (body: any) => api.post('/rh/holerites/lote', body),
    onSuccess: (r: any) => { toast.success(r.message); setLoteModal(false); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api.delete(`/rh/holerites/${id}`),
    onSuccess: () => { toast.success('Excluído'); setConfirmDel(null); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  function openCreate() { resetForm(); setEditing(null); setModal(true) }
  function openEdit(h: Holerite) {
    setFColab(h.colaborador.id); setFComp(h.competencia); setFBruto(String(h.salarioBruto))
    setFDescontos([...(h.descontos ?? [])]); setFProventos([...(h.proventos ?? [])])
    setFObs(h.observacoes ?? ''); setFUrl(h.arquivoUrl ?? '')
    setEditing(h); setModal(true)
  }
  function closeModal() { setModal(false); setEditing(null); resetForm() }
  function resetForm() { setFColab(''); setFComp(compMeses()[0]); setFBruto(''); setFDescontos([]); setFProventos([]); setFObs(''); setFUrl('') }

  function addItem(list: ItemHolerite[], set: (v: ItemHolerite[]) => void) {
    set([...list, { descricao: '', valor: 0 }])
  }
  function removeItem(list: ItemHolerite[], idx: number, set: (v: ItemHolerite[]) => void) {
    set(list.filter((_, i) => i !== idx))
  }
  function updateItem(list: ItemHolerite[], idx: number, field: keyof ItemHolerite, value: any, set: (v: ItemHolerite[]) => void) {
    const updated = [...list]
    updated[idx] = { ...updated[idx], [field]: field === 'valor' ? Number(value) : value }
    set(updated)
  }

  const liquido = (() => {
    const b = parseFloat(fBruto) || 0
    const d = fDescontos.reduce((s, i) => s + i.valor, 0)
    const p = fProventos.reduce((s, i) => s + i.valor, 0)
    return b + p - d
  })()

  function handleSubmit() {
    if (!editing && !fColab) return toast.error('Selecione o colaborador')
    if (!fBruto || parseFloat(fBruto) <= 0) return toast.error('Informe o salário bruto')
    const body: any = {
      salarioBruto: parseFloat(fBruto),
      descontos: fDescontos,
      proventos: fProventos,
      observacoes: fObs || undefined,
      arquivoUrl: fUrl || undefined,
    }
    if (!editing) { body.colaboradorId = fColab; body.competencia = fComp }
    saveMut.mutate(body)
  }

  if (!canVis) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Sem permissão.</p></div>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Holerites</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie os contracheques dos colaboradores</p>
        </div>
        <div className="flex gap-2">
          {canCriar && (
            <Button variant="outline" onClick={() => setLoteModal(true)}>
              <Layers className="h-4 w-4 mr-2" /> Gerar em Lote
            </Button>
          )}
          {canCriar && <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Novo Holerite</Button>}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterComp || 'all'} onValueChange={(v) => { setFilterComp(v === 'all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Competência" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as competências</SelectItem>
            {compMeses().map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1) }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.entries(STATUS_CONFIG) as [StatusHol, any][]).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border rounded-xl border-dashed">
          <FileText className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum holerite encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.items.map((h) => {
            const cfg = STATUS_CONFIG[h.status]
            return (
              <div key={h.id} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{h.colaborador.nome}</span>
                    <span className="text-xs text-muted-foreground">{h.colaborador.matricula}</span>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', cfg.color)}>{cfg.label}</span>
                    <span className="text-xs bg-muted/30 px-2 py-0.5 rounded-full">{h.competencia}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>Bruto: <span className="text-foreground font-medium">{fmt(h.salarioBruto)}</span></span>
                    <span>Descontos: <span className="text-red-400">{fmt(h.descontos.reduce((s, d) => s + d.valor, 0))}</span></span>
                    <span>Líquido: <span className="text-green-400 font-semibold">{fmt(h.salarioLiquido)}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setDetail(h)}><Eye className="h-3.5 w-3.5" /></Button>
                  {h.status === 'rascunho' && canEdit && <Button size="sm" variant="ghost" onClick={() => openEdit(h)}><FileText className="h-3.5 w-3.5" /></Button>}
                  {h.status === 'rascunho' && canPublish && (
                    <Button size="sm" variant="outline" onClick={() => publishMut.mutate(h.id)}>
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Publicar
                    </Button>
                  )}
                  {h.status === 'rascunho' && canDel && (
                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => setConfirmDel(h)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
            <DialogHeader><DialogTitle>{editing ? `Editar Holerite — ${editing.competencia}` : 'Novo Holerite'}</DialogTitle></DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
            {!editing && (
              <>
                <div className="space-y-2">
                  <Label>Colaborador *</Label>
                  <Select value={fColab} onValueChange={setFColab}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{colabs?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.matricula}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Competência *</Label>
                  <Select value={fComp} onValueChange={setFComp}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{compMeses().map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Salário Bruto (R$) *</Label>
              <Input type="number" step="0.01" value={fBruto} onChange={(e) => setFBruto(e.target.value)} placeholder="0,00" />
            </div>

            {/* Proventos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Proventos</Label>
                <Button size="sm" variant="ghost" onClick={() => addItem(fProventos, setFProventos)}>
                  <PlusCircle className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              {fProventos.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="flex-1" placeholder="Descrição" value={item.descricao} onChange={(e) => updateItem(fProventos, i, 'descricao', e.target.value, setFProventos)} />
                  <Input className="w-28" type="number" step="0.01" placeholder="Valor" value={item.valor || ''} onChange={(e) => updateItem(fProventos, i, 'valor', e.target.value, setFProventos)} />
                  <Button size="icon" variant="ghost" className="text-red-400 shrink-0" onClick={() => removeItem(fProventos, i, setFProventos)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>

            {/* Descontos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Descontos</Label>
                <Button size="sm" variant="ghost" onClick={() => addItem(fDescontos, setFDescontos)}>
                  <PlusCircle className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              {fDescontos.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="flex-1" placeholder="Descrição" value={item.descricao} onChange={(e) => updateItem(fDescontos, i, 'descricao', e.target.value, setFDescontos)} />
                  <Input className="w-28" type="number" step="0.01" placeholder="Valor" value={item.valor || ''} onChange={(e) => updateItem(fDescontos, i, 'valor', e.target.value, setFDescontos)} />
                  <Button size="icon" variant="ghost" className="text-red-400 shrink-0" onClick={() => removeItem(fDescontos, i, setFDescontos)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-muted/30 p-3 flex justify-between text-sm font-semibold">
              <span>Salário Líquido</span>
              <span className={cn(liquido >= 0 ? 'text-green-400' : 'text-red-400')}>{fmt(liquido)}</span>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>URL do arquivo (PDF)</Label>
              <Input value={fUrl} onChange={(e) => setFUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button disabled={saveMut.isPending} onClick={handleSubmit}>
              {saveMut.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal geração em lote */}
      <Dialog open={loteModal} onOpenChange={setLoteModal}>
        <DialogContent className="max-w-sm p-6">
          <DialogHeader><DialogTitle>Gerar Holerites em Lote</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cria holerites rascunho para todos os colaboradores ativos na competência selecionada.</p>
          <div className="space-y-3 mt-4">
            <Label>Competência</Label>
            <Select value={loteComp} onValueChange={setLoteComp}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{compMeses().map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <Button variant="outline" onClick={() => setLoteModal(false)}>Cancelar</Button>
            <Button disabled={loteMut.isPending} onClick={() => loteMut.mutate({ competencia: loteComp })}>
              {loteMut.isPending ? 'Gerando...' : 'Gerar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal detalhe */}
      <Dialog open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null) }}>
        <DialogContent className="max-w-md flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>Holerite — {detail?.competencia}</DialogTitle></DialogHeader>
          </div>
          {detail && (
            <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
              <div>
                <p className="font-semibold">{detail.colaborador.nome}</p>
                <p className="text-xs text-muted-foreground">{detail.colaborador.matricula} • {detail.colaborador.cargo?.nome}</p>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Salário Bruto</span><span className="font-medium">{fmt(detail.salarioBruto)}</span></div>
                {detail.proventos.map((p, i) => <div key={i} className="flex justify-between text-sm text-green-400"><span>+ {p.descricao}</span><span>{fmt(p.valor)}</span></div>)}
                {detail.descontos.map((d, i) => <div key={i} className="flex justify-between text-sm text-red-400"><span>- {d.descricao}</span><span>{fmt(d.valor)}</span></div>)}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-border/40"><span>Salário Líquido</span><span className="text-green-400">{fmt(detail.salarioLiquido)}</span></div>
              </div>
              {detail.observacoes && <p className="text-xs text-muted-foreground">{detail.observacoes}</p>}
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
          <DialogHeader><DialogTitle>Excluir holerite?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmDel?.colaborador.nome} — {confirmDel?.competencia}</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={delMut.isPending} onClick={() => delMut.mutate(confirmDel!.id)}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
