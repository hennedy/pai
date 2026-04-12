'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Users,
  Plus,
  Search,
  Loader2,
  User,
  Building2,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  X,
  AlertTriangle,
  Filter,
  UserCheck,
  UserX,
  Clock,
  Plane,
  Link2,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Pencil,
  Shield,
  ShieldCheck,
  Trash2,
  ClipboardCheck,
  Hash,
  ShoppingCart,
  Package,
  Wheat,
  ArrowRightLeft,
  PackageX,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface Colaborador {
  id: string
  matricula: string
  nome: string
  primeiroNome: string | null
  nomeSocial: string | null
  email: string | null
  emailCorporativo: string | null
  telefone: string | null
  celular: string | null
  tipoContrato: string
  dataAdmissao: string | null
  status: string
  fotoUrl: string | null
  departamento: string | null
  unit: { id: string; nome: string; codigo: string }
  cargo: { id: string; nome: string; nivel: string } | null
  gestorDireto: { id: string; nome: string; fotoUrl: string | null } | null
}

interface PaginatedResponse {
  data: Colaborador[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

interface Cargo {
  id: string
  nome: string
  nivel: string
  familia: { nome: string } | null
}

// ============================================================
// Config
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  ativo:     { label: 'Ativo',     icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700' },
  inativo:   { label: 'Inativo',   icon: UserX,     color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-900/20',         border: 'border-red-200 dark:border-red-700' },
  ferias:    { label: 'Ferias',    icon: Plane,     color: 'text-sky-600',     bg: 'bg-sky-50 dark:bg-sky-900/20',         border: 'border-sky-200 dark:border-sky-700' },
  afastado:  { label: 'Afastado',  icon: Clock,     color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/20',     border: 'border-amber-200 dark:border-amber-700' },
  desligado: { label: 'Desligado', icon: UserX,     color: 'text-muted-foreground', bg: 'bg-muted/30', border: 'border-border/50' },
}

const CONTRATO_LABELS: Record<string, string> = {
  clt: 'CLT', pj: 'PJ', estagio: 'Estagio', aprendiz: 'Aprendiz', temporario: 'Temporario', autonomo: 'Autonomo',
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ativo
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border', cfg.bg, cfg.color, cfg.border)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

function UserSearchSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [search, setSearch] = useState('')
  const { data, isFetching } = useQuery({
    queryKey: ['users', 'search', search],
    queryFn: () => api.get('/users', { search: search || undefined, limit: 20 }) as Promise<{ data: { id: string; nome: string; email: string }[] }>,
    enabled: search.length >= 2,
    staleTime: 30000,
  })
  const users = data?.data || []

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar usuario por nome..."
          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
        />
        {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground/40" />}
      </div>
      {search.length >= 2 && users.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden max-h-36 overflow-y-auto">
          {users.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => { onChange(u.id); setSearch('') }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-white">{u.nome.charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{u.nome}</p>
                <p className="text-[10px] text-muted-foreground/40 truncate">{u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {search.length >= 2 && !isFetching && users.length === 0 && (
        <p className="text-xs text-muted-foreground/40 px-1">Nenhum usuario encontrado</p>
      )}
    </div>
  )
}

function AvatarColaborador({ nome, fotoUrl, size = 'md' }: { nome: string; fotoUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-base' }
  const initials = nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  if (fotoUrl) {
    return <img src={fotoUrl} alt={nome} className={cn('rounded-full object-cover shrink-0', sizes[size])} />
  }
  return (
    <div className={cn('rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shrink-0 font-bold text-white', sizes[size])}>
      {initials}
    </div>
  )
}

// ============================================================
// Page
// ============================================================

export default function ColaboradoresPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const canVisualizar = isFullAccess || isGerenteGeral() || hasPermission('rh_colaboradores', 'visualizar')
  const canCriar = isFullAccess || isGerenteGeral() || hasPermission('rh_colaboradores', 'criar')
  const canEditar = isFullAccess || isGerenteGeral() || hasPermission('rh_colaboradores', 'editar')

  const queryClient = useQueryClient()

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTipoContrato, setFilterTipoContrato] = useState('')
  const [filterCargoId, setFilterCargoId] = useState('')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  // Modal create
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null)

  // Modal edit
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingColaborador, setEditingColaborador] = useState<Colaborador | null>(null)
  const [editForm, setEditForm] = useState({
    nome: '', primeiroNome: '', cargoId: '', departamento: '',
    dataAdmissao: '', email: '', emailCorporativo: '', telefone: '', celular: '',
  })

  // Modal PIN
  const [pinModal, setPinModal] = useState<{ id: string; nome: string } | null>(null)
  const [pinData, setPinData] = useState<string | null>(null)
  const [pinLoading, setPinLoading] = useState(false)
  const [pinCopied, setPinCopied] = useState(false)

  // Modal Permissões Totem
  type TotemModulo = 'checklists' | 'contagem_utensilios' | 'contagem_paes' | 'contagem_descartes' | 'contagem_transferencias' | 'requisicoes'
  type TotemPermUnit = { unitId: string; unit: { id: string; nome: string; codigo: string }; permissoes: TotemModulo[] }
  const [permModal, setPermModal] = useState<{ id: string; nome: string } | null>(null)
  const [permData, setPermData] = useState<TotemPermUnit[]>([])
  const [permLoading, setPermLoading] = useState(false)
  const [permSaving, setPermSaving] = useState<string | null>(null)
  const [permAddUnitId, setPermAddUnitId] = useState('')

  // Form
  const [form, setForm] = useState({
    nome: '', primeiroNome: '', unitId: '', cargoId: '', tipoContrato: 'clt',
    dataAdmissao: '', email: '', emailCorporativo: '', telefone: '', celular: '',
    departamento: '', cpf: '', salarioBase: '', userId: '',
  })

  // CPF-based user suggestion
  const [cpfUserMatch, setCpfUserMatch] = useState<{ id: string; nome: string; email: string } | null>(null)
  const [cpfSearching, setCpfSearching] = useState(false)
  const cpfDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced CPF lookup for user suggestion
  useEffect(() => {
    const cpfClean = form.cpf.replace(/\D/g, '')
    if (cpfClean.length !== 11) {
      setCpfUserMatch(null)
      return
    }
    // If userId is already manually set, don't override
    if (form.userId) return

    if (cpfDebounceRef.current) clearTimeout(cpfDebounceRef.current)
    setCpfSearching(true)
    cpfDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/users', { cpf: cpfClean, limit: 1 }) as any
        const users = res?.data || []
        if (users.length > 0) {
          setCpfUserMatch({ id: users[0].id, nome: users[0].nome, email: users[0].email })
        } else {
          setCpfUserMatch(null)
        }
      } catch {
        setCpfUserMatch(null)
      } finally {
        setCpfSearching(false)
      }
    }, 500)
    return () => { if (cpfDebounceRef.current) clearTimeout(cpfDebounceRef.current) }
  }, [form.cpf]) // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // Queries
  // ============================================================

  const { data, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ['rh', 'colaboradores', { page, search, filterStatus, filterTipoContrato, filterCargoId }],
    queryFn: () => api.get('/rh/colaboradores', {
      page,
      limit: 20,
      ...(search && { search }),
      ...(filterStatus && { status: filterStatus }),
      ...(filterTipoContrato && { tipoContrato: filterTipoContrato }),
      ...(filterCargoId && { cargoId: filterCargoId }),
    }),
    enabled: canVisualizar,
  })

  const { data: cargosData } = useQuery<{ data: Cargo[] }>({
    queryKey: ['rh', 'cargos', 'lista'],
    queryFn: () => api.get('/rh/cargos', { status: 'ativo', limit: 100 }),
    enabled: canVisualizar,
  })

  const { data: unitsData } = useQuery<{ data: any[] }>({
    queryKey: ['units', 'simple'],
    queryFn: () => api.get('/units', { limit: 100 }) as Promise<{ data: any[] }>,
    enabled: canCriar || canEditar,
  })
  const units = unitsData?.data

  // ============================================================
  // Mutations
  // ============================================================

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/rh/colaboradores', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh', 'colaboradores'] })
      toast.success('Colaborador cadastrado com sucesso')
      setModalOpen(false)
      resetForm()
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao cadastrar colaborador'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/rh/colaboradores/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh', 'colaboradores'] })
      toast.success('Status atualizado')
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar status'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/rh/colaboradores/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh', 'colaboradores'] })
      toast.success('Colaborador atualizado com sucesso')
      setEditModalOpen(false)
      setEditingColaborador(null)
      setSelectedColaborador(null)
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar colaborador'),
  })

  // ============================================================
  // Handlers
  // ============================================================

  function resetForm() {
    setForm({ nome: '', primeiroNome: '', unitId: '', cargoId: '', tipoContrato: 'clt', dataAdmissao: '', email: '', emailCorporativo: '', telefone: '', celular: '', departamento: '', cpf: '', salarioBase: '', userId: '' })
    setCpfUserMatch(null)
  }

  function openEditModal(col: Colaborador) {
    setEditingColaborador(col)
    setEditForm({
      nome: col.nome,
      primeiroNome: col.primeiroNome || '',
      cargoId: col.cargo?.id || '',
      departamento: col.departamento || '',
      dataAdmissao: col.dataAdmissao ? col.dataAdmissao.split('T')[0] : '',
      email: col.email || '',
      emailCorporativo: col.emailCorporativo || '',
      telefone: col.telefone || '',
      celular: col.celular || '',
    })
    setEditModalOpen(true)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingColaborador) return
    const data: any = { nome: editForm.nome }
    if (editForm.primeiroNome) data.primeiroNome = editForm.primeiroNome
    if (editForm.cargoId) data.cargoId = editForm.cargoId
    if (editForm.departamento) data.departamento = editForm.departamento
    if (editForm.dataAdmissao) data.dataAdmissao = editForm.dataAdmissao
    if (editForm.email) data.email = editForm.email
    if (editForm.emailCorporativo) data.emailCorporativo = editForm.emailCorporativo
    if (editForm.telefone) data.telefone = editForm.telefone
    if (editForm.celular) data.celular = editForm.celular
    editMutation.mutate({ id: editingColaborador.id, data })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data: any = {
      nome: form.nome,
      unitId: form.unitId,
      tipoContrato: form.tipoContrato,
    }
    if (form.primeiroNome) data.primeiroNome = form.primeiroNome
    if (form.cargoId) data.cargoId = form.cargoId
    if (form.dataAdmissao) data.dataAdmissao = form.dataAdmissao
    if (form.email) data.email = form.email
    if (form.emailCorporativo) data.emailCorporativo = form.emailCorporativo
    if (form.telefone) data.telefone = form.telefone
    if (form.celular) data.celular = form.celular
    if (form.departamento) data.departamento = form.departamento
    if (form.cpf) data.cpf = form.cpf.replace(/\D/g, '')
    if (form.salarioBase) data.salarioBase = parseFloat(form.salarioBase)
    if (form.userId) data.userId = form.userId

    createMutation.mutate(data)
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  const activeFilters = [filterStatus, filterTipoContrato, filterCargoId].filter(Boolean).length
  const colaboradores = data?.data || []
  const pagination = data?.pagination

  async function openPinModal(colab: Colaborador) {
    setPinModal({ id: colab.id, nome: colab.nomeSocial || colab.nome })
    setPinData(null)
    setPinCopied(false)
    setPinLoading(true)
    try {
      const res = await api.get(`/rh/colaboradores/${colab.id}/pin`)
      setPinData(res.pin ?? null)
    } catch {
      setPinData(null)
    } finally {
      setPinLoading(false)
    }
  }

  async function regeneratePin() {
    if (!pinModal) return
    setPinLoading(true)
    try {
      const res = await api.post(`/rh/colaboradores/${pinModal.id}/regenerate-pin`)
      setPinData(res.pin)
      setPinCopied(false)
      toast.success('PIN regenerado com sucesso!')
    } catch {
      toast.error('Erro ao regenerar PIN')
    } finally {
      setPinLoading(false)
    }
  }

  async function openPermModal(colab: Colaborador) {
    setPermModal({ id: colab.id, nome: colab.nomeSocial || colab.nome })
    setPermData([])
    setPermAddUnitId('')
    setPermLoading(true)
    try {
      const res = await api.get(`/rh/colaboradores/${colab.id}/totem-permissoes`)
      setPermData(res as TotemPermUnit[])
    } catch {
      setPermData([])
    } finally {
      setPermLoading(false)
    }
  }

  async function savePermissoes(unitId: string, permissoes: TotemModulo[]) {
    if (!permModal) return
    setPermSaving(unitId)
    try {
      await api.put(`/rh/colaboradores/${permModal.id}/totem-permissoes/${unitId}`, { permissoes })
      setPermData(prev => {
        const existing = prev.find(p => p.unitId === unitId)
        if (existing) return prev.map(p => p.unitId === unitId ? { ...p, permissoes } : p)
        return prev
      })
      toast.success('Permissões atualizadas!')
    } catch {
      toast.error('Erro ao salvar permissões')
    } finally {
      setPermSaving(null)
    }
  }

  async function addUnitTotem() {
    if (!permModal || !permAddUnitId) return
    if (permData.some(p => p.unitId === permAddUnitId)) return
    const unit = (unitsData?.data || []).find((u: any) => u.id === permAddUnitId)
    if (!unit) return
    setPermSaving(permAddUnitId)
    try {
      await api.put(`/rh/colaboradores/${permModal.id}/totem-permissoes/${permAddUnitId}`, { permissoes: [] })
      setPermData(prev => [...prev, { unitId: permAddUnitId, unit: { id: unit.id, nome: unit.nome, codigo: unit.codigo }, permissoes: [] }])
      setPermAddUnitId('')
      toast.success('Unidade adicionada!')
    } catch {
      toast.error('Erro ao adicionar unidade')
    } finally {
      setPermSaving(null)
    }
  }

  async function removeUnitTotem(unitId: string) {
    if (!permModal) return
    setPermSaving(unitId)
    try {
      await api.delete(`/rh/colaboradores/${permModal.id}/totem-permissoes/${unitId}`)
      setPermData(prev => prev.filter(p => p.unitId !== unitId))
      toast.success('Acesso removido!')
    } catch {
      toast.error('Erro ao remover unidade')
    } finally {
      setPermSaving(null)
    }
  }

  function togglePermissao(unitId: string, modulo: TotemModulo) {
    const unit = permData.find(p => p.unitId === unitId)
    if (!unit) return
    const newPerms = unit.permissoes.includes(modulo)
      ? unit.permissoes.filter(p => p !== modulo)
      : [...unit.permissoes, modulo]
    savePermissoes(unitId, newPerms)
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          icon={Users}
          iconGradient="from-emerald-500 to-emerald-700"
          title="Colaboradores"
          description="Diretorio completo de colaboradores da empresa"
        />
        {canCriar && (
          <Button
            onClick={() => { resetForm(); setModalOpen(true) }}
            size="lg"
            className="w-full sm:w-auto gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md shadow-emerald-500/20"
          >
            <Plus className="h-4 w-4" />
            Novo Colaborador
          </Button>
        )}
      </div>

      {/* Search + Filters */}
      {canVisualizar && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Buscar por nome, matricula, CPF ou email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-muted-foreground/40" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(p => !p)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all',
                showFilters || activeFilters > 0
                  ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                  : 'border-border text-muted-foreground hover:bg-muted/40'
              )}
            >
              <Filter className="h-4 w-4" />
              {activeFilters > 0 && (
                <span className="h-5 w-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">{activeFilters}</span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-border/50 bg-muted/20">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Status</label>
                <select
                  value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="">Todos</option>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Tipo de contrato</label>
                <select
                  value={filterTipoContrato}
                  onChange={e => { setFilterTipoContrato(e.target.value); setPage(1) }}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="">Todos</option>
                  {Object.entries(CONTRATO_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Cargo</label>
                <select
                  value={filterCargoId}
                  onChange={e => { setFilterCargoId(e.target.value); setPage(1) }}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="">Todos</option>
                  {cargosData?.data?.map((c: Cargo) => (
                    <option key={c.id} value={c.id}>
                      {c.familia ? `${c.familia.nome} / ` : ''}{c.nome}
                    </option>
                  ))}
                </select>
              </div>
              {activeFilters > 0 && (
                <button
                  onClick={() => { setFilterStatus(''); setFilterTipoContrato(''); setFilterCargoId(''); setPage(1) }}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground underline sm:col-span-3 text-left"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary bar */}
      {canVisualizar && pagination && (
        <div className="flex items-center justify-between text-sm text-muted-foreground/50">
          <span>{pagination.total} colaborador{pagination.total !== 1 ? 'es' : ''} encontrado{pagination.total !== 1 ? 's' : ''}</span>
          {pagination.totalPages > 1 && (
            <span>Pagina {pagination.page} de {pagination.totalPages}</span>
          )}
        </div>
      )}

      {/* List */}
      {canVisualizar && (
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
            </div>
          ) : colaboradores.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/50 p-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground/50">
                {search || activeFilters > 0 ? 'Nenhum colaborador encontrado com esses filtros' : 'Nenhum colaborador cadastrado'}
              </p>
              {canCriar && !search && activeFilters === 0 && (
                <Button onClick={() => { resetForm(); setModalOpen(true) }} variant="outline" size="sm" className="mt-4 gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  Cadastrar primeiro colaborador
                </Button>
              )}
            </div>
          ) : (
            <>
              {colaboradores.map(col => (
                <div
                  key={col.id}
                  className="flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-card hover:border-border/80 hover:shadow-warm-sm transition-all cursor-pointer group"
                  onClick={() => setSelectedColaborador(col)}
                >
                  <AvatarColaborador nome={col.nome} fotoUrl={col.fotoUrl} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{col.nomeSocial || col.nome}</p>
                      <StatusBadge status={col.status} />
                      <span className="text-[10px] font-semibold bg-muted/50 text-muted-foreground/50 px-1.5 py-0.5 rounded">
                        {CONTRATO_LABELS[col.tipoContrato] || col.tipoContrato}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {col.cargo && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                          <Briefcase className="h-3 w-3" />
                          {col.cargo.nome}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
                        <Building2 className="h-3 w-3" />
                        {col.unit.codigo}
                      </span>
                      {col.departamento && (
                        <span className="text-[11px] text-muted-foreground/40">{col.departamento}</span>
                      )}
                      {col.dataAdmissao && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/35">
                          <Calendar className="h-3 w-3" />
                          {formatDate(col.dataAdmissao)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-muted-foreground/30">{col.matricula}</span>
                    {canEditar && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); openPermModal(col) }}
                          title="Permissões Totem"
                          className="p-1 rounded hover:bg-accent text-muted-foreground/40 hover:text-indigo-500 transition"
                        >
                          <Shield className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openPinModal(col) }}
                          title="PIN do Totem"
                          className="p-1 rounded hover:bg-accent text-muted-foreground/40 hover:text-amber-500 transition"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline" size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground/50 px-2">
                    {page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline" size="sm"
                    disabled={page === pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Proxima
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Modal — Novo Colaborador */}
      {/* ============================================================ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-full max-w-lg flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <Users className="h-[18px] w-[18px] text-emerald-600" />
                </div>
                Novo Colaborador
              </DialogTitle>
              <DialogDescription>Preencha os dados basicos. Mais informacoes podem ser adicionadas no perfil completo.</DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-2">
              {/* Nome */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Nome completo <span className="text-destructive">*</span></label>
                <input
                  value={form.nome}
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  placeholder="Nome completo do colaborador"
                />
              </div>

              {/* Primeiro nome */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Primeiro nome</label>
                <input
                  value={form.primeiroNome}
                  onChange={e => setForm(p => ({ ...p, primeiroNome: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  placeholder="Como será exibido no sistema"
                />
              </div>

              {/* Unidade + Tipo contrato */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Unidade <span className="text-destructive">*</span></label>
                  <select
                    value={form.unitId}
                    onChange={e => setForm(p => ({ ...p, unitId: e.target.value }))}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  >
                    <option value="">Selecione...</option>
                    {units?.map?.((u: any) => (
                      <option key={u.id} value={u.id}>{u.codigo} — {u.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Tipo de contrato <span className="text-destructive">*</span></label>
                  <select
                    value={form.tipoContrato}
                    onChange={e => setForm(p => ({ ...p, tipoContrato: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  >
                    {Object.entries(CONTRATO_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cargo + Departamento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Cargo <span className="text-muted-foreground/40 text-xs font-normal">(opcional)</span></label>
                  <select
                    value={form.cargoId}
                    onChange={e => setForm(p => ({ ...p, cargoId: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  >
                    <option value="">Sem cargo</option>
                    {cargosData?.data?.map((c: Cargo) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Departamento <span className="text-muted-foreground/40 text-xs font-normal">(opcional)</span></label>
                  <input
                    value={form.departamento}
                    onChange={e => setForm(p => ({ ...p, departamento: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="Ex: Producao, Atendimento..."
                  />
                </div>
              </div>

              {/* Data admissão + Salário */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Data de admissao <span className="text-muted-foreground/40 text-xs font-normal">(opcional)</span></label>
                  <input
                    type="date"
                    value={form.dataAdmissao}
                    onChange={e => setForm(p => ({ ...p, dataAdmissao: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Salario base <span className="text-muted-foreground/40 text-xs font-normal">(opcional)</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 font-medium">R$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.salarioBase}
                      onChange={e => setForm(p => ({ ...p, salarioBase: e.target.value }))}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Email pessoal <span className="text-muted-foreground/40 text-xs font-normal">(opcional)</span></label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="email@pessoal.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Celular <span className="text-muted-foreground/40 text-xs font-normal">(opcional)</span></label>
                  <input
                    value={form.celular}
                    onChange={e => setForm(p => ({ ...p, celular: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              {/* CPF */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">CPF <span className="text-muted-foreground/40 text-xs font-normal">(opcional)</span></label>
                <div className="relative">
                  <input
                    value={form.cpf}
                    onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                  {cpfSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground/40" />
                  )}
                </div>

                {/* Suggestion banner */}
                {cpfUserMatch && !form.userId && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      <span className="text-xs text-blue-700 dark:text-blue-400 truncate">
                        Usuário encontrado: <strong>{cpfUserMatch.nome}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, userId: cpfUserMatch.id }))}
                      className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      Vincular
                    </button>
                  </div>
                )}
              </div>

              {/* Vincular usuario */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Vincular usuario do sistema <span className="text-muted-foreground/40 text-xs font-normal">(opcional)</span></label>
                {form.userId ? (
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-sm text-emerald-700 dark:text-emerald-400">
                        {cpfUserMatch?.nome || 'Usuario selecionado'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, userId: '' }))}
                      className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <UserSearchSelect
                    value={form.userId}
                    onChange={userId => setForm(p => ({ ...p, userId }))}
                  />
                )}
              </div>
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background">
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md"
                >
                  {createMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cadastrando...</>
                  ) : 'Cadastrar Colaborador'}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Drawer — Detalhe do colaborador */}
      {/* ============================================================ */}
      <Dialog open={!!selectedColaborador} onOpenChange={() => setSelectedColaborador(null)}>
        <DialogContent className="w-full max-w-md flex flex-col max-h-[90dvh] overflow-hidden p-0">
          {selectedColaborador && (
            <>
              {/* Header colorido */}
              <div className="shrink-0 bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 px-6 pt-6 pb-4 border-b border-border/50">
                <div className="flex items-center gap-4">
                  <AvatarColaborador nome={selectedColaborador.nome} fotoUrl={selectedColaborador.fotoUrl} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-lg leading-tight">{selectedColaborador.nomeSocial || selectedColaborador.nome}</h2>
                    {selectedColaborador.nomeSocial && (
                      <p className="text-xs text-muted-foreground/50">{selectedColaborador.nome}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusBadge status={selectedColaborador.status} />
                      <span className="text-[10px] font-semibold bg-muted/50 text-muted-foreground/50 px-1.5 py-0.5 rounded">
                        {CONTRATO_LABELS[selectedColaborador.tipoContrato]}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Informações */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">Informacoes</p>
                  <div className="space-y-2">
                    <InfoRow icon={Briefcase} label="Cargo" value={selectedColaborador.cargo?.nome || '—'} />
                    <InfoRow icon={Building2} label="Unidade" value={`${selectedColaborador.unit.codigo} — ${selectedColaborador.unit.nome}`} />
                    {selectedColaborador.departamento && (
                      <InfoRow icon={Users} label="Departamento" value={selectedColaborador.departamento} />
                    )}
                    <InfoRow icon={Calendar} label="Admissao" value={formatDate(selectedColaborador.dataAdmissao)} />
                  </div>
                </div>

                {/* Contato */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">Contato</p>
                  <div className="space-y-2">
                    {(selectedColaborador.email || selectedColaborador.emailCorporativo) && (
                      <InfoRow icon={Mail} label="Email" value={selectedColaborador.emailCorporativo || selectedColaborador.email || '—'} />
                    )}
                    {(selectedColaborador.celular || selectedColaborador.telefone) && (
                      <InfoRow icon={Phone} label="Telefone" value={selectedColaborador.celular || selectedColaborador.telefone || '—'} />
                    )}
                  </div>
                </div>

                {/* Matricula */}
                <div className="rounded-xl bg-muted/30 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground/50 font-medium">Matricula</span>
                  <span className="font-mono font-bold text-sm">{selectedColaborador.matricula}</span>
                </div>

                {/* Ações rápidas de status */}
                {canEditar && selectedColaborador.status !== 'desligado' && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">Acoes rapidas</p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedColaborador.status !== 'ativo' && (
                        <button
                          onClick={() => { statusMutation.mutate({ id: selectedColaborador.id, status: 'ativo' }); setSelectedColaborador(null) }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 transition-all"
                        >
                          <UserCheck className="h-3.5 w-3.5" /> Ativar
                        </button>
                      )}
                      {selectedColaborador.status !== 'ferias' && (
                        <button
                          onClick={() => { statusMutation.mutate({ id: selectedColaborador.id, status: 'ferias' }); setSelectedColaborador(null) }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-400 text-xs font-semibold hover:bg-sky-100 transition-all"
                        >
                          <Plane className="h-3.5 w-3.5" /> Ferias
                        </button>
                      )}
                      {selectedColaborador.status !== 'afastado' && (
                        <button
                          onClick={() => { statusMutation.mutate({ id: selectedColaborador.id, status: 'afastado' }); setSelectedColaborador(null) }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-100 transition-all"
                        >
                          <Clock className="h-3.5 w-3.5" /> Afastar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="shrink-0 px-6 py-4 border-t border-border/50 flex gap-2">
                {canEditar && (
                  <Button
                    variant="outline"
                    className="gap-2 flex-1"
                    onClick={() => openEditModal(selectedColaborador!)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                )}
                <Button variant="outline" className="flex-1" onClick={() => setSelectedColaborador(null)}>Fechar</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Modal — Editar Colaborador */}
      {/* ============================================================ */}
      <Dialog open={editModalOpen} onOpenChange={open => { if (!open) { setEditModalOpen(false); setEditingColaborador(null) } }}>
        <DialogContent className="w-full max-w-lg flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                  <Pencil className="h-[18px] w-[18px] text-indigo-600" />
                </div>
                Editar Colaborador
              </DialogTitle>
              <DialogDescription>
                {editingColaborador?.nome} · {editingColaborador?.matricula}
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-2">
              {/* Nome */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Nome completo <span className="text-destructive">*</span></label>
                <input
                  value={editForm.nome}
                  onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  placeholder="Nome completo do colaborador"
                />
              </div>

              {/* Primeiro nome */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Primeiro nome</label>
                <input
                  value={editForm.primeiroNome}
                  onChange={e => setEditForm(p => ({ ...p, primeiroNome: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  placeholder="Como será exibido no sistema"
                />
              </div>

              {/* Cargo + Departamento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Cargo</label>
                  <select
                    value={editForm.cargoId}
                    onChange={e => setEditForm(p => ({ ...p, cargoId: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                  >
                    <option value="">Sem cargo</option>
                    {cargosData?.data?.map((c: Cargo) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Departamento</label>
                  <input
                    value={editForm.departamento}
                    onChange={e => setEditForm(p => ({ ...p, departamento: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="Ex: Producao, Atendimento..."
                  />
                </div>
              </div>

              {/* Data admissão */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Data de admissao</label>
                <input
                  type="date"
                  value={editForm.dataAdmissao}
                  onChange={e => setEditForm(p => ({ ...p, dataAdmissao: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                />
              </div>

              {/* Email */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Email pessoal</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="email@pessoal.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Email corporativo</label>
                  <input
                    type="email"
                    value={editForm.emailCorporativo}
                    onChange={e => setEditForm(p => ({ ...p, emailCorporativo: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="email@empresa.com"
                  />
                </div>
              </div>

              {/* Contato */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Celular</label>
                  <input
                    value={editForm.celular}
                    onChange={e => setEditForm(p => ({ ...p, celular: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Telefone</label>
                  <input
                    value={editForm.telefone}
                    onChange={e => setEditForm(p => ({ ...p, telefone: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder="(11) 3333-3333"
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background">
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => { setEditModalOpen(false); setEditingColaborador(null) }}>Cancelar</Button>
                <Button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-md"
                >
                  {editMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                  ) : 'Salvar Alterações'}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal PIN do Totem */}
      <Dialog open={!!pinModal} onOpenChange={(open) => { if (!open) setPinModal(null) }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-amber-500" /> PIN do Totem
            </DialogTitle>
            <DialogDescription>
              PIN de acesso ao totem de <strong>{pinModal?.nome}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {pinLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 py-2">
                  {pinData ? (
                    <>
                      <span className="text-4xl font-mono font-black tracking-[0.3em] text-foreground">
                        {pinData}
                      </span>
                      <button
                        onClick={() => {
                          if (navigator.clipboard?.writeText) {
                            navigator.clipboard.writeText(pinData)
                          } else {
                            const el = document.createElement('textarea')
                            el.value = pinData
                            document.body.appendChild(el)
                            el.select()
                            document.execCommand('copy')
                            document.body.removeChild(el)
                          }
                          setPinCopied(true)
                          setTimeout(() => setPinCopied(false), 2000)
                        }}
                        className="p-2 rounded-lg hover:bg-accent transition text-muted-foreground"
                        title="Copiar PIN"
                      >
                        {pinCopied
                          ? <Check className="h-4 w-4 text-emerald-500" />
                          : <Copy className="h-4 w-4" />}
                      </button>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm">Nenhum PIN gerado ainda</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/60 text-center">
                  Entregue este PIN ao colaborador para acesso ao totem.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={regeneratePin} disabled={pinLoading} className="flex items-center gap-2">
              {pinLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Regenerar
            </Button>
            <Button onClick={() => setPinModal(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Modal — Permissões Totem */}
      {/* ============================================================ */}
      <Dialog open={!!permModal} onOpenChange={(open) => { if (!open) setPermModal(null) }}>
        <DialogContent className="w-full max-w-lg flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                  <Shield className="h-[18px] w-[18px] text-indigo-600" />
                </div>
                Permissões no Totem
              </DialogTitle>
              <DialogDescription>
                Controle quais módulos <strong>{permModal?.nome}</strong> pode acessar em cada unidade.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {permLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {permData.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma unidade configurada. Adicione abaixo.</p>
                )}

                {permData.map((pu) => {
                  const modulos: { key: TotemModulo; label: string; icon: React.ElementType; color: string }[] = [
                    { key: 'checklists', label: 'Checklists', icon: ClipboardCheck, color: 'text-emerald-600' },
                    { key: 'contagem_utensilios', label: 'Utensílios', icon: Package, color: 'text-blue-600' },
                    { key: 'contagem_paes', label: 'Sobra de Pães', icon: Wheat, color: 'text-amber-600' },
                    { key: 'contagem_transferencias', label: 'Transferências', icon: ArrowRightLeft, color: 'text-sky-600' },
                    { key: 'contagem_descartes', label: 'Descartes', icon: PackageX, color: 'text-red-600' },
                    { key: 'requisicoes', label: 'Requisições', icon: ShoppingCart, color: 'text-orange-600' },
                  ]
                  const isSaving = permSaving === pu.unitId
                  return (
                    <div key={pu.unitId} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/30">
                        <div>
                          <p className="text-sm font-semibold">{pu.unit.nome}</p>
                          <p className="text-[11px] text-muted-foreground/50 font-mono">{pu.unit.codigo}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                          <button
                            onClick={() => removeUnitTotem(pu.unitId)}
                            disabled={isSaving}
                            className="p-1 rounded text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                            title="Remover acesso nesta unidade"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-2">
                        {modulos.map(({ key, label, icon: Icon, color }) => {
                          const active = pu.permissoes.includes(key)
                          return (
                            <button
                              key={key}
                              onClick={() => togglePermissao(pu.unitId, key)}
                              disabled={isSaving}
                              className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition',
                                active
                                  ? 'border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                  : 'border-border/50 bg-background text-muted-foreground hover:bg-muted/40',
                              )}
                            >
                              <Icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-indigo-600' : color)} />
                              {label}
                              {active && <ShieldCheck className="h-3 w-3 ml-auto shrink-0 text-indigo-500" />}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {/* Adicionar unidade */}
                <div className="rounded-xl border border-dashed border-border/50 p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Adicionar unidade</p>
                  <div className="flex gap-2">
                    <select
                      value={permAddUnitId}
                      onChange={(e) => setPermAddUnitId(e.target.value)}
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Selecione uma unidade...</option>
                      {(unitsData?.data || [])
                        .filter((u: any) => !permData.some(p => p.unitId === u.id))
                        .map((u: any) => (
                          <option key={u.id} value={u.id}>{u.codigo} — {u.nome}</option>
                        ))
                      }
                    </select>
                    <Button
                      onClick={addUnitTotem}
                      disabled={!permAddUnitId || !!permSaving}
                      size="sm"
                      className="gap-1.5 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="shrink-0 px-6 py-4 border-t border-border/50">
            <Button className="w-full" onClick={() => setPermModal(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-7 w-7 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground/40 font-medium">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  )
}
