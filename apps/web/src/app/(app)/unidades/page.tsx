'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  Plus,
  Pencil,
  Loader2,
  Building2,
  Clock,
  Mail,
  Phone,
  MapPin,
  User,
  Plug,
  Trash2,
  Wifi,
  WifiOff,
  LocateFixed,
  Navigation,
  Monitor,
  Copy,
  Check,
} from 'lucide-react'

// ============================================
// Tipos
// ============================================

interface UnitUser {
  id: string
  nome: string
  email: string
}

interface Unit {
  id: string
  codigo: string
  nome: string
  razaoSocial: string | null
  cnpj: string | null
  endereco: string | null
  telefone: string | null
  email: string | null
  responsavelId: string | null
  responsavel: UnitUser | null
  horarioAbertura: string | null
  horarioFechamento: string | null
  diasFuncionamento: string[] | null
  latitude: number | null
  longitude: number | null
  raioValidacaoMetros: number | null
  status: 'ativo' | 'inativo'
  createdAt: string
  integrations?: UnitIntegration[]
}

interface UnitIntegration {
  id: string
  tipo: string
  nome: string
  status: 'ativo' | 'inativo'
  configuracao: Record<string, any> | null
  createdAt: string
}

interface UnitFormData {
  nome: string
  razaoSocial: string
  cnpj: string
  endereco: string
  telefone: string
  email: string
  responsavelId: string
  horarioAbertura: string
  horarioFechamento: string
  diasFuncionamento: string[]
  latitude: string
  longitude: string
  raioValidacaoMetros: string
}

const DIAS_SEMANA = [
  { value: 'dom', label: 'Dom' },
  { value: 'seg', label: 'Seg' },
  { value: 'ter', label: 'Ter' },
  { value: 'qua', label: 'Qua' },
  { value: 'qui', label: 'Qui' },
  { value: 'sex', label: 'Sex' },
  { value: 'sab', label: 'Sab' },
]

const INTEGRATION_TYPES = [
  { value: 'google', label: 'Google', icon: '🔍', desc: 'Google My Business, Maps' },
  { value: 'cardapioweb', label: 'CardapioWeb', icon: '🍽️', desc: 'Cardapio digital online' },
  { value: 'ifood', label: 'iFood', icon: '🛵', desc: 'Plataforma de delivery' },
  { value: 'whatsapp_avisos', label: 'WhatsApp Avisos', icon: '📢', desc: 'Grupo de avisos gerais' },
  { value: 'whatsapp_frente_loja', label: 'WhatsApp Frente de Loja', icon: '🏪', desc: 'Grupo do atendimento' },
  { value: 'whatsapp_producao', label: 'WhatsApp Producao', icon: '🏭', desc: 'Grupo da producao' },
  { value: 'whatsapp_gerencia', label: 'WhatsApp Gerencia', icon: '👔', desc: 'Grupo da gerencia' },
  { value: 'outro', label: 'Outro', icon: '🔗', desc: 'Integracao personalizada' },
]

const EMPTY_FORM: UnitFormData = {
  nome: '',
  razaoSocial: '',
  cnpj: '',
  endereco: '',
  telefone: '',
  email: '',
  responsavelId: '',
  horarioAbertura: '',
  horarioFechamento: '',
  diasFuncionamento: [],
  latitude: '',
  longitude: '',
  raioValidacaoMetros: '300',
}

// ============================================
// Célula de URL do Totem
// ============================================

function TotemUrlCell({ unitId, codigo }: { unitId: string; codigo: string }) {
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const path = `/totem/${codigo.toUpperCase()}`
  const fullUrl = `${origin}${path}`

  function handleCopy() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(fullUrl)
    } else {
      const el = document.createElement('textarea')
      el.value = fullUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2 max-w-xs">
      <span className="text-xs text-muted-foreground/60 font-mono truncate">/totem/{codigo.toUpperCase()}</span>
      <button
        onClick={handleCopy}
        title={`Copiar: ${fullUrl}`}
        className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
      >
        {copied
          ? <Check className="h-3.5 w-3.5 text-emerald-500" />
          : <Copy className="h-3.5 w-3.5" />}
      </button>
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir totem em nova aba"
        className="shrink-0 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
      >
        <Monitor className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}

// ============================================
// Pagina principal
// ============================================

export default function UnidadesPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [formData, setFormData] = useState<UnitFormData>(EMPTY_FORM)
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null)
  const [detailTab, setDetailTab] = useState('dados')

  const limit = 10

  // ------------------------------------------
  // Queries
  // ------------------------------------------

  const { data: unitsData, isLoading } = useQuery({
    queryKey: ['units', page, search],
    queryFn: () => api.get('/units', { page, limit, search: search || undefined }),
  })

  // Lista de usuarios para o select de responsavel
  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users', { limit: 100 }),
  })

  const usersList: UnitUser[] = usersData?.data || []

  // Buscar detalhe da unidade (com integracoes)
  const { data: unitDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['unit-detail', detailUnit?.id],
    queryFn: () => api.get(`/units/${detailUnit!.id}`),
    enabled: !!detailUnit?.id,
  })

  // ------------------------------------------
  // Mutations
  // ------------------------------------------

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/units', data),
    onSuccess: () => {
      toast.success('Unidade criada com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['units'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao criar unidade'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/units/${id}`, data),
    onSuccess: () => {
      toast.success('Unidade atualizada com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['units'] })
      queryClient.invalidateQueries({ queryKey: ['unit-detail'] })
      closeModal()
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao atualizar unidade'),
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ativo' | 'inativo' }) =>
      api.patch(`/units/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status atualizado!')
      queryClient.invalidateQueries({ queryKey: ['units'] })
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao alterar status'),
  })

  // Integration mutations
  const createIntegrationMutation = useMutation({
    mutationFn: ({ unitId, data }: { unitId: string; data: any }) =>
      api.post(`/units/${unitId}/integrations`, data),
    onSuccess: () => {
      toast.success('Integracao adicionada!')
      refetchDetail()
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao criar integracao'),
  })

  const updateIntegrationMutation = useMutation({
    mutationFn: ({ unitId, integrationId, data }: { unitId: string; integrationId: string; data: any }) =>
      api.put(`/units/${unitId}/integrations/${integrationId}`, data),
    onSuccess: () => {
      toast.success('Integracao atualizada!')
      refetchDetail()
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao atualizar integracao'),
  })

  const deleteIntegrationMutation = useMutation({
    mutationFn: ({ unitId, integrationId }: { unitId: string; integrationId: string }) =>
      api.delete(`/units/${unitId}/integrations/${integrationId}`),
    onSuccess: () => {
      toast.success('Integracao removida!')
      refetchDetail()
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao remover integracao'),
  })

  // ------------------------------------------
  // Handlers
  // ------------------------------------------

  function openCreateModal() {
    setEditingUnit(null)
    setFormData(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEditModal(unit: Unit) {
    setEditingUnit(unit)
    setFormData({
      nome: unit.nome,
      razaoSocial: unit.razaoSocial || '',
      cnpj: unit.cnpj || '',
      endereco: unit.endereco || '',
      telefone: unit.telefone || '',
      email: unit.email || '',
      responsavelId: unit.responsavelId || '',
      horarioAbertura: unit.horarioAbertura || '',
      horarioFechamento: unit.horarioFechamento || '',
      diasFuncionamento: (unit.diasFuncionamento as string[]) || [],
      latitude: unit.latitude != null ? String(unit.latitude) : '',
      longitude: unit.longitude != null ? String(unit.longitude) : '',
      raioValidacaoMetros: unit.raioValidacaoMetros != null ? String(unit.raioValidacaoMetros) : '300',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingUnit(null)
    setFormData(EMPTY_FORM)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: any = { ...formData }
    if (!payload.razaoSocial) payload.razaoSocial = null
    if (!payload.cnpj) payload.cnpj = null
    if (!payload.responsavelId) payload.responsavelId = null
    if (!payload.email) payload.email = null
    if (!payload.horarioAbertura) payload.horarioAbertura = null
    if (!payload.horarioFechamento) payload.horarioFechamento = null
    if (payload.diasFuncionamento.length === 0) payload.diasFuncionamento = null
    payload.latitude = payload.latitude !== '' ? parseFloat(payload.latitude) : null
    payload.longitude = payload.longitude !== '' ? parseFloat(payload.longitude) : null
    payload.raioValidacaoMetros = payload.raioValidacaoMetros !== '' ? parseInt(payload.raioValidacaoMetros, 10) : null

    if (editingUnit) {
      updateMutation.mutate({ id: editingUnit.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada neste navegador')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((p) => ({
          ...p,
          latitude: String(pos.coords.latitude.toFixed(7)),
          longitude: String(pos.coords.longitude.toFixed(7)),
        }))
        toast.success('Localização capturada com sucesso')
      },
      () => toast.error('Não foi possível obter a localização. Verifique as permissões do navegador.'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function toggleDia(dia: string) {
    setFormData((prev) => ({
      ...prev,
      diasFuncionamento: prev.diasFuncionamento.includes(dia)
        ? prev.diasFuncionamento.filter((d) => d !== dia)
        : [...prev.diasFuncionamento, dia],
    }))
  }

  function openDetail(unit: Unit) {
    setDetailUnit(unit)
    setDetailTab('dados')
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  // ------------------------------------------
  // Colunas da tabela
  // ------------------------------------------

  const columns = [
    {
      key: 'codigo',
      header: 'Codigo',
      cell: (row: Unit) => (
        <span className="font-mono text-sm font-medium">{row.codigo}</span>
      ),
    },
    {
      key: 'nome',
      header: 'Nome',
      cell: (row: Unit) => (
        <button
          onClick={() => openDetail(row)}
          className="font-medium text-primary hover:underline text-left touch-manipulation"
        >
          {row.nome}
        </button>
      ),
    },
    {
      key: 'responsavel',
      header: 'Responsavel',
      hideOnMobile: true,
      cell: (row: Unit) => row.responsavel?.nome || <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'horario',
      header: 'Horario',
      hideOnMobile: true,
      cell: (row: Unit) =>
        row.horarioAbertura && row.horarioFechamento
          ? `${row.horarioAbertura} - ${row.horarioFechamento}`
          : <span className="text-muted-foreground">-</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: Unit) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.status === 'ativo'}
            onCheckedChange={(checked) =>
              toggleStatusMutation.mutate({
                id: row.id,
                status: checked ? 'ativo' : 'inativo',
              })
            }
          />
          <Badge variant={row.status === 'ativo' ? 'default' : 'secondary'}>
            {row.status === 'ativo' ? 'Ativa' : 'Inativa'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'totem',
      header: 'Totem',
      hideOnMobile: true,
      cell: (row: Unit) => <TotemUrlCell unitId={row.id} codigo={row.codigo} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row: Unit) => (
        <Button variant="ghost" size="icon" onClick={() => openEditModal(row)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  // ------------------------------------------
  // Render
  // ------------------------------------------

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-warm-sm">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Unidades</h1>
          <p className="text-xs sm:text-sm text-muted-foreground/50">Gerencie as unidades da rede</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={unitsData?.data || []}
        total={unitsData?.total || 0}
        page={page}
        limit={limit}
        totalPages={unitsData?.totalPages || 1}
        onPageChange={setPage}
        loading={isLoading}
        searchPlaceholder="Buscar por nome ou codigo..."
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        actions={
          <Button onClick={openCreateModal} className="bg-amber-600 hover:bg-amber-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Nova Unidade
          </Button>
        }
      />

      {/* ============================================ */}
      {/* Modal criar/editar unidade */}
      {/* ============================================ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Editar Unidade' : 'Nova Unidade'}</DialogTitle>
            <DialogDescription>
              {editingUnit
                ? 'Atualize os dados da unidade.'
                : 'Preencha os dados para criar uma nova unidade.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Nome */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Nome *
              </label>
              <Input
                required
                value={formData.nome}
                onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Nome da unidade"
              />
            </div>

            {/* Razao Social + CNPJ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Razao Social
                </label>
                <Input
                  value={formData.razaoSocial}
                  onChange={(e) => setFormData((p) => ({ ...p, razaoSocial: e.target.value }))}
                  placeholder="Razao social da empresa"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> CNPJ
                </label>
                <Input
                  value={formData.cnpj}
                  onChange={(e) => setFormData((p) => ({ ...p, cnpj: e.target.value }))}
                  placeholder="00.000.000/0001-00"
                />
              </div>
            </div>

            {/* Responsavel + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" /> Responsavel
                </label>
                <Select
                  value={formData.responsavelId || '_none'}
                  onValueChange={(v) => setFormData((p) => ({ ...p, responsavelId: v === '_none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsavel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {usersList.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> E-mail
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@unidade.com"
                />
              </div>
            </div>

            {/* Endereco */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Endereco
              </label>
              <Input
                value={formData.endereco}
                onChange={(e) => setFormData((p) => ({ ...p, endereco: e.target.value }))}
                placeholder="Rua, numero, bairro, cidade - UF"
              />
            </div>

            {/* Telefone + Horarios */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Telefone
                </label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData((p) => ({ ...p, telefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Abertura
                </label>
                <Input
                  type="time"
                  value={formData.horarioAbertura}
                  onChange={(e) => setFormData((p) => ({ ...p, horarioAbertura: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> Fechamento
                </label>
                <Input
                  type="time"
                  value={formData.horarioFechamento}
                  onChange={(e) => setFormData((p) => ({ ...p, horarioFechamento: e.target.value }))}
                />
              </div>
            </div>

            {/* Geolocalizacao */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Navigation className="h-3.5 w-3.5 text-muted-foreground" /> Geolocalização
                  <span className="text-xs text-muted-foreground font-normal">(para validação de presença)</span>
                </label>
                <button
                  type="button"
                  onClick={captureLocation}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium px-2.5 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition"
                >
                  <LocateFixed className="h-3.5 w-3.5" /> Capturar localização atual
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Latitude</label>
                  <Input
                    value={formData.latitude}
                    onChange={(e) => setFormData((p) => ({ ...p, latitude: e.target.value }))}
                    placeholder="-23.5505"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Longitude</label>
                  <Input
                    value={formData.longitude}
                    onChange={(e) => setFormData((p) => ({ ...p, longitude: e.target.value }))}
                    placeholder="-46.6333"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Raio (metros)</label>
                  <Input
                    type="number"
                    min={50}
                    max={5000}
                    value={formData.raioValidacaoMetros}
                    onChange={(e) => setFormData((p) => ({ ...p, raioValidacaoMetros: e.target.value }))}
                    placeholder="300"
                  />
                </div>
              </div>
              {formData.latitude && formData.longitude && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <LocateFixed className="h-3 w-3" />
                  Ponto definido: {formData.latitude}, {formData.longitude} — raio de {formData.raioValidacaoMetros || 300}m
                </p>
              )}
            </div>

            {/* Dias de funcionamento */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Dias de Funcionamento</label>
              <div className="flex flex-wrap gap-2">
                {DIAS_SEMANA.map((dia) => {
                  const selected = formData.diasFuncionamento.includes(dia.value)
                  return (
                    <button
                      key={dia.value}
                      type="button"
                      onClick={() => toggleDia(dia.value)}
                      className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all touch-manipulation border ${
                        selected
                          ? 'bg-primary text-primary-foreground border-primary shadow-warm-sm'
                          : 'bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      }`}
                    >
                      {dia.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingUnit ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* Modal detalhe da unidade (Dados + Integracoes) */}
      {/* ============================================ */}
      <Dialog open={!!detailUnit} onOpenChange={(open) => !open && setDetailUnit(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {unitDetail?.nome || detailUnit?.nome}
              <Badge variant="outline" className="ml-2 font-mono text-xs">
                {unitDetail?.codigo || detailUnit?.codigo}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <Tabs value={detailTab} onValueChange={setDetailTab}>
            <TabsList>
              <TabsTrigger value="dados">Dados</TabsTrigger>
              <TabsTrigger value="setores">
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                Setores
              </TabsTrigger>
              <TabsTrigger value="integracoes">
                <Plug className="h-3.5 w-3.5 mr-1.5" />
                Integracoes
              </TabsTrigger>
            </TabsList>

            {/* --- Aba Dados --- */}
            <TabsContent value="dados">
              {unitDetail ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoField icon={<Building2 className="h-4 w-4" />} label="Razao Social" value={unitDetail.razaoSocial} />
                    <InfoField icon={<Building2 className="h-4 w-4" />} label="CNPJ" value={unitDetail.cnpj} />
                    <InfoField icon={<User className="h-4 w-4" />} label="Responsavel" value={unitDetail.responsavel?.nome} />
                    <InfoField icon={<Mail className="h-4 w-4" />} label="E-mail" value={unitDetail.email} />
                    <InfoField icon={<Phone className="h-4 w-4" />} label="Telefone" value={unitDetail.telefone} />
                    <InfoField
                      icon={<Clock className="h-4 w-4" />}
                      label="Horario"
                      value={
                        unitDetail.horarioAbertura && unitDetail.horarioFechamento
                          ? `${unitDetail.horarioAbertura} - ${unitDetail.horarioFechamento}`
                          : null
                      }
                    />
                    <div className="sm:col-span-2">
                      <InfoField icon={<MapPin className="h-4 w-4" />} label="Endereco" value={unitDetail.endereco} />
                    </div>
                  </div>

                  {/* Dias de funcionamento */}
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dias de Funcionamento</span>
                    <div className="flex flex-wrap gap-1.5">
                      {DIAS_SEMANA.map((dia) => {
                        const ativo = (unitDetail.diasFuncionamento as string[] | null)?.includes(dia.value)
                        return (
                          <span
                            key={dia.value}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                              ativo
                                ? 'bg-primary/10 text-primary border border-primary/20'
                                : 'bg-muted text-muted-foreground/50 line-through'
                            }`}
                          >
                            {dia.label}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDetailUnit(null)
                        openEditModal(unitDetail as Unit)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Editar Dados
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </TabsContent>

            {/* --- Aba Integracoes --- */}
            <TabsContent value="integracoes">
              <UnitIntegrationsTab
                unitId={detailUnit?.id || ''}
                integrations={unitDetail?.integrations || []}
                onAdd={(data) =>
                  createIntegrationMutation.mutate({ unitId: detailUnit!.id, data })
                }
                onUpdate={(integrationId, data) =>
                  updateIntegrationMutation.mutate({
                    unitId: detailUnit!.id,
                    integrationId,
                    data,
                  })
                }
                onDelete={(integrationId) =>
                  deleteIntegrationMutation.mutate({
                    unitId: detailUnit!.id,
                    integrationId,
                  })
                }
                isAdding={createIntegrationMutation.isPending}
              />
            </TabsContent>

            {/* --- Aba Setores --- */}
            <TabsContent value="setores">
              <UnitSectorsTab unitId={detailUnit?.id || ''} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Componente: Campo de informacao
// ============================================

function InfoField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        {icon} {label}
      </span>
      <p className="text-sm font-medium">
        {value || <span className="text-muted-foreground italic">Nao informado</span>}
      </p>
    </div>
  )
}

// ============================================
// Componente: Aba de integracoes da unidade
// ============================================

function UnitIntegrationsTab({
  unitId,
  integrations,
  onAdd,
  onUpdate,
  onDelete,
  isAdding,
}: {
  unitId: string
  integrations: UnitIntegration[]
  onAdd: (data: any) => void
  onUpdate: (integrationId: string, data: any) => void
  onDelete: (integrationId: string) => void
  isAdding: boolean
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTipo, setNewTipo] = useState('')
  const [newNome, setNewNome] = useState('')
  const [newConfig, setNewConfig] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editConfig, setEditConfig] = useState('')

  // Tipos ja usados
  const usedTypes = integrations.map((i) => i.tipo)
  const availableTypes = INTEGRATION_TYPES.filter((t) => !usedTypes.includes(t.value))

  function handleAdd() {
    if (!newTipo || !newNome) {
      toast.error('Preencha tipo e nome')
      return
    }
    let config = null
    if (newConfig.trim()) {
      try {
        config = JSON.parse(newConfig)
      } catch {
        toast.error('JSON de configuracao invalido')
        return
      }
    }
    onAdd({ tipo: newTipo, nome: newNome, configuracao: config })
    setShowAddForm(false)
    setNewTipo('')
    setNewNome('')
    setNewConfig('')
  }

  function handleSaveConfig(integration: UnitIntegration) {
    let config = null
    if (editConfig.trim()) {
      try {
        config = JSON.parse(editConfig)
      } catch {
        toast.error('JSON de configuracao invalido')
        return
      }
    }
    onUpdate(integration.id, { configuracao: config })
    setEditingId(null)
  }

  function getTypeInfo(tipo: string) {
    return INTEGRATION_TYPES.find((t) => t.value === tipo) || { label: tipo, icon: '🔗', desc: '' }
  }

  return (
    <div className="space-y-4">
      {/* Lista de integracoes existentes */}
      {integrations.length === 0 && !showAddForm && (
        <div className="text-center py-8">
          <Plug className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma integracao configurada</p>
        </div>
      )}

      <div className="space-y-3">
        {integrations.map((integration) => {
          const info = getTypeInfo(integration.tipo)
          const isEditing = editingId === integration.id
          return (
            <div
              key={integration.id}
              className="rounded-xl border border-border/60 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xl flex-shrink-0">{info.icon}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{integration.nome}</p>
                    <p className="text-xs text-muted-foreground">{info.label} &middot; {info.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() =>
                      onUpdate(integration.id, {
                        status: integration.status === 'ativo' ? 'inativo' : 'ativo',
                      })
                    }
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition touch-manipulation ${
                      integration.status === 'ativo'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {integration.status === 'ativo' ? (
                      <><Wifi className="h-3 w-3" /> Ativo</>
                    ) : (
                      <><WifiOff className="h-3 w-3" /> Inativo</>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (isEditing) {
                        setEditingId(null)
                      } else {
                        setEditingId(integration.id)
                        setEditConfig(
                          integration.configuracao
                            ? JSON.stringify(integration.configuracao, null, 2)
                            : ''
                        )
                      }
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition touch-manipulation"
                    title="Configurar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remover integracao "${integration.nome}"?`)) {
                        onDelete(integration.id)
                      }
                    }}
                    className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition touch-manipulation"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Area de configuracao expandida */}
              {isEditing && (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <label className="text-xs font-medium text-muted-foreground">
                    Configuracao (JSON) — chaves API, tokens, URLs, grupos, etc.
                  </label>
                  <textarea
                    value={editConfig}
                    onChange={(e) => setEditConfig(e.target.value)}
                    rows={4}
                    className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-input bg-card text-sm font-mono shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    placeholder='{ "apiKey": "...", "groupId": "..." }'
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSaveConfig(integration)}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      Salvar Configuracao
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Form para adicionar nova integracao */}
      {showAddForm && (
        <div className="rounded-xl border-2 border-dashed border-primary/30 p-4 space-y-3 bg-primary/5">
          <p className="text-sm font-medium">Nova Integracao</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tipo *</label>
              <Select value={newTipo} onValueChange={setNewTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome *</label>
              <Input
                value={newNome}
                onChange={(e) => setNewNome(e.target.value)}
                placeholder="Ex: Google Unidade Centro"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Configuracao (JSON, opcional)
            </label>
            <textarea
              value={newConfig}
              onChange={(e) => setNewConfig(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-input bg-card text-sm font-mono shadow-warm-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              placeholder='{ "apiKey": "...", "groupId": "..." }'
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false)
                setNewTipo('')
                setNewNome('')
                setNewConfig('')
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isAdding}
              onClick={handleAdd}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isAdding && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Botao adicionar */}
      {!showAddForm && availableTypes.length > 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddForm(true)}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Integracao
        </Button>
      )}

      {!showAddForm && availableTypes.length === 0 && integrations.length > 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Todas as integracoes disponiveis ja foram adicionadas.
        </p>
      )}
    </div>
  )
}

// ============================================
// Componente: Aba de Setores da unidade
// ============================================

function UnitSectorsTab({ unitId }: { unitId: string }) {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newNome, setNewNome] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')

  const { data: sectorsData, isLoading } = useQuery({
    queryKey: ['sectors', unitId],
    queryFn: () => api.get(`/units/${unitId}/sectors`),
    enabled: !!unitId,
  })

  const sectors: any[] = sectorsData?.data || []

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post(`/units/${unitId}/sectors`, data),
    onSuccess: () => {
      toast.success('Setor adicionado!')
      queryClient.invalidateQueries({ queryKey: ['sectors', unitId] })
      setShowAddForm(false)
      setNewNome('')
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao criar setor'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ sectorId, data }: { sectorId: string; data: any }) =>
      api.put(`/units/${unitId}/sectors/${sectorId}`, data),
    onSuccess: () => {
      toast.success('Setor atualizado!')
      queryClient.invalidateQueries({ queryKey: ['sectors', unitId] })
      setEditingId(null)
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao atualizar setor'),
  })

  const deleteMutation = useMutation({
    mutationFn: (sectorId: string) => api.delete(`/units/${unitId}/sectors/${sectorId}`),
    onSuccess: () => {
      toast.success('Setor removido!')
      queryClient.invalidateQueries({ queryKey: ['sectors', unitId] })
    },
    onError: (error: any) => toast.error(error.message || 'Erro ao remover setor'),
  })

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : sectors.length === 0 && !showAddForm ? (
        <div className="text-center py-8">
          <Building2 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum setor cadastrado nesta unidade.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sectors.map((sector) => {
            const isEditing = editingId === sector.id
            return (
              <div key={sector.id} className="rounded-xl border border-border/60 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl flex-shrink-0 text-amber-500"><Building2 className="w-5 h-5"/></span>
                    <div className="min-w-0">
                      {isEditing ? (
                        <Input
                          autoFocus
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          className="h-8 text-sm max-w-[200px]"
                        />
                      ) : (
                        <p className="font-medium text-sm truncate">{sector.nome}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          className="h-8 px-2 text-xs"
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (!editNome.trim()) return
                            updateMutation.mutate({ sectorId: sector.id, data: { nome: editNome } })
                          }}
                          className="h-8 px-3 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Salvar'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditingId(sector.id)
                            setEditNome(sector.nome)
                          }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition touch-manipulation"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remover setor "${sector.nome}"? Ação irreversível caso não existam checklists usando-o.`)) {
                              deleteMutation.mutate(sector.id)
                            }
                          }}
                          className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition touch-manipulation"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Form para adicionar setor */}
      {showAddForm && (
        <div className="rounded-xl border-2 border-dashed border-primary/30 p-4 space-y-3 bg-primary/5">
          <p className="text-sm font-medium">Novo Setor</p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome *</label>
            <Input
              autoFocus
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
              placeholder="Ex: Cozinha, Salão, Recepção, Estoque"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newNome.trim()) {
                  e.preventDefault()
                  createMutation.mutate({ nome: newNome })
                }
              }}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false)
                setNewNome('')
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={createMutation.isPending || !newNome.trim()}
              onClick={() => createMutation.mutate({ nome: newNome })}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Botao adicionar */}
      {!showAddForm && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddForm(true)}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Setor
        </Button>
      )}
    </div>
  )
}
