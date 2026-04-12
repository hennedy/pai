'use client'

import { useState } from 'react'
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
import { toast } from 'sonner'
import {
  UserPlus,
  Plus,
  Search,
  Loader2,
  Send,
  CheckCircle,
  XCircle,
  Eye,
  Copy,
  Link,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  User,
  Briefcase,
  Mail,
  Calendar,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface Cargo {
  id: string
  nome: string
}

interface Colaborador {
  id: string
  nome: string
  matricula: string
  cargo: Cargo | null
}

interface AdmissaoItem {
  id: string
  status: string
  token: string | null
  emailEnviado: string | null
  dataEnvio: string | null
  dataExpiracao: string | null
  dataPreenchimento: string | null
  colaborador: {
    id: string
    nome: string
    matricula: string
    cargo: { nome: string } | null
  }
  criadoPor: { nome: string } | null
  aprovadoPor: { nome: string } | null
  observacoes?: string | null
  dadosPreenchidos?: Record<string, unknown> | null
}

interface PaginatedAdmissao {
  items: AdmissaoItem[]
  total: number
  page: number
  pages: number
}

interface ColaboradorList {
  data: Colaborador[]
  pagination: { total: number }
}

// ============================================================
// Config
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  rascunho:             { label: 'Rascunho',             color: 'text-zinc-600',   bg: 'bg-zinc-50 dark:bg-zinc-900/40',   border: 'border-zinc-200 dark:border-zinc-700' },
  enviado:              { label: 'Enviado',              color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20',   border: 'border-blue-200 dark:border-blue-700' },
  em_preenchimento:     { label: 'Em Preenchimento',     color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-700' },
  aguardando_aprovacao: { label: 'Aguardando Aprovação', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-700' },
  aprovado:             { label: 'Aprovado',             color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-700' },
  rejeitado:            { label: 'Rejeitado',            color: 'text-red-600',    bg: 'bg-red-50 dark:bg-red-900/20',     border: 'border-red-200 dark:border-red-700' },
  expirado:             { label: 'Expirado',             color: 'text-gray-500',   bg: 'bg-gray-50 dark:bg-gray-900/40',   border: 'border-gray-200 dark:border-gray-700' },
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'em_preenchimento', label: 'Em Preenchimento' },
  { value: 'aguardando_aprovacao', label: 'Aguardando Aprovação' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'rejeitado', label: 'Rejeitado' },
  { value: 'expirado', label: 'Expirado' },
]

function buildPublicLink(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')
  return `${base}/admissao/${token}`
}

function isExpired(dataExpiracao: string | null) {
  if (!dataExpiracao) return false
  return new Date(dataExpiracao) < new Date()
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ============================================================
// Sub-components
// ============================================================

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.rascunho
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border', cfg.bg, cfg.color, cfg.border)}>
      {cfg.label}
    </span>
  )
}

// ============================================================
// Page
// ============================================================

export default function AdmissaoPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const canVisualizar = isFullAccess || isGerenteGeral() || hasPermission('rh_admissao', 'visualizar')
  const canCriar     = isFullAccess || isGerenteGeral() || hasPermission('rh_admissao', 'criar')
  const canAprovar   = isFullAccess || isGerenteGeral() || hasPermission('rh_admissao', 'aprovar')
  const canRejeitar  = isFullAccess || isGerenteGeral() || hasPermission('rh_admissao', 'rejeitar')

  const queryClient = useQueryClient()

  // Filters & pagination
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)

  // Modal states
  const [modalNova, setModalNova] = useState(false)
  const [modalEnviar, setModalEnviar] = useState<AdmissaoItem | null>(null)
  const [modalDetalhes, setModalDetalhes] = useState<AdmissaoItem | null>(null)
  const [modalAprovar, setModalAprovar] = useState<AdmissaoItem | null>(null)
  const [modalRejeitar, setModalRejeitar] = useState<AdmissaoItem | null>(null)

  // Nova admissão form
  const [novaColaboradorId, setNovaColaboradorId] = useState('')
  const [novaEmail, setNovaEmail] = useState('')
  const [novaExpiracao, setNovaExpiracao] = useState('')
  const [novaObs, setNovaObs] = useState('')

  // Enviar link form
  const [enviarEmail, setEnviarEmail] = useState('')
  const [enviarExpiracao, setEnviarExpiracao] = useState('')

  // Aprovar/Rejeitar obs
  const [aprovObs, setAprovObs] = useState('')
  const [rejObs, setRejObs] = useState('')

  // Copiar link feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // ---- Queries ----

  const { data, isLoading } = useQuery<PaginatedAdmissao>({
    queryKey: ['rh', 'admissao', page, filterStatus, search],
    queryFn: () => api.get('/rh/admissao', { page, limit: 20, status: filterStatus || undefined, search: search || undefined }),
    enabled: canVisualizar,
  })

  const { data: colaboradoresData } = useQuery<ColaboradorList>({
    queryKey: ['rh', 'colaboradores-select'],
    queryFn: () => api.get('/rh/colaboradores', { page: 1, limit: 100 }),
    enabled: modalNova,
  })

  // Detalhes full
  const { data: detalhesData, isLoading: detalhesLoading } = useQuery<AdmissaoItem>({
    queryKey: ['rh', 'admissao', modalDetalhes?.id],
    queryFn: () => api.get(`/rh/admissao/${modalDetalhes!.id}`),
    enabled: !!modalDetalhes?.id,
  })

  // ---- Mutations ----

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['rh', 'admissao'] })

  const mutCriar = useMutation({
    mutationFn: (body: { colaboradorId: string; emailEnviado?: string; dataExpiracao?: string; observacoes?: string }) =>
      api.post('/rh/admissao', body),
    onSuccess: () => {
      toast.success('Admissão criada com sucesso.')
      invalidate()
      setModalNova(false)
      setNovaColaboradorId('')
      setNovaEmail('')
      setNovaExpiracao('')
      setNovaObs('')
    },
    onError: () => toast.error('Erro ao criar admissão.'),
  })

  const mutEnviar = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { emailEnviado: string; dataExpiracao?: string } }) =>
      api.patch(`/rh/admissao/${id}/enviar`, body),
    onSuccess: () => {
      toast.success('Link de admissão enviado.')
      invalidate()
      setModalEnviar(null)
      setEnviarEmail('')
      setEnviarExpiracao('')
    },
    onError: () => toast.error('Erro ao enviar link.'),
  })

  const mutAprovar = useMutation({
    mutationFn: ({ id, observacoes }: { id: string; observacoes?: string }) =>
      api.patch(`/rh/admissao/${id}/aprovar`, { observacoes }),
    onSuccess: () => {
      toast.success('Admissão aprovada.')
      invalidate()
      setModalAprovar(null)
      setAprovObs('')
    },
    onError: () => toast.error('Erro ao aprovar admissão.'),
  })

  const mutRejeitar = useMutation({
    mutationFn: ({ id, observacoes }: { id: string; observacoes: string }) =>
      api.patch(`/rh/admissao/${id}/rejeitar`, { observacoes }),
    onSuccess: () => {
      toast.success('Admissão rejeitada.')
      invalidate()
      setModalRejeitar(null)
      setRejObs('')
    },
    onError: () => toast.error('Erro ao rejeitar admissão.'),
  })

  // ---- Helpers ----

  function copyLink(item: AdmissaoItem) {
    if (!item.token) return
    const link = buildPublicLink(item.token)
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(item.id)
      toast.success('Link copiado!')
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function openEnviar(item: AdmissaoItem) {
    setEnviarEmail(item.emailEnviado ?? '')
    setEnviarExpiracao(item.dataExpiracao ? item.dataExpiracao.slice(0, 10) : '')
    setModalEnviar(item)
  }

  const showCopyLink = (status: string) =>
    !['rascunho', 'aprovado', 'rejeitado', 'expirado'].includes(status)

  if (!canVisualizar) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-muted-foreground">
        <AlertTriangle className="h-10 w-10" />
        <p className="text-lg font-medium">Acesso restrito</p>
        <p className="text-sm">Você não tem permissão para visualizar admissões digitais.</p>
      </div>
    )
  }

  const items = data?.items ?? []
  const totalPages = data?.pages ?? 1

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-indigo-500" />
            Admissão Digital
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie os processos de admissão digital de colaboradores.
          </p>
        </div>
        {canCriar && (
          <Button onClick={() => setModalNova(true)} className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            Nova Admissão
          </Button>
        )}
      </div>

      {/* ---- Filters ---- */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou matrícula..."
            className="pl-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ---- List ---- */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <FileText className="h-12 w-12 opacity-30" />
          <p className="font-medium">Nenhuma admissão encontrada</p>
          <p className="text-sm">Tente ajustar os filtros ou crie uma nova admissão.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(item => {
            const expired = isExpired(item.dataExpiracao)
            return (
              <div
                key={item.id}
                className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-sm transition-shadow"
              >
                {/* Avatar / initials */}
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shrink-0 font-bold text-white text-sm">
                  {item.colaborador.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold truncate">{item.colaborador.nome}</span>
                    <span className="text-xs text-muted-foreground">#{item.colaborador.matricula}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    {item.colaborador.cargo && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {item.colaborador.cargo.nome}
                      </span>
                    )}
                    {item.emailEnviado && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {item.emailEnviado}
                      </span>
                    )}
                    {item.dataExpiracao && (
                      <span className={cn('flex items-center gap-1', expired && 'text-red-500 font-medium')}>
                        {expired ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                        {expired ? 'Expirado em ' : 'Expira em '}
                        {formatDate(item.dataExpiracao)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {showCopyLink(item.status) && item.token && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => copyLink(item)}
                    >
                      {copiedId === item.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      Copiar Link
                    </Button>
                  )}

                  {(item.status === 'rascunho' || item.status === 'rejeitado') && canCriar && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => openEnviar(item)}
                    >
                      <Send className="h-3 w-3" />
                      Enviar Link
                    </Button>
                  )}

                  {item.status === 'aguardando_aprovacao' && canAprovar && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
                      onClick={() => { setAprovObs(''); setModalAprovar(item) }}
                    >
                      <CheckCircle className="h-3 w-3" />
                      Aprovar
                    </Button>
                  )}

                  {item.status === 'aguardando_aprovacao' && canRejeitar && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => { setRejObs(''); setModalRejeitar(item) }}
                    >
                      <XCircle className="h-3 w-3" />
                      Rejeitar
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setModalDetalhes(item)}
                  >
                    <Eye className="h-3 w-3" />
                    Detalhes
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---- Pagination ---- */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages} — {data?.total ?? 0} registros
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="gap-1"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ================================================================
          Modal: Nova Admissão
      ================================================================ */}
      <Dialog open={modalNova} onOpenChange={open => { if (!open) { setModalNova(false) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-indigo-500" />
              Nova Admissão Digital
            </DialogTitle>
            <DialogDescription>
              Selecione o colaborador e configure o envio do formulário de admissão.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Colaborador select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Colaborador <span className="text-red-500">*</span></label>
              <Select value={novaColaboradorId} onValueChange={setNovaColaboradorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o colaborador..." />
                </SelectTrigger>
                <SelectContent>
                  {(colaboradoresData?.data ?? []).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} — {c.matricula}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Email para envio</label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={novaEmail}
                onChange={e => setNovaEmail(e.target.value)}
              />
            </div>

            {/* Data expiração */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Data de expiração (opcional)</label>
              <Input
                type="date"
                value={novaExpiracao}
                onChange={e => setNovaExpiracao(e.target.value)}
              />
            </div>

            {/* Observações */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Observações (opcional)</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                placeholder="Observações sobre esta admissão..."
                value={novaObs}
                onChange={e => setNovaObs(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalNova(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!novaColaboradorId || mutCriar.isPending}
              onClick={() => mutCriar.mutate({
                colaboradorId: novaColaboradorId,
                emailEnviado: novaEmail || undefined,
                dataExpiracao: novaExpiracao || undefined,
                observacoes: novaObs || undefined,
              })}
            >
              {mutCriar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar Admissão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================
          Modal: Enviar Link
      ================================================================ */}
      <Dialog open={!!modalEnviar} onOpenChange={open => { if (!open) setModalEnviar(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              Enviar Link de Admissão
            </DialogTitle>
            <DialogDescription>
              {modalEnviar && (
                <>Enviar formulário para <strong>{modalEnviar.colaborador.nome}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Email de destino <span className="text-red-500">*</span></label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={enviarEmail}
                onChange={e => setEnviarEmail(e.target.value)}
              />
            </div>

            {/* Data expiração */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Data de expiração (opcional)</label>
              <Input
                type="date"
                value={enviarExpiracao}
                onChange={e => setEnviarExpiracao(e.target.value)}
              />
            </div>

            {/* Link copiável */}
            {modalEnviar?.token && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Link público</label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={buildPublicLink(modalEnviar.token)}
                    className="text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(buildPublicLink(modalEnviar!.token!))
                      toast.success('Link copiado!')
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEnviar(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!enviarEmail || mutEnviar.isPending}
              onClick={() => {
                if (!modalEnviar) return
                mutEnviar.mutate({
                  id: modalEnviar.id,
                  body: {
                    emailEnviado: enviarEmail,
                    dataExpiracao: enviarExpiracao || undefined,
                  },
                })
              }}
            >
              {mutEnviar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================
          Modal: Aprovar
      ================================================================ */}
      <Dialog open={!!modalAprovar} onOpenChange={open => { if (!open) setModalAprovar(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Aprovar Admissão
            </DialogTitle>
            <DialogDescription>
              {modalAprovar && (
                <>Confirmar aprovação da admissão de <strong>{modalAprovar.colaborador.nome}</strong>.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-2">
            <label className="text-sm font-medium">Observações (opcional)</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder="Observações sobre a aprovação..."
              value={aprovObs}
              onChange={e => setAprovObs(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAprovar(null)}>
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={mutAprovar.isPending}
              onClick={() => {
                if (!modalAprovar) return
                mutAprovar.mutate({ id: modalAprovar.id, observacoes: aprovObs || undefined })
              }}
            >
              {mutAprovar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================
          Modal: Rejeitar
      ================================================================ */}
      <Dialog open={!!modalRejeitar} onOpenChange={open => { if (!open) setModalRejeitar(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Rejeitar Admissão
            </DialogTitle>
            <DialogDescription>
              {modalRejeitar && (
                <>Rejeitar a admissão de <strong>{modalRejeitar.colaborador.nome}</strong>. Informe o motivo.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-2">
            <label className="text-sm font-medium">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder="Descreva o motivo da rejeição..."
              value={rejObs}
              onChange={e => setRejObs(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalRejeitar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!rejObs.trim() || mutRejeitar.isPending}
              onClick={() => {
                if (!modalRejeitar) return
                mutRejeitar.mutate({ id: modalRejeitar.id, observacoes: rejObs })
              }}
            >
              {mutRejeitar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================
          Modal: Detalhes (Drawer lateral simulado via Dialog)
      ================================================================ */}
      <Dialog open={!!modalDetalhes} onOpenChange={open => { if (!open) setModalDetalhes(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-indigo-500" />
              Detalhes da Admissão
            </DialogTitle>
            <DialogDescription>
              Informações completas do processo de admissão digital.
            </DialogDescription>
          </DialogHeader>

          {detalhesLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detalhesData ? (
            <div className="flex flex-col gap-5 py-2">
              {/* Status */}
              <div className="flex items-center gap-3">
                <StatusBadge status={detalhesData.status} />
                {detalhesData.dataExpiracao && isExpired(detalhesData.dataExpiracao) && (
                  <span className="flex items-center gap-1 text-xs text-red-500">
                    <AlertTriangle className="h-3 w-3" />
                    Link expirado
                  </span>
                )}
              </div>

              {/* Colaborador */}
              <Section title="Colaborador" icon={<User className="h-4 w-4" />}>
                <Row label="Nome" value={detalhesData.colaborador.nome} />
                <Row label="Matrícula" value={`#${detalhesData.colaborador.matricula}`} />
                {detalhesData.colaborador.cargo && (
                  <Row label="Cargo" value={detalhesData.colaborador.cargo.nome} />
                )}
              </Section>

              {/* Envio */}
              <Section title="Envio" icon={<Send className="h-4 w-4" />}>
                {detalhesData.emailEnviado && <Row label="Email" value={detalhesData.emailEnviado} />}
                <Row label="Data de envio" value={formatDateTime(detalhesData.dataEnvio)} />
                <Row label="Data de expiração" value={formatDateTime(detalhesData.dataExpiracao)} />
                <Row label="Preenchimento" value={formatDateTime(detalhesData.dataPreenchimento)} />
              </Section>

              {/* Link público */}
              {detalhesData.token && showCopyLink(detalhesData.status) && (
                <Section title="Link Público" icon={<Link className="h-4 w-4" />}>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      readOnly
                      value={buildPublicLink(detalhesData.token)}
                      className="text-xs font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(buildPublicLink(detalhesData.token!))
                        toast.success('Link copiado!')
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </Section>
              )}

              {/* Responsáveis */}
              <Section title="Responsáveis" icon={<User className="h-4 w-4" />}>
                {detalhesData.criadoPor && <Row label="Criado por" value={detalhesData.criadoPor.nome} />}
                {detalhesData.aprovadoPor && <Row label="Aprovado por" value={detalhesData.aprovadoPor.nome} />}
              </Section>

              {/* Observações */}
              {detalhesData.observacoes && (
                <Section title="Observações" icon={<FileText className="h-4 w-4" />}>
                  <p className="text-sm text-muted-foreground leading-relaxed">{detalhesData.observacoes}</p>
                </Section>
              )}

              {/* Dados preenchidos */}
              {detalhesData.dadosPreenchidos && Object.keys(detalhesData.dadosPreenchidos).length > 0 && (
                <Section title="Dados Preenchidos" icon={<FileText className="h-4 w-4" />}>
                  <div className="rounded-md border bg-muted/30 p-3 max-h-60 overflow-y-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(detalhesData.dadosPreenchidos, null, 2)}
                    </pre>
                  </div>
                </Section>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalDetalhes(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Helper components for Detalhes modal
// ============================================================

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1">
        {icon}
        {title}
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
