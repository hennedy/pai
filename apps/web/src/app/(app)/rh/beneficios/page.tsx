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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, RefreshCw, Gift, Users, Pencil, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

type TipoBen = 'vale_transporte' | 'vale_refeicao' | 'vale_alimentacao' | 'plano_saude' | 'plano_odontologico' | 'seguro_vida' | 'gympass' | 'auxilio_creche' | 'outros'

const TIPO_LABELS: Record<TipoBen, string> = {
  vale_transporte: 'Vale Transporte', vale_refeicao: 'Vale Refeição', vale_alimentacao: 'Vale Alimentação',
  plano_saude: 'Plano de Saúde', plano_odontologico: 'Plano Odontológico', seguro_vida: 'Seguro de Vida',
  gympass: 'Gympass / Wellhub', auxilio_creche: 'Auxílio Creche', outros: 'Outros',
}

const TIPO_COLORS: Record<TipoBen, string> = {
  vale_transporte: 'bg-blue-500/15 text-blue-400', vale_refeicao: 'bg-orange-500/15 text-orange-400',
  vale_alimentacao: 'bg-green-500/15 text-green-400', plano_saude: 'bg-red-500/15 text-red-400',
  plano_odontologico: 'bg-cyan-500/15 text-cyan-400', seguro_vida: 'bg-purple-500/15 text-purple-400',
  gympass: 'bg-lime-500/15 text-lime-400', auxilio_creche: 'bg-pink-500/15 text-pink-400',
  outros: 'bg-zinc-500/15 text-zinc-400',
}

interface Beneficio {
  id: string; nome: string; tipo: TipoBen; descricao?: string; valorPadrao?: number; status: string
  _count?: { colaboradores: number }
}

interface VinculoColaborador {
  id: string; valorMensal?: number; dataInicio: string; dataFim?: string; status: string; observacoes?: string
  colaborador: { id: string; nome: string; matricula: string }
  beneficio: Beneficio
}

function fmt(n?: number) { return n != null ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—' }

export default function BeneficiosPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const qc = useQueryClient()
  const canVis = isFullAccess || isGerenteGeral() || hasPermission('rh_beneficios', 'visualizar')
  const canCriar = isFullAccess || isGerenteGeral() || hasPermission('rh_beneficios', 'criar')
  const canEdit = isFullAccess || isGerenteGeral() || hasPermission('rh_beneficios', 'editar')

  const [tab, setTab] = useState('catalogo')
  const [modalBen, setModalBen] = useState(false)
  const [modalVincular, setModalVincular] = useState(false)
  const [editingBen, setEditingBen] = useState<Beneficio | null>(null)
  const [selectedBen, setSelectedBen] = useState<Beneficio | null>(null)
  const [editingVinculo, setEditingVinculo] = useState<VinculoColaborador | null>(null)

  // forms beneficio
  const [fNome, setFNome] = useState(''); const [fTipo, setFTipo] = useState<TipoBen | ''>('')
  const [fDesc, setFDesc] = useState(''); const [fValor, setFValor] = useState('')

  // forms vínculo
  const [vColab, setVColab] = useState(''); const [vBen, setVBen] = useState('')
  const [vValor, setVValor] = useState(''); const [vInicio, setVInicio] = useState('')
  const [vFim, setVFim] = useState(''); const [vObs, setVObs] = useState('')

  const { data: beneficios, isLoading } = useQuery({
    queryKey: ['rh', 'beneficios'],
    queryFn: () => api.get('/rh/beneficios') as Promise<Beneficio[]>,
    enabled: canVis,
  })

  const { data: resumo } = useQuery({
    queryKey: ['rh', 'beneficios', 'resumo'],
    queryFn: () => api.get('/rh/beneficios/resumo/tipos') as Promise<any[]>,
    enabled: canVis && tab === 'resumo',
  })

  const { data: vinculos } = useQuery({
    queryKey: ['rh', 'beneficios', 'vinculo', selectedBen?.id],
    queryFn: () => api.get(`/rh/beneficios/${selectedBen!.id}`) as Promise<{ colaboradores: VinculoColaborador[] }>,
    enabled: !!selectedBen,
  })

  const { data: colabs } = useQuery({
    queryKey: ['rh', 'colaboradores', 'select'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 200 }) as Promise<{ items: any[] }>,
    enabled: modalVincular,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['rh', 'beneficios'] })

  const saveBenMut = useMutation({
    mutationFn: (body: any) => editingBen ? api.put(`/rh/beneficios/${editingBen.id}`, body) : api.post('/rh/beneficios', body),
    onSuccess: () => { toast.success('Salvo'); closeModalBen(); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  const vincularMut = useMutation({
    mutationFn: (body: any) => editingVinculo
      ? api.put(`/rh/beneficios/vinculo/${editingVinculo.id}`, body)
      : api.post('/rh/beneficios/vincular', body),
    onSuccess: () => { toast.success('Vínculo salvo'); closeModalVincular(); invalidate() },
    onError: (e: any) => toast.error(e?.message ?? 'Erro'),
  })

  function closeModalBen() { setModalBen(false); setEditingBen(null); setFNome(''); setFTipo(''); setFDesc(''); setFValor('') }
  function closeModalVincular() { setModalVincular(false); setEditingVinculo(null); setVColab(''); setVBen(''); setVValor(''); setVInicio(''); setVFim(''); setVObs('') }
  function openEdit(b: Beneficio) { setFNome(b.nome); setFTipo(b.tipo); setFDesc(b.descricao ?? ''); setFValor(b.valorPadrao ? String(b.valorPadrao) : ''); setEditingBen(b); setModalBen(true) }

  if (!canVis) return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Sem permissão.</p></div>

  const items = beneficios ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Benefícios</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie o catálogo e os vínculos de benefícios</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => setModalVincular(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Vincular Benefício
            </Button>
          )}
          {canCriar && <Button onClick={() => { setEditingBen(null); setModalBen(true) }}><Plus className="h-4 w-4 mr-2" /> Novo Benefício</Button>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
          <TabsTrigger value="resumo">Resumo por Tipo</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border rounded-xl border-dashed">
              <Gift className="h-10 w-10 opacity-30" /><p className="text-sm">Nenhum benefício cadastrado</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((b) => (
                <div
                  key={b.id}
                  className={cn('rounded-xl border bg-card p-4 cursor-pointer hover:border-amber-500/40 transition-colors', selectedBen?.id === b.id && 'border-amber-500/60 bg-amber-500/5')}
                  onClick={() => setSelectedBen(selectedBen?.id === b.id ? null : b)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold mb-2', TIPO_COLORS[b.tipo])}>{TIPO_LABELS[b.tipo]}</span>
                      <p className="font-semibold text-sm">{b.nome}</p>
                      {b.valorPadrao && <p className="text-xs text-muted-foreground mt-1">Valor padrão: {fmt(b.valorPadrao)}/mês</p>}
                    </div>
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(b) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {b._count !== undefined && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> {b._count.colaboradores} colaborador(es) ativo(s)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Lista de vínculos do benefício selecionado */}
          {selectedBen && (
            <div className="mt-6 space-y-3">
              <h3 className="font-semibold text-sm">Colaboradores com "{selectedBen.nome}"</h3>
              {vinculos?.colaboradores?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum colaborador vinculado.</p>
              ) : (
                <div className="space-y-2">
                  {vinculos?.colaboradores?.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between rounded-lg border bg-muted/20 p-3 text-sm">
                      <div>
                        <span className="font-medium">{v.colaborador.nome}</span>
                        <span className="text-xs text-muted-foreground ml-2">{v.colaborador.matricula}</span>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {v.valorMensal ? fmt(v.valorMensal) : 'Valor padrão'}
                        <span className={cn('ml-2 inline-flex px-1.5 py-0.5 rounded-full', v.status === 'ativo' ? 'bg-green-500/15 text-green-400' : 'bg-zinc-500/15 text-zinc-400')}>
                          {v.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resumo" className="mt-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(resumo ?? []).map((r: any) => (
              <div key={r.id} className="rounded-xl border bg-card p-4 space-y-2">
                <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold', TIPO_COLORS[r.tipo as TipoBen])}>{TIPO_LABELS[r.tipo as TipoBen]}</span>
                <p className="font-semibold text-sm">{r.nome}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Colaboradores</span>
                  <span className="font-medium">{r.totalColaboradores}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo mensal</span>
                  <span className="font-semibold text-amber-400">{fmt(r.custoMensalTotal)}</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal benefício */}
      <Dialog open={modalBen} onOpenChange={(v) => { if (!v) closeModalBen() }}>
        <DialogContent className="max-w-md flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>{editingBen ? 'Editar Benefício' : 'Novo Benefício'}</DialogTitle></DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={fNome} onChange={(e) => setFNome(e.target.value)} placeholder="Ex: Vale Refeição Sodexo" /></div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={fTipo} onValueChange={(v) => setFTipo(v as TipoBen)}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>{(Object.entries(TIPO_LABELS) as [TipoBen, string][]).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} rows={2} /></div>
            <div className="space-y-2"><Label>Valor padrão (R$/mês)</Label><Input type="number" step="0.01" value={fValor} onChange={(e) => setFValor(e.target.value)} placeholder="0,00" /></div>
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
            <Button variant="outline" onClick={closeModalBen}>Cancelar</Button>
            <Button disabled={!fNome || !fTipo || saveBenMut.isPending} onClick={() => saveBenMut.mutate({ nome: fNome, tipo: fTipo, descricao: fDesc || undefined, valorPadrao: fValor ? parseFloat(fValor) : undefined })}>
              {saveBenMut.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal vincular */}
      <Dialog open={modalVincular} onOpenChange={(v) => { if (!v) closeModalVincular() }}>
        <DialogContent className="max-w-md flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>Vincular Benefício a Colaborador</DialogTitle></DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
            <div className="space-y-2">
              <Label>Colaborador *</Label>
              <Select value={vColab} onValueChange={setVColab}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colabs?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} — {c.matricula}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Benefício *</Label>
              <Select value={vBen} onValueChange={setVBen}>
                <SelectTrigger><SelectValue placeholder="Selecione o benefício" /></SelectTrigger>
                <SelectContent>{items.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Valor mensal (R$) — deixe em branco para usar o padrão</Label><Input type="number" step="0.01" value={vValor} onChange={(e) => setVValor(e.target.value)} placeholder="0,00" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Data início *</Label><Input type="date" value={vInicio} onChange={(e) => setVInicio(e.target.value)} /></div>
              <div className="space-y-2"><Label>Data fim</Label><Input type="date" value={vFim} onChange={(e) => setVFim(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={vObs} onChange={(e) => setVObs(e.target.value)} rows={2} /></div>
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex gap-3 justify-end">
            <Button variant="outline" onClick={closeModalVincular}>Cancelar</Button>
            <Button
              disabled={!vColab || !vBen || !vInicio || vincularMut.isPending}
              onClick={() => vincularMut.mutate({ colaboradorId: vColab, beneficioId: vBen, valorMensal: vValor ? parseFloat(vValor) : undefined, dataInicio: new Date(vInicio).toISOString(), dataFim: vFim ? new Date(vFim).toISOString() : undefined, observacoes: vObs || undefined })}
            >
              {vincularMut.isPending ? 'Salvando...' : 'Vincular'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
