'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  Printer,
  Plus,
  Pencil,
  Trash2,
  X,
  Wifi,
  WifiOff,
  CheckSquare,
  Square,
  Loader2,
  FlaskConical,
  Building2,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────

interface Unit {
  id: string
  nome: string
  codigo: string
}

interface Impressora {
  id: string
  nome: string
  ip: string
  porta: number
  agentUrl: string | null
  setores: string[]
  ativo: boolean
  unitId: string
  unit: Unit
  createdAt: string
}

const SETORES_CONFIG: { value: string; label: string; desc: string }[] = [
  { value: 'encomendas',          label: 'Encomendas',           desc: 'Impressão de recibos de encomenda (3 vias)' },
  { value: 'requisicao_producao', label: 'Requisição / Produção', desc: 'Impressão de requisições de compra e produção' },
]

const EMPTY_FORM = {
  nome:     '',
  ip:       '',
  porta:    '9100',
  agentUrl: '',
  setores:  [] as string[],
  unitId:   '',
  ativo:    true,
}

// ─── Helpers ──────────────────────────────────────────────────

function SetorBadge({ setor }: { setor: string }) {
  const cfg = SETORES_CONFIG.find((s) => s.value === setor)
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      {cfg?.label ?? setor}
    </span>
  )
}

// ─── Componente principal ──────────────────────────────────────

export default function ImpressorasPage() {
  const queryClient = useQueryClient()

  const [showModal, setShowModal]         = useState(false)
  const [editing, setEditing]             = useState<Impressora | null>(null)
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [testingId, setTestingId]         = useState<string | null>(null)
  const [search, setSearch]               = useState('')

  // ── Queries ────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['impressoras', search],
    queryFn: () => api.get('/impressoras', { limit: 100, search: search || undefined }),
  })

  const { data: unitsData } = useQuery({
    queryKey: ['units-all'],
    queryFn: () => api.get('/units', { limit: 100, status: 'ativo' }),
  })

  const units: Unit[] = unitsData?.data ?? []
  const impressoras: Impressora[] = data?.data ?? []

  // ── Mutations ──────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/impressoras', payload),
    onSuccess: () => {
      toast.success('Impressora cadastrada')
      queryClient.invalidateQueries({ queryKey: ['impressoras'] })
      closeModal()
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao salvar'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api.put(`/impressoras/${id}`, payload),
    onSuccess: () => {
      toast.success('Impressora atualizada')
      queryClient.invalidateQueries({ queryKey: ['impressoras'] })
      closeModal()
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar'),
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/impressoras/${id}/status`, {}),
    onSuccess: (updated: Impressora) => {
      toast.success(updated.ativo ? 'Impressora ativada' : 'Impressora desativada')
      queryClient.invalidateQueries({ queryKey: ['impressoras'] })
    },
    onError: (err: any) => toast.error(err.message || 'Erro'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/impressoras/${id}`),
    onSuccess: () => {
      toast.success('Impressora removida')
      queryClient.invalidateQueries({ queryKey: ['impressoras'] })
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao remover'),
  })

  // ── Helpers de modal ──────────────────────────────────────

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(imp: Impressora) {
    setEditing(imp)
    setForm({
      nome:     imp.nome,
      ip:       imp.ip,
      porta:    String(imp.porta),
      agentUrl: imp.agentUrl ?? '',
      setores:  imp.setores,
      unitId:   imp.unitId,
      ativo:    imp.ativo,
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  function toggleSetor(setor: string) {
    setForm((prev) => ({
      ...prev,
      setores: prev.setores.includes(setor)
        ? prev.setores.filter((s) => s !== setor)
        : [...prev.setores, setor],
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.setores.length === 0) {
      toast.error('Selecione ao menos um setor')
      return
    }
    const payload = {
      nome:     form.nome,
      ip:       form.ip,
      porta:    parseInt(form.porta) || 9100,
      agentUrl: form.agentUrl.trim() || null,
      setores:  form.setores,
      unitId:   form.unitId,
      ativo:    form.ativo,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  async function handleTest(imp: Impressora) {
    setTestingId(imp.id)
    try {
      await api.post(`/impressoras/${imp.id}/test`, {})
      toast.success(`${imp.nome} respondeu — impressão de teste enviada!`)
    } catch (err: any) {
      toast.error(err.message || 'Impressora não respondeu')
    } finally {
      setTestingId(null)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow">
            <Printer className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold">Impressoras</h2>
            <p className="text-xs text-muted-foreground">Impressoras térmicas de rede (ESC/POS)</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition"
        >
          <Plus className="h-4 w-4" /> Cadastrar
        </button>
      </div>

      {/* Busca */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome ou IP..."
        className="w-full sm:w-80 px-3.5 py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 outline-none transition"
      />

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
        </div>
      ) : impressoras.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border border-dashed border-border rounded-2xl">
          <Printer className="h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">Nenhuma impressora cadastrada</p>
          <p className="text-xs">Cadastre uma impressora térmica de rede para impressão direta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {impressoras.map((imp) => (
            <div
              key={imp.id}
              className={`p-4 rounded-2xl border transition ${
                imp.ativo
                  ? 'border-border bg-card'
                  : 'border-border/50 bg-muted/30 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    imp.ativo ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'
                  }`}>
                    {imp.ativo
                      ? <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      : <WifiOff className="h-4 w-4 text-muted-foreground" />
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{imp.nome}</p>
                    <p className="text-xs text-muted-foreground font-mono">{imp.ip}:{imp.porta}</p>
                    {imp.agentUrl && (
                      <p className="text-[11px] text-muted-foreground/70 font-mono truncate">{imp.agentUrl}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleTest(imp)}
                    disabled={testingId === imp.id}
                    title="Teste de impressão"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition disabled:opacity-40"
                  >
                    {testingId === imp.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <FlaskConical className="h-3.5 w-3.5" />
                    }
                  </button>
                  <button
                    onClick={() => openEdit(imp)}
                    title="Editar"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => toggleMutation.mutate(imp.id)}
                    title={imp.ativo ? 'Desativar' : 'Ativar'}
                    className={`p-1.5 rounded-lg transition ${
                      imp.ativo
                        ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                        : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {imp.ativo ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remover a impressora "${imp.nome}"?`))
                        deleteMutation.mutate(imp.id)
                    }}
                    title="Remover"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Unidade */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Building2 className="h-3 w-3 shrink-0" />
                <span>{imp.unit.nome}</span>
                <span className="text-muted-foreground/50">·</span>
                <span className="font-mono text-muted-foreground/70">{imp.unit.codigo}</span>
              </div>

              {/* Setores */}
              <div className="flex flex-wrap gap-1">
                {imp.setores.map((s) => <SetorBadge key={s} setor={s} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Cadastro / Edição ─────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:py-8"
          onClick={closeModal}
        >
          <div
            className="bg-card rounded-t-2xl sm:rounded-2xl border border-border/60 shadow-xl w-full sm:max-w-lg sm:mx-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Printer className="h-4 w-4 text-slate-500" />
                {editing ? 'Editar Impressora' : 'Cadastrar Impressora'}
              </h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Nome *</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  required
                  placeholder="Ex: Elgin i8 — Balcão"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none transition"
                />
              </div>

              {/* IP + Porta */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5">IP Local *</label>
                  <input
                    value={form.ip}
                    onChange={(e) => setForm({ ...form, ip: e.target.value })}
                    required
                    placeholder="192.168.1.100"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Porta</label>
                  <input
                    type="number"
                    value={form.porta}
                    onChange={(e) => setForm({ ...form, porta: e.target.value })}
                    min={1}
                    max={65535}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none transition"
                  />
                </div>
              </div>

              {/* URL do Agente */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  URL do Agente
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">(informativo)</span>
                </label>
                <input
                  value={form.agentUrl}
                  onChange={(e) => setForm({ ...form, agentUrl: e.target.value })}
                  placeholder="http://192.168.0.144:3456"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none transition"
                />
              </div>

              {/* Unidade */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Unidade *</label>
                <select
                  value={form.unitId}
                  onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none transition"
                >
                  <option value="">Selecione uma unidade...</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} ({u.codigo})
                    </option>
                  ))}
                </select>
              </div>

              {/* Setores */}
              <div>
                <label className="block text-sm font-medium mb-2">Setores que usam esta impressora *</label>
                <div className="space-y-2">
                  {SETORES_CONFIG.map((s) => {
                    const checked = form.setores.includes(s.value)
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => toggleSetor(s.value)}
                        className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                          checked
                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        {checked
                          ? <CheckSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          : <Square className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        }
                        <div>
                          <p className="text-sm font-medium">{s.label}</p>
                          <p className="text-xs text-muted-foreground">{s.desc}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                <div>
                  <p className="text-sm font-medium">Impressora ativa</p>
                  <p className="text-xs text-muted-foreground">Impressora disponível para uso</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, ativo: !form.ativo })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.ativo ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    form.ativo ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Ações */}
              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 sm:py-2 rounded-xl border border-border text-sm hover:bg-accent transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 sm:flex-none px-5 py-2.5 sm:py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editing ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
