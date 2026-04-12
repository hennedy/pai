'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  UserMinus,
  Plus,
  Search,
  Loader2,
  Calendar,
  Building2,
  Briefcase,
  CheckSquare,
  Square,
  CheckCircle2,
  XCircle,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  User,
  FileText,
  Clock,
  DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface ChecklistItem {
  descricao: string
  concluido: boolean
}

interface ColaboradorRef {
  id: string
  nome: string
  matricula: string
  cargo: { nome: string } | null
  unit: { nome: string } | null
}

interface RegistradoPorRef {
  nome: string
}

interface Desligamento {
  id: string
  tipo: string
  status: string
  dataAviso: string | null
  dataDesligamento: string
  motivoDetalhado: string | null
  entrevistaDeRetencao: boolean
  observacoes: string | null
  checklistItems: ChecklistItem[]
  colaborador: ColaboradorRef
  registradoPor: RegistradoPorRef | null
}

interface DesligamentoDetalhe extends Desligamento {
  colaborador: ColaboradorRef & {
    salarioBase?: number | null
    tipoContrato?: string | null
    dataAdmissao?: string | null
  }
}

interface PaginatedDesligamento {
  items: Desligamento[]
  total: number
  page: number
  pages: number
}

interface ColaboradorAtivo {
  id: string
  nome: string
  matricula: string
  cargo: { nome: string } | null
  unit: { nome: string } | null
}

// ============================================================
// Config
// ============================================================

const TIPO_LABELS: Record<string, string> = {
  demissao_sem_justa_causa: 'Demissão s/ Justa Causa',
  demissao_por_justa_causa: 'Demissão p/ Justa Causa',
  pedido_demissao: 'Pedido de Demissão',
  acordo_mutuo: 'Acordo Mútuo',
  aposentadoria: 'Aposentadoria',
  falecimento: 'Falecimento',
  termino_contrato: 'Término de Contrato',
  outro: 'Outro',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pendente:     { label: 'Pendente',     color: 'text-amber-700',  bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-700' },
  em_andamento: { label: 'Em Andamento', color: 'text-blue-700',   bg: 'bg-blue-50 dark:bg-blue-900/20',   border: 'border-blue-200 dark:border-blue-700' },
  concluido:    { label: 'Concluído',    color: 'text-green-700',  bg: 'bg-green-50 dark:bg-green-900/20',  border: 'border-green-200 dark:border-green-700' },
  cancelado:    { label: 'Cancelado',    color: 'text-gray-500',   bg: 'bg-gray-50 dark:bg-gray-900/20',   border: 'border-gray-200 dark:border-gray-700' },
}

const CONTRATO_LABELS: Record<string, string> = {
  clt: 'CLT', pj: 'PJ', estagio: 'Estágio', aprendiz: 'Aprendiz', temporario: 'Temporário', autonomo: 'Autônomo',
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pendente
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border', cfg.bg, cfg.color, cfg.border)}>
      {cfg.label}
    </span>
  )
}

function TipoBadge({ tipo }: { tipo: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700">
      {TIPO_LABELS[tipo] ?? tipo}
    </span>
  )
}

function ChecklistProgress({ items }: { items: ChecklistItem[] }) {
  if (!items || items.length === 0) {
    return <span className="text-xs text-muted-foreground">Sem checklist</span>
  }
  const total = items.length
  const done = items.filter(i => i.concluido).length
  const pct = Math.round((done / total) * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{done}/{total} itens concluídos</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-green-500' : 'bg-blue-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ============================================================
// Modal: Novo Desligamento
// ============================================================

function ModalNovoDesligamento({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    colaboradorId: '',
    tipo: '',
    dataAviso: '',
    dataDesligamento: '',
    motivoDetalhado: '',
    entrevistaDeRetencao: false,
    observacoes: '',
  })

  const { data: colaboradoresData } = useQuery({
    queryKey: ['rh', 'colaboradores', 'ativos'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 100, status: 'ativo' }),
    enabled: open,
  })

  const colaboradores: ColaboradorAtivo[] = colaboradoresData?.data ?? []

  const mutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/rh/desligamento', body),
    onSuccess: () => {
      toast.success('Desligamento registrado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['rh', 'desligamento'] })
      onSuccess()
    },
    onError: () => toast.error('Erro ao registrar desligamento.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.colaboradorId) return toast.error('Selecione o colaborador.')
    if (!form.tipo) return toast.error('Selecione o tipo de desligamento.')
    if (!form.dataDesligamento) return toast.error('Informe a data de desligamento.')
    mutation.mutate(form)
  }

  const field = (key: keyof typeof form, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Desligamento</DialogTitle>
          <DialogDescription>Preencha os dados do processo de desligamento.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {/* Colaborador */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Colaborador <span className="text-red-500">*</span></label>
            <Select value={form.colaboradorId} onValueChange={v => field('colaboradorId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o colaborador..." />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} — {c.matricula}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Tipo de Desligamento <span className="text-red-500">*</span></label>
            <Select value={form.tipo} onValueChange={v => field('tipo', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Data do Aviso</label>
              <Input
                type="date"
                value={form.dataAviso}
                onChange={e => field('dataAviso', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Data do Desligamento <span className="text-red-500">*</span></label>
              <Input
                type="date"
                value={form.dataDesligamento}
                onChange={e => field('dataDesligamento', e.target.value)}
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Motivo Detalhado</label>
            <Textarea
              placeholder="Descreva o motivo do desligamento..."
              value={form.motivoDetalhado}
              onChange={e => field('motivoDetalhado', e.target.value)}
              rows={3}
            />
          </div>

          {/* Entrevista de retenção */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.entrevistaDeRetencao}
              onChange={e => field('entrevistaDeRetencao', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm">Realizar entrevista de retenção</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Registrar Desligamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Modal: Detalhes + Checklist
// ============================================================

function ModalDetalhes({
  desligamentoId,
  open,
  onClose,
  canEditar,
  canConcluir,
  canCancelar,
  onConcluir,
  onCancelar,
}: {
  desligamentoId: string | null
  open: boolean
  onClose: () => void
  canEditar: boolean
  canConcluir: boolean
  canCancelar: boolean
  onConcluir: (d: DesligamentoDetalhe) => void
  onCancelar: (d: DesligamentoDetalhe) => void
}) {
  const queryClient = useQueryClient()

  const { data: detalhe, isLoading } = useQuery<DesligamentoDetalhe>({
    queryKey: ['rh', 'desligamento', desligamentoId],
    queryFn: () => api.get(`/rh/desligamento/${desligamentoId}`),
    enabled: open && !!desligamentoId,
  })

  const checklistMutation = useMutation({
    mutationFn: (items: ChecklistItem[]) =>
      api.patch(`/rh/desligamento/${desligamentoId}/checklist`, { checklistItems: items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh', 'desligamento', desligamentoId] })
      queryClient.invalidateQueries({ queryKey: ['rh', 'desligamento'] })
    },
    onError: () => toast.error('Erro ao atualizar checklist.'),
  })

  const handleToggleItem = useCallback(
    (index: number) => {
      if (!detalhe) return
      const updated = detalhe.checklistItems.map((item, i) =>
        i === index ? { ...item, concluido: !item.concluido } : item
      )
      checklistMutation.mutate(updated)
    },
    [detalhe, checklistMutation]
  )

  const colab = detalhe?.colaborador

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            Detalhes do Desligamento
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !detalhe ? (
          <div className="py-8 text-center text-muted-foreground">Não foi possível carregar os dados.</div>
        ) : (
          <div className="flex flex-col gap-6 mt-2">
            {/* Dados do colaborador */}
            <section className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <User className="h-4 w-4" /> Colaborador
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <InfoRow icon={User} label="Nome" value={colab?.nome ?? '—'} />
                <InfoRow icon={FileText} label="Matrícula" value={colab?.matricula ?? '—'} />
                <InfoRow icon={Briefcase} label="Cargo" value={colab?.cargo?.nome ?? '—'} />
                <InfoRow icon={Building2} label="Unidade" value={colab?.unit?.nome ?? '—'} />
                {colab?.dataAdmissao && (
                  <InfoRow icon={Calendar} label="Admissão" value={formatDate(colab.dataAdmissao)} />
                )}
                {colab?.tipoContrato && (
                  <InfoRow icon={FileText} label="Contrato" value={CONTRATO_LABELS[colab.tipoContrato] ?? colab.tipoContrato} />
                )}
                {colab?.salarioBase != null && (
                  <InfoRow icon={DollarSign} label="Salário Base" value={formatCurrency(colab.salarioBase)} />
                )}
              </div>
            </section>

            {/* Dados do processo */}
            <section className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4" /> Processo
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <InfoRow icon={FileText} label="Tipo" value={TIPO_LABELS[detalhe.tipo] ?? detalhe.tipo} />
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Status:</span>
                  <StatusBadge status={detalhe.status} />
                </div>
                {detalhe.dataAviso && (
                  <InfoRow icon={Calendar} label="Aviso" value={formatDate(detalhe.dataAviso)} />
                )}
                <InfoRow icon={Calendar} label="Desligamento" value={formatDate(detalhe.dataDesligamento)} />
                {detalhe.entrevistaDeRetencao && (
                  <div className="col-span-2 text-xs text-blue-600 font-medium">
                    Entrevista de retenção marcada
                  </div>
                )}
              </div>
              {detalhe.motivoDetalhado && (
                <div className="mt-1">
                  <span className="text-xs font-medium text-muted-foreground">Motivo:</span>
                  <p className="text-sm mt-0.5 text-foreground/80">{detalhe.motivoDetalhado}</p>
                </div>
              )}
              {detalhe.observacoes && (
                <div className="mt-1">
                  <span className="text-xs font-medium text-muted-foreground">Observações:</span>
                  <p className="text-sm mt-0.5 text-foreground/80">{detalhe.observacoes}</p>
                </div>
              )}
            </section>

            {/* Checklist */}
            <section className="rounded-lg border p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <CheckSquare className="h-4 w-4" /> Checklist
                </h3>
                {detalhe.checklistItems.length > 0 && (
                  <ChecklistProgress items={detalhe.checklistItems} />
                )}
              </div>

              {detalhe.checklistItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhum item no checklist.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {detalhe.checklistItems.map((item, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        disabled={!canEditar || checklistMutation.isPending || detalhe.status === 'concluido' || detalhe.status === 'cancelado'}
                        onClick={() => handleToggleItem(i)}
                        className={cn(
                          'flex items-center gap-2.5 w-full text-left rounded-md px-2 py-1.5 text-sm transition-colors',
                          'hover:bg-muted/60 disabled:opacity-60 disabled:cursor-not-allowed',
                          item.concluido ? 'text-foreground' : 'text-foreground/70'
                        )}
                      >
                        {item.concluido ? (
                          <CheckSquare className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className={cn(item.concluido && 'line-through text-muted-foreground')}>
                          {item.descricao}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Ações */}
            {(canConcluir || canCancelar) && (detalhe.status === 'pendente' || detalhe.status === 'em_andamento') && (
              <div className="flex gap-2 justify-end pt-1">
                {canCancelar && (
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => onCancelar(detalhe)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar Processo
                  </Button>
                )}
                {canConcluir && (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => onConcluir(detalhe)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Concluir Desligamento
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

// ============================================================
// Modal: Confirmar Concluir
// ============================================================

function ModalConfirmarConcluir({
  desligamento,
  open,
  onClose,
  onConfirm,
}: {
  desligamento: DesligamentoDetalhe | null
  open: boolean
  onClose: () => void
  onConfirm: (observacoes: string) => void
}) {
  const [obs, setObs] = useState('')
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            Concluir Desligamento
          </DialogTitle>
          <DialogDescription>
            Confirme a conclusão do processo de desligamento
            {desligamento ? ` de ${desligamento.colaborador.nome}` : ''}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Observações finais (opcional)</label>
            <Textarea
              placeholder="Registre informações adicionais sobre a conclusão..."
              value={obs}
              onChange={e => setObs(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => onConfirm(obs)}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Confirmar Conclusão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Modal: Confirmar Cancelar
// ============================================================

function ModalConfirmarCancelar({
  desligamento,
  open,
  onClose,
  onConfirm,
}: {
  desligamento: DesligamentoDetalhe | null
  open: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Cancelar Processo
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja cancelar o processo de desligamento
            {desligamento ? ` de ${desligamento.colaborador.nome}` : ''}?
            Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button variant="destructive" onClick={onConfirm}>
            <XCircle className="h-4 w-4 mr-2" />
            Confirmar Cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Page
// ============================================================

export default function DesligamentoPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const canVisualizar = isFullAccess || isGerenteGeral() || hasPermission('rh_desligamento', 'visualizar')
  const canCriar     = isFullAccess || isGerenteGeral() || hasPermission('rh_desligamento', 'criar')
  const canEditar    = isFullAccess || isGerenteGeral() || hasPermission('rh_desligamento', 'editar')
  const canConcluir  = isFullAccess || isGerenteGeral() || hasPermission('rh_desligamento', 'concluir')
  const canCancelar  = isFullAccess || isGerenteGeral() || hasPermission('rh_desligamento', 'cancelar')

  const queryClient = useQueryClient()

  // Filters & pagination
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState<string>('todos')
  const [page, setPage]             = useState(1)
  const limit = 20

  // Modal state
  const [showNovo, setShowNovo]               = useState(false)
  const [selectedId, setSelectedId]           = useState<string | null>(null)
  const [showDetalhes, setShowDetalhes]        = useState(false)
  const [pendingConcluir, setPendingConcluir]  = useState<DesligamentoDetalhe | null>(null)
  const [pendingCancelar, setPendingCancelar]  = useState<DesligamentoDetalhe | null>(null)

  // Query
  const { data, isLoading, isError } = useQuery<PaginatedDesligamento>({
    queryKey: ['rh', 'desligamento', { page, limit, status: statusFilter, search }],
    queryFn: () =>
      api.get('/rh/desligamento', {
        page,
        limit,
        ...(statusFilter !== 'todos' && { status: statusFilter }),
        ...(search && { search }),
      }),
    enabled: canVisualizar,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1

  // Mutations
  const concluirMutation = useMutation({
    mutationFn: ({ id, observacoes }: { id: string; observacoes?: string }) =>
      api.patch(`/rh/desligamento/${id}/concluir`, { observacoes }),
    onSuccess: () => {
      toast.success('Desligamento concluído com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['rh', 'desligamento'] })
      setPendingConcluir(null)
      setShowDetalhes(false)
    },
    onError: () => toast.error('Erro ao concluir desligamento.'),
  })

  const cancelarMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/rh/desligamento/${id}/cancelar`, {}),
    onSuccess: () => {
      toast.success('Processo cancelado.')
      queryClient.invalidateQueries({ queryKey: ['rh', 'desligamento'] })
      setPendingCancelar(null)
      setShowDetalhes(false)
    },
    onError: () => toast.error('Erro ao cancelar processo.'),
  })

  const handleOpenDetalhes = (id: string) => {
    setSelectedId(id)
    setShowDetalhes(true)
  }

  if (!canVisualizar) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertTriangle className="h-10 w-10" />
        <p className="text-sm">Você não tem permissão para acessar esta página.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserMinus className="h-6 w-6 text-muted-foreground" />
            Desligamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie os processos de desligamento de colaboradores.
          </p>
        </div>
        {canCriar && (
          <Button onClick={() => setShowNovo(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Desligamento
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar colaborador..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatus(v); setPage(1) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        {total > 0 && (
          <span className="text-sm text-muted-foreground ml-auto">
            {total} registro{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm">Erro ao carregar os desligamentos.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
          <UserMinus className="h-10 w-10 opacity-40" />
          <p className="text-sm">Nenhum desligamento encontrado.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(item => (
            <DesligamentoCard
              key={item.id}
              item={item}
              canEditar={canEditar}
              canConcluir={canConcluir}
              canCancelar={canCancelar}
              onVerDetalhes={() => handleOpenDetalhes(item.id)}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            Página {page} de {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Modals */}
      <ModalNovoDesligamento
        open={showNovo}
        onClose={() => setShowNovo(false)}
        onSuccess={() => setShowNovo(false)}
      />

      <ModalDetalhes
        desligamentoId={selectedId}
        open={showDetalhes}
        onClose={() => { setShowDetalhes(false); setSelectedId(null) }}
        canEditar={canEditar}
        canConcluir={canConcluir}
        canCancelar={canCancelar}
        onConcluir={d => { setPendingConcluir(d) }}
        onCancelar={d => { setPendingCancelar(d) }}
      />

      <ModalConfirmarConcluir
        desligamento={pendingConcluir}
        open={!!pendingConcluir}
        onClose={() => setPendingConcluir(null)}
        onConfirm={obs => {
          if (!pendingConcluir) return
          concluirMutation.mutate({ id: pendingConcluir.id, observacoes: obs || undefined })
        }}
      />

      <ModalConfirmarCancelar
        desligamento={pendingCancelar}
        open={!!pendingCancelar}
        onClose={() => setPendingCancelar(null)}
        onConfirm={() => {
          if (!pendingCancelar) return
          cancelarMutation.mutate(pendingCancelar.id)
        }}
      />
    </div>
  )
}

// ============================================================
// Card de Desligamento
// ============================================================

function DesligamentoCard({
  item,
  canEditar,
  canConcluir,
  canCancelar,
  onVerDetalhes,
}: {
  item: Desligamento
  canEditar: boolean
  canConcluir: boolean
  canCancelar: boolean
  onVerDetalhes: () => void
}) {
  const isAtivo = item.status === 'pendente' || item.status === 'em_andamento'

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 flex flex-col gap-3 transition-shadow hover:shadow-sm',
      item.status === 'cancelado' && 'opacity-60',
    )}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Info principal */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base truncate">{item.colaborador.nome}</span>
            <span className="text-xs text-muted-foreground font-mono">{item.colaborador.matricula}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {item.colaborador.cargo && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {item.colaborador.cargo.nome}
              </span>
            )}
            {item.colaborador.unit && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {item.colaborador.unit.nome}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Desligamento: {formatDate(item.dataDesligamento)}
            </span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <TipoBadge tipo={item.tipo} />
          <StatusBadge status={item.status} />
        </div>
      </div>

      {/* Checklist progress */}
      {item.checklistItems && item.checklistItems.length > 0 && (
        <div className="max-w-xs">
          <ChecklistProgress items={item.checklistItems} />
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
        <Button variant="outline" size="sm" onClick={onVerDetalhes}>
          <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
          Ver / Editar Checklist
        </Button>
        {isAtivo && canConcluir && (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={onVerDetalhes}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Concluir
          </Button>
        )}
        {isAtivo && canCancelar && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={onVerDetalhes}
          >
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            Cancelar
          </Button>
        )}
        {item.registradoPor && (
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Registrado por {item.registradoPor.nome}
          </span>
        )}
      </div>
    </div>
  )
}
