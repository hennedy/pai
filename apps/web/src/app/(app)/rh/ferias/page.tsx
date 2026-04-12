'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/ui/page-header'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Umbrella,
  Plus,
  Search,
  Loader2,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  Play,
  Square,
  Ban,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  BarChart2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface ColaboradorBasico {
  id: string
  matricula: string
  nome: string
  cargo: { nome: string } | null
  unit: { nome: string }
}

interface PeriodoAquisitivo {
  id: string
  numero: number
  dataInicio: string
  dataFim: string
  status: string
  diasDisponiveis: number
  diasGozados: number
  diasVendidos: number
  colaborador: { nome: string; matricula: string }
}

interface Ferias {
  id: string
  status: string
  dataInicio: string
  dataFim: string
  diasSolicitados: number
  abonoPecuniario: number
  observacoes: string | null
  motivoReprovacao: string | null
  colaborador: {
    nome: string
    matricula: string
    cargo: { nome: string } | null
    unit: { nome: string }
  }
  periodoAquisitivo: { numero: number; dataInicio: string; dataFim: string }
  solicitadoPor: { nome: string } | null
  aprovadoPor: { nome: string } | null
  dataAprovacao: string | null
}

interface FeriasResponse {
  items: Ferias[]
  total: number
  page: number
  pages: number
}

// ============================================================
// Config
// ============================================================

const STATUS_FERIAS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  solicitado: { label: 'Solicitado', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  aprovado:   { label: 'Aprovado',   color: 'text-blue-700',  bg: 'bg-blue-50',  border: 'border-blue-200'  },
  reprovado:  { label: 'Reprovado',  color: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200'   },
  programado: { label: 'Programado', color: 'text-purple-700',bg: 'bg-purple-50',border: 'border-purple-200'},
  gozando:    { label: 'Gozando',    color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  concluido:  { label: 'Concluído',  color: 'text-gray-600',  bg: 'bg-gray-50',  border: 'border-gray-200'  },
  cancelado:  { label: 'Cancelado',  color: 'text-gray-500',  bg: 'bg-gray-50',  border: 'border-gray-200'  },
}

const STATUS_PERIODO: Record<string, { label: string; color: string; bg: string; border: string }> = {
  em_curso:  { label: 'Em Curso',   color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  adquirido: { label: 'Adquirido',  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200'  },
  vencendo:  { label: 'Vencendo',   color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  vencido:   { label: 'Vencido',    color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'    },
}

// ============================================================
// Helpers
// ============================================================

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('pt-BR')
}

function ordinal(n: number) {
  return `${n}º`
}

function saldoDisponivel(p: PeriodoAquisitivo) {
  return p.diasDisponiveis - p.diasGozados - p.diasVendidos
}

// ============================================================
// Sub-components
// ============================================================

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; color: string; bg: string; border: string }> }) {
  const cfg = map[status] ?? { label: status, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', cfg.color, cfg.bg, cfg.border)}>
      {cfg.label}
    </span>
  )
}

// ============================================================
// Modal Solicitar Férias
// ============================================================

function ModalSolicitarFerias({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [colaboradorId, setColaboradorId] = useState('')
  const [periodoId, setPeriodoId] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [diasSolicitados, setDiasSolicitados] = useState('')
  const [abonoPecuniario, setAbonoPecuniario] = useState('0')
  const [observacoes, setObservacoes] = useState('')

  const { data: colaboradores } = useQuery({
    queryKey: ['rh', 'colaboradores', 'ativos'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 100, status: 'ativo' }),
    enabled: open,
    select: (d: { data?: ColaboradorBasico[]; items?: ColaboradorBasico[] }) =>
      (d.data ?? d.items ?? []) as ColaboradorBasico[],
  })

  const { data: periodos, isLoading: loadingPeriodos } = useQuery({
    queryKey: ['rh', 'ferias', 'periodos', colaboradorId],
    queryFn: () => api.get('/rh/ferias/periodos', { colaboradorId }),
    enabled: !!colaboradorId,
    select: (d: PeriodoAquisitivo[]) => d,
  })

  const periodoSelecionado = periodos?.find((p) => p.id === periodoId)
  const saldo = periodoSelecionado ? saldoDisponivel(periodoSelecionado) : 0
  const diasNum = parseInt(diasSolicitados) || 0
  const maxAbono = Math.min(10, Math.floor(diasNum / 3))

  useEffect(() => {
    if (!open) {
      setColaboradorId('')
      setPeriodoId('')
      setDataInicio('')
      setDataFim('')
      setDiasSolicitados('')
      setAbonoPecuniario('0')
      setObservacoes('')
    }
  }, [open])

  useEffect(() => {
    setPeriodoId('')
  }, [colaboradorId])

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/rh/ferias', body),
    onSuccess: () => {
      toast.success('Solicitação de férias criada com sucesso')
      queryClient.invalidateQueries({ queryKey: ['rh', 'ferias'] })
      queryClient.invalidateQueries({ queryKey: ['rh', 'ferias', 'periodos'] })
      onClose()
    },
    onError: (err: { message?: string }) => {
      toast.error(err?.message ?? 'Erro ao solicitar férias')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!colaboradorId || !periodoId || !dataInicio || !dataFim || !diasSolicitados) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    if (saldo <= 0) {
      toast.error('Saldo insuficiente para este período')
      return
    }
    if (diasNum > saldo) {
      toast.error(`Dias solicitados (${diasNum}) excedem o saldo disponível (${saldo})`)
      return
    }
    mutation.mutate({
      colaboradorId,
      periodoAquisitivoId: periodoId,
      dataInicio,
      dataFim,
      diasSolicitados: diasNum,
      abonoPecuniario: parseInt(abonoPecuniario) || 0,
      observacoes: observacoes || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar Férias</DialogTitle>
          <DialogDescription>Preencha os dados para criar a solicitação de férias.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Colaborador */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Colaborador *</label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o colaborador" />
              </SelectTrigger>
              <SelectContent>
                {(colaboradores ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} — {c.matricula}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Período Aquisitivo */}
          {colaboradorId && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Período Aquisitivo *</label>
              {loadingPeriodos ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando períodos...
                </div>
              ) : (
                <Select value={periodoId} onValueChange={setPeriodoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    {(periodos ?? []).map((p) => {
                      const s = saldoDisponivel(p)
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          {ordinal(p.numero)} Período ({formatDate(p.dataInicio)} – {formatDate(p.dataFim)}) — Saldo: {s} dias
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
              {periodoSelecionado && (
                <div className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                  saldo > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                )}>
                  {saldo > 0 ? (
                    <><CheckCircle className="h-4 w-4 flex-shrink-0" /> Saldo disponível: <strong>{saldo} dias</strong></>
                  ) : (
                    <><AlertTriangle className="h-4 w-4 flex-shrink-0" /> Saldo insuficiente para este período</>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Data Início *</label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Data Fim *</label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
          </div>

          {/* Dias */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Dias Solicitados *</label>
              <Input
                type="number"
                min={5}
                max={saldo > 0 ? saldo : undefined}
                value={diasSolicitados}
                onChange={(e) => setDiasSolicitados(e.target.value)}
                placeholder="Ex: 30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Abono Pecuniário</label>
              <Input
                type="number"
                min={0}
                max={maxAbono}
                value={abonoPecuniario}
                onChange={(e) => setAbonoPecuniario(e.target.value)}
                placeholder="0"
              />
              {diasNum > 0 && (
                <p className="text-xs text-gray-500">Máx: {maxAbono} dias (1/3 dos solicitados)</p>
              )}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Observações</label>
            <Textarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações opcionais..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Solicitar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Modal Aprovar
// ============================================================

function ModalAprovar({ ferias, onClose }: { ferias: Ferias | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [obs, setObs] = useState('')

  useEffect(() => { if (!ferias) setObs('') }, [ferias])

  const mutation = useMutation({
    mutationFn: () => api.patch(`/rh/ferias/${ferias!.id}/aprovar`, { observacoes: obs || undefined }),
    onSuccess: () => {
      toast.success('Férias aprovadas com sucesso')
      queryClient.invalidateQueries({ queryKey: ['rh', 'ferias'] })
      queryClient.invalidateQueries({ queryKey: ['rh', 'ferias', 'periodos'] })
      onClose()
    },
    onError: (err: { message?: string }) => toast.error(err?.message ?? 'Erro ao aprovar'),
  })

  return (
    <Dialog open={!!ferias} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" /> Aprovar Férias
          </DialogTitle>
          <DialogDescription>
            Confirme a aprovação das férias de <strong>{ferias?.colaborador.nome}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm space-y-1">
            <p><span className="text-gray-500">Período:</span> {formatDate(ferias?.dataInicio)} → {formatDate(ferias?.dataFim)}</p>
            <p><span className="text-gray-500">Dias:</span> {ferias?.diasSolicitados}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Observações (opcional)</label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Modal Reprovar
// ============================================================

function ModalReprovar({ ferias, onClose }: { ferias: Ferias | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [motivo, setMotivo] = useState('')

  useEffect(() => { if (!ferias) setMotivo('') }, [ferias])

  const mutation = useMutation({
    mutationFn: () => api.patch(`/rh/ferias/${ferias!.id}/reprovar`, { motivoReprovacao: motivo }),
    onSuccess: () => {
      toast.success('Férias reprovadas')
      queryClient.invalidateQueries({ queryKey: ['rh', 'ferias'] })
      queryClient.invalidateQueries({ queryKey: ['rh', 'ferias', 'periodos'] })
      onClose()
    },
    onError: (err: { message?: string }) => toast.error(err?.message ?? 'Erro ao reprovar'),
  })

  function handleSubmit() {
    if (!motivo.trim()) { toast.error('Informe o motivo da reprovação'); return }
    mutation.mutate()
  }

  return (
    <Dialog open={!!ferias} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <XCircle className="h-5 w-5" /> Reprovar Férias
          </DialogTitle>
          <DialogDescription>
            Informe o motivo da reprovação para <strong>{ferias?.colaborador.nome}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Motivo *</label>
            <Textarea rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva o motivo..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Reprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Modal Confirmação Simples (Iniciar / Concluir / Cancelar)
// ============================================================

type AcaoSimples = 'iniciar' | 'concluir' | 'cancelar'

const ACAO_CONFIG: Record<AcaoSimples, { title: string; description: string; btnLabel: string; btnClass: string; icon: React.ElementType }> = {
  iniciar:  { title: 'Iniciar Gozo', description: 'Confirme o início do período de gozo de férias.', btnLabel: 'Iniciar Gozo', btnClass: 'bg-blue-600 hover:bg-blue-700', icon: Play },
  concluir: { title: 'Concluir Gozo', description: 'Confirme a conclusão do gozo. O colaborador retornará ao status ativo.', btnLabel: 'Concluir Gozo', btnClass: 'bg-green-600 hover:bg-green-700', icon: Square },
  cancelar: { title: 'Cancelar Férias', description: 'Tem certeza que deseja cancelar esta solicitação de férias?', btnLabel: 'Cancelar Férias', btnClass: '', icon: Ban },
}

function ModalAcaoSimples({
  ferias,
  acao,
  onClose,
}: {
  ferias: Ferias | null
  acao: AcaoSimples | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => api.patch(`/rh/ferias/${ferias!.id}/${acao}`, {}),
    onSuccess: () => {
      toast.success(`Ação realizada com sucesso`)
      queryClient.invalidateQueries({ queryKey: ['rh', 'ferias'] })
      queryClient.invalidateQueries({ queryKey: ['rh', 'ferias', 'periodos'] })
      onClose()
    },
    onError: (err: { message?: string }) => toast.error(err?.message ?? 'Erro ao executar ação'),
  })

  if (!ferias || !acao) return null
  const cfg = ACAO_CONFIG[acao]
  const Icon = cfg.icon

  return (
    <Dialog open={!!(ferias && acao)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" /> {cfg.title}
          </DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm space-y-1 mt-2">
          <p><span className="text-gray-500">Colaborador:</span> {ferias.colaborador.nome}</p>
          <p><span className="text-gray-500">Período:</span> {formatDate(ferias.dataInicio)} → {formatDate(ferias.dataFim)}</p>
          <p><span className="text-gray-500">Dias:</span> {ferias.diasSolicitados}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button
            variant={acao === 'cancelar' ? 'destructive' : 'default'}
            className={acao !== 'cancelar' ? cfg.btnClass : ''}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {cfg.btnLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Card Férias
// ============================================================

function CardFerias({
  f,
  canAprovar,
  canReprovar,
  canCancelar,
  onAprovar,
  onReprovar,
  onIniciar,
  onConcluir,
  onCancelar,
}: {
  f: Ferias
  canAprovar: boolean
  canReprovar: boolean
  canCancelar: boolean
  onAprovar: (f: Ferias) => void
  onReprovar: (f: Ferias) => void
  onIniciar: (f: Ferias) => void
  onConcluir: (f: Ferias) => void
  onCancelar: (f: Ferias) => void
}) {
  const concluido = f.status === 'concluido' || f.status === 'cancelado'

  return (
    <div className={cn('rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow', concluido && 'opacity-70')}>
      <div className="flex items-start justify-between gap-4">
        {/* Left */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-semibold text-gray-900', f.status === 'cancelado' && 'line-through')}>
              {f.colaborador.nome}
            </span>
            <span className="text-xs text-gray-400">#{f.colaborador.matricula}</span>
            <StatusBadge status={f.status} map={STATUS_FERIAS} />
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500 flex-wrap">
            {f.colaborador.cargo && (
              <span>{f.colaborador.cargo.nome}</span>
            )}
            <span className="text-gray-300">·</span>
            <span>{f.colaborador.unit.nome}</span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm flex-wrap">
            <span className="flex items-center gap-1 text-gray-600">
              <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
              {ordinal(f.periodoAquisitivo.numero)} Período
            </span>
            <span className="flex items-center gap-1 text-gray-600">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              {formatDate(f.dataInicio)} → {formatDate(f.dataFim)}
            </span>
            <span className="flex items-center gap-1 font-medium text-gray-700">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              {f.diasSolicitados} dias
              {f.abonoPecuniario > 0 && (
                <span className="ml-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                  +{f.abonoPecuniario} abono
                </span>
              )}
            </span>
          </div>
          {f.motivoReprovacao && (
            <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              {f.motivoReprovacao}
            </p>
          )}
          {f.aprovadoPor && (
            <p className="mt-1.5 text-xs text-gray-400">
              Aprovado por {f.aprovadoPor.nome}
              {f.dataAprovacao && ` em ${formatDate(f.dataAprovacao)}`}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {f.status === 'solicitado' && (
            <>
              {canAprovar && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs" onClick={() => onAprovar(f)}>
                  <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                </Button>
              )}
              {canReprovar && (
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => onReprovar(f)}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Reprovar
                </Button>
              )}
            </>
          )}
          {f.status === 'aprovado' && (
            <>
              {canAprovar && (
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs" onClick={() => onIniciar(f)}>
                  <Play className="h-3.5 w-3.5 mr-1" /> Iniciar Gozo
                </Button>
              )}
              {canCancelar && (
                <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => onCancelar(f)}>
                  <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
                </Button>
              )}
            </>
          )}
          {f.status === 'gozando' && canAprovar && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs" onClick={() => onConcluir(f)}>
              <Square className="h-3.5 w-3.5 mr-1" /> Concluir Gozo
            </Button>
          )}
          {!['solicitado', 'aprovado', 'gozando', 'concluido', 'cancelado'].includes(f.status) && canCancelar && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => onCancelar(f)}>
              <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Card Período Aquisitivo
// ============================================================

function CardPeriodo({ p, onGerarPeriodos }: { p: PeriodoAquisitivo; onGerarPeriodos: (colaboradorId: string) => void }) {
  const queryClient = useQueryClient()
  const saldo = saldoDisponivel(p)
  const pct = p.diasDisponiveis > 0 ? Math.min(100, Math.round((p.diasGozados / p.diasDisponiveis) * 100)) : 0

  const mutGerar = useMutation({
    mutationFn: () => api.post('/rh/ferias/periodos/gerar', { colaboradorId: p.colaborador.matricula }),
    onSuccess: () => {
      toast.success('Períodos gerados com sucesso')
      queryClient.invalidateQueries({ queryKey: ['rh', 'ferias', 'periodos'] })
    },
    onError: (err: { message?: string }) => toast.error(err?.message ?? 'Erro ao gerar períodos'),
  })

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{ordinal(p.numero)} Período</span>
            <StatusBadge status={p.status} map={STATUS_PERIODO} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatDate(p.dataInicio)} – {formatDate(p.dataFim)}
          </p>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Gozados: {p.diasGozados} / {p.diasDisponiveis} dias</span>
              <span className={cn('font-medium', saldo > 0 ? 'text-green-700' : 'text-red-600')}>
                Saldo: {saldo} dias
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={cn('h-2 rounded-full transition-all', pct >= 100 ? 'bg-gray-400' : 'bg-blue-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
            {p.diasVendidos > 0 && (
              <p className="text-xs text-amber-600">{p.diasVendidos} dias vendidos (abono)</p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs flex-shrink-0"
          onClick={() => mutGerar.mutate()}
          disabled={mutGerar.isPending}
          title="Gerar Períodos"
        >
          {mutGerar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="ml-1 hidden sm:inline">Gerar</span>
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Aba Solicitações
// ============================================================

function AbaFerias({ canCriar, canAprovar, canReprovar, canCancelar }: {
  canCriar: boolean
  canAprovar: boolean
  canReprovar: boolean
  canCancelar: boolean
}) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [modalSolicitar, setModalSolicitar] = useState(false)
  const [feriasAprovar, setFeriasAprovar] = useState<Ferias | null>(null)
  const [feriasReprovar, setFeriasReprovar] = useState<Ferias | null>(null)
  const [acaoSimples, setAcaoSimples] = useState<{ ferias: Ferias; acao: AcaoSimples } | null>(null)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['rh', 'ferias', { page, search, status: statusFiltro }],
    queryFn: () =>
      api.get('/rh/ferias', {
        page,
        limit: 20,
        ...(search ? { search } : {}),
        ...(statusFiltro !== 'todos' ? { status: statusFiltro } : {}),
      }) as Promise<FeriasResponse>,
  })

  const items = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900">Solicitações de Férias</h2>
        {canCriar && (
          <Button onClick={() => setModalSolicitar(true)}>
            <Plus className="h-4 w-4 mr-2" /> Solicitar Férias
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Buscar colaborador..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={statusFiltro} onValueChange={(v) => { setStatusFiltro(v); setPage(1) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS_FERIAS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <Umbrella className="h-10 w-10 text-gray-200" />
          <p className="text-sm">Nenhuma solicitação encontrada</p>
        </div>
      ) : (
        <div className={cn('space-y-3', isFetching && 'opacity-60 pointer-events-none')}>
          {items.map((f) => (
            <CardFerias
              key={f.id}
              f={f}
              canAprovar={canAprovar}
              canReprovar={canReprovar}
              canCancelar={canCancelar}
              onAprovar={setFeriasAprovar}
              onReprovar={setFeriasReprovar}
              onIniciar={(fe) => setAcaoSimples({ ferias: fe, acao: 'iniciar' })}
              onConcluir={(fe) => setAcaoSimples({ ferias: fe, acao: 'concluir' })}
              onCancelar={(fe) => setAcaoSimples({ ferias: fe, acao: 'cancelar' })}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            {data?.total ?? 0} resultado{(data?.total ?? 0) !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modais */}
      <ModalSolicitarFerias open={modalSolicitar} onClose={() => setModalSolicitar(false)} />
      <ModalAprovar ferias={feriasAprovar} onClose={() => setFeriasAprovar(null)} />
      <ModalReprovar ferias={feriasReprovar} onClose={() => setFeriasReprovar(null)} />
      <ModalAcaoSimples
        ferias={acaoSimples?.ferias ?? null}
        acao={acaoSimples?.acao ?? null}
        onClose={() => setAcaoSimples(null)}
      />
    </div>
  )
}

// ============================================================
// Aba Períodos Aquisitivos
// ============================================================

function AbaPeriodos() {
  const [colaboradorId, setColaboradorId] = useState('')

  const { data: colaboradores } = useQuery({
    queryKey: ['rh', 'colaboradores', 'ativos'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 100, status: 'ativo' }),
    select: (d: { data?: ColaboradorBasico[]; items?: ColaboradorBasico[] }) =>
      (d.data ?? d.items ?? []) as ColaboradorBasico[],
  })

  const { data: periodos, isLoading } = useQuery({
    queryKey: ['rh', 'ferias', 'periodos', colaboradorId],
    queryFn: () =>
      api.get('/rh/ferias/periodos', colaboradorId ? { colaboradorId } : undefined) as Promise<PeriodoAquisitivo[]>,
    select: (d: PeriodoAquisitivo[]) => d,
  })

  // Group by colaborador
  const grouped = (periodos ?? []).reduce<Record<string, { colaborador: { nome: string; matricula: string }; periodos: PeriodoAquisitivo[] }>>((acc, p) => {
    const key = p.colaborador.matricula
    if (!acc[key]) acc[key] = { colaborador: p.colaborador, periodos: [] }
    acc[key].periodos.push(p)
    return acc
  }, {})

  const grupos = Object.values(grouped)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900">Períodos Aquisitivos</h2>
        <div className="w-64">
          <Select value={colaboradorId} onValueChange={setColaboradorId}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por colaborador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os colaboradores</SelectItem>
              {(colaboradores ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} — {c.matricula}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando períodos...
        </div>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <BarChart2 className="h-10 w-10 text-gray-200" />
          <p className="text-sm">Nenhum período aquisitivo encontrado</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => (
            <div key={g.colaborador.matricula} className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-800">{g.colaborador.nome}</span>
                <span className="text-xs text-gray-400">#{g.colaborador.matricula}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-6">
                {g.periodos.map((p) => (
                  <CardPeriodo key={p.id} p={p} onGerarPeriodos={() => {}} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Page
// ============================================================

export default function FeriasPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()

  const canVisualizar = isFullAccess || isGerenteGeral() || hasPermission('rh_ferias', 'visualizar')
  const canCriar     = isFullAccess || isGerenteGeral() || hasPermission('rh_ferias', 'criar')
  const canAprovar   = isFullAccess || isGerenteGeral() || hasPermission('rh_ferias', 'aprovar')
  const canReprovar  = isFullAccess || isGerenteGeral() || hasPermission('rh_ferias', 'reprovar')
  const canCancelar  = isFullAccess || isGerenteGeral() || hasPermission('rh_ferias', 'cancelar')

  if (!canVisualizar) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
        <AlertTriangle className="h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium">Você não tem permissão para visualizar esta página.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Férias"
        description="Gerencie solicitações de férias e acompanhe os períodos aquisitivos dos colaboradores."
        icon={Umbrella}
      />

      <Tabs defaultValue="solicitacoes" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="solicitacoes" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Solicitações de Férias
          </TabsTrigger>
          <TabsTrigger value="periodos" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" /> Períodos Aquisitivos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="solicitacoes">
          <AbaFerias
            canCriar={canCriar}
            canAprovar={canAprovar}
            canReprovar={canReprovar}
            canCancelar={canCancelar}
          />
        </TabsContent>

        <TabsContent value="periodos">
          <AbaPeriodos />
        </TabsContent>
      </Tabs>
    </div>
  )
}
