'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { DataTable } from '@/components/data-table'
import { toast } from 'sonner'
import { printEncomendaDirect } from '@/lib/print-direct'
import {
  ShoppingBag,
  Plus,
  Trash2,
  Printer,
  CheckCircle2,
  Clock,
  Eye,
  X,
  PackageCheck,
  PackageX,
  Package,
  ListChecks,
  ChevronRight,
} from 'lucide-react'

// ============================================================
// Tipos
// ============================================================

interface ItemForm {
  descricao: string
  quantidade: string
  unidade: string
  observacao: string
}

interface Encomenda {
  id: string
  numeroOrdem: number
  clienteNome: string
  clienteTelefone: string
  dataRetirada: string
  horaRetirada: string
  observacoes: string
  valorCaucao: number
  valorTotal: number
  status: 'pendente' | 'pronta' | 'retirada' | 'cancelada'
  itens: { id: string; descricao: string; quantidade: number; unidade: string; observacao?: string }[]
  criadoPor: { nome: string }
  concluidoPor?: { nome: string }
  unit: { nome: string; codigo: string; endereco?: string; telefone?: string }
  createdAt: string
  concluidoEm?: string
}

// ============================================================
// Helpers de estilo
// ============================================================

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pendente:  { label: 'Pendente',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',     icon: Clock },
  pronta:    { label: 'Pronta',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',         icon: PackageCheck },
  retirada:  { label: 'Retirada',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',             icon: PackageX },
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}


// ============================================================
// Pagina principal
// ============================================================

const EMPTY_FORM = {
  clienteNome: '',
  clienteTelefone: '',
  dataRetirada: '',
  horaRetirada: '',
  observacoes: '',
  valorCaucao: '',
  valorTotal: '',
}

const EMPTY_ITEM: ItemForm = { descricao: '', quantidade: '1', unidade: 'un', observacao: '' }

export default function EncomendasPage() {
  const { selectedUnitId } = useAuthStore()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState<Encomenda | null>(null)
  const [showPendentes, setShowPendentes] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [itens, setItens] = useState<ItemForm[]>([{ ...EMPTY_ITEM }])

  // ---- Queries ----

  const { data, isLoading } = useQuery({
    queryKey: ['encomendas', page, search, selectedUnitId, filterStatus],
    queryFn: () => api.get('/encomendas', {
      page, limit: 20,
      unitId: selectedUnitId!,
      status: filterStatus || undefined,
      search: search || undefined,
    }),
    enabled: !!selectedUnitId,
  })

  const { data: dataPendentes, isLoading: loadingPendentes } = useQuery({
    queryKey: ['encomendas-pendentes', selectedUnitId],
    queryFn: () => api.get('/encomendas', {
      limit: 100,
      unitId: selectedUnitId!,
      pendentes: true,
    }),
    enabled: !!selectedUnitId,
    refetchInterval: showPendentes ? 30000 : false,
  })

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/encomendas', payload),
    onSuccess: (encomenda: Encomenda) => {
      toast.success(`Encomenda #${String(encomenda.numeroOrdem).padStart(4, '0')} criada`)
      queryClient.invalidateQueries({ queryKey: ['encomendas'] })
      queryClient.invalidateQueries({ queryKey: ['encomendas-pendentes'] })
      setShowModal(false)
      setForm(EMPTY_FORM)
      setItens([{ ...EMPTY_ITEM }])
      printEncomendaDirect(encomenda, () =>
        toast.info('Impressora não configurada — abrindo prévia do navegador'),
      )
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao criar encomenda'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/encomendas/${id}/status`, { status }),
    onSuccess: (updated: Encomenda) => {
      toast.success(`Status atualizado para "${statusConfig[updated.status]?.label}"`)
      queryClient.invalidateQueries({ queryKey: ['encomendas'] })
      queryClient.invalidateQueries({ queryKey: ['encomendas-pendentes'] })
      setShowDetail(updated)
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar status'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/encomendas/${id}`),
    onSuccess: () => {
      toast.success('Encomenda excluida')
      queryClient.invalidateQueries({ queryKey: ['encomendas'] })
      queryClient.invalidateQueries({ queryKey: ['encomendas-pendentes'] })
      setShowDetail(null)
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao excluir encomenda'),
  })

  // ---- Helpers de formulario ----

  function addItem() {
    setItens((prev) => [...prev, { ...EMPTY_ITEM }])
  }

  function removeItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx))
  }

  function setItem(idx: number, field: keyof ItemForm, value: string) {
    setItens((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (itens.length === 0) { toast.error('Adicione ao menos 1 item'); return }
    createMutation.mutate({
      unitId:          selectedUnitId,
      clienteNome:     form.clienteNome,
      clienteTelefone: form.clienteTelefone || undefined,
      dataRetirada:    form.dataRetirada,
      horaRetirada:    form.horaRetirada,
      observacoes:     form.observacoes || undefined,
      valorCaucao:     parseFloat(form.valorCaucao || '0'),
      valorTotal:      parseFloat(form.valorTotal || '0'),
      itens: itens.map((it) => ({
        descricao:  it.descricao,
        quantidade: parseFloat(it.quantidade),
        unidade:    it.unidade,
        observacao: it.observacao || undefined,
      })),
    })
  }

  // ---- Colunas da tabela ----

  const columns = [
    {
      key: 'numeroOrdem', header: '#',
      cell: (row: Encomenda) => (
        <span className="font-mono font-bold text-xs">#{String(row.numeroOrdem).padStart(4, '0')}</span>
      ),
    },
    { key: 'clienteNome', header: 'Cliente' },
    {
      key: 'dataRetirada', header: 'Retirada',
      cell: (row: Encomenda) => (
        <span className="text-xs">{fmtDate(row.dataRetirada)} {row.horaRetirada}</span>
      ),
    },
    {
      key: 'itens', header: 'Itens',
      cell: (row: Encomenda) => (
        <span className="text-xs text-muted-foreground">{row.itens?.length ?? 0} item(ns)</span>
      ),
    },
    {
      key: 'valorCaucao', header: 'Caucao',
      cell: (row: Encomenda) => (
        <span className="text-xs">{fmtCurrency(Number(row.valorCaucao))}</span>
      ),
    },
    {
      key: 'status', header: 'Status',
      cell: (row: Encomenda) => {
        const s = statusConfig[row.status]
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s?.color}`}>
            {s?.label}
          </span>
        )
      },
    },
    {
      key: 'actions', header: '',
      cell: (row: Encomenda) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetail(row)}
            className="text-cyan-600 hover:text-cyan-700 text-xs font-medium flex items-center gap-1"
          >
            <Eye className="h-3 w-3" /> Ver
          </button>
          <button
            onClick={() => printEncomendaDirect(row, () =>
              toast.info('Impressora não configurada — abrindo prévia'),
            )}
            className="text-slate-500 hover:text-slate-700 text-xs font-medium flex items-center gap-1"
          >
            <Printer className="h-3 w-3" /> Imprimir
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
          <ShoppingBag className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Encomendas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground/50">Registro e acompanhamento de pedidos de encomenda</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          className="w-full sm:w-auto px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 outline-none transition"
        >
          <option value="">Todos os status</option>
          {Object.entries(statusConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        total={data?.total || 0}
        page={page}
        limit={20}
        totalPages={data?.totalPages || 1}
        onPageChange={setPage}
        loading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por cliente ou telefone..."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPendentes(true)}
              className="relative flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-700 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-sm font-medium transition"
            >
              <ListChecks className="h-4 w-4" />
              Pendentes
              {(dataPendentes?.total ?? 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {dataPendentes!.total > 99 ? '99+' : dataPendentes!.total}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition"
            >
              <Plus className="h-4 w-4" /> Nova Encomenda
            </button>
          </div>
        }
      />

      {/* ================================================
          MODAL: Nova Encomenda
      ================================================ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto sm:py-8"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card rounded-t-2xl sm:rounded-2xl border border-border/60 shadow-xl w-full sm:max-w-2xl sm:mx-4 p-5 sm:p-6 max-h-[95vh] overflow-y-auto safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-display font-bold flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-violet-500" /> Nova Encomenda
              </h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Dados do cliente */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Dados do Cliente</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Nome *</label>
                    <input
                      value={form.clienteNome}
                      onChange={(e) => setForm({ ...form, clienteNome: e.target.value })}
                      required
                      placeholder="Nome completo"
                      className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Telefone</label>
                    <input
                      value={form.clienteTelefone}
                      onChange={(e) => setForm({ ...form, clienteTelefone: e.target.value })}
                      placeholder="(81) 99999-9999"
                      className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Data de Retirada *</label>
                    <input
                      type="date"
                      value={form.dataRetirada}
                      onChange={(e) => setForm({ ...form, dataRetirada: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Hora de Retirada *</label>
                    <input
                      type="time"
                      value={form.horaRetirada}
                      onChange={(e) => setForm({ ...form, horaRetirada: e.target.value })}
                      required
                      className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Itens */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Itens *</h3>
                  <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium">
                    <Plus className="h-3.5 w-3.5" /> Adicionar item
                  </button>
                </div>
                <div className="space-y-3">
                  {itens.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-border bg-muted/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</span>
                        {itens.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="sm:col-span-2">
                          <input
                            value={item.descricao}
                            onChange={(e) => setItem(idx, 'descricao', e.target.value)}
                            required
                            placeholder="Descricao do item"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={item.quantidade}
                            onChange={(e) => setItem(idx, 'quantidade', e.target.value)}
                            required
                            placeholder="Qtd"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition"
                          />
                          <select
                            value={item.unidade}
                            onChange={(e) => setItem(idx, 'unidade', e.target.value)}
                            className="w-full px-2 py-2 rounded-lg border border-border bg-card text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition"
                          >
                            {['un', 'kg', 'g', 'cx', 'pc', 'dt', 'fd'].map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <input
                        value={item.observacao}
                        onChange={(e) => setItem(idx, 'observacao', e.target.value)}
                        placeholder="Observacao do item (opcional)"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Valores */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Valores</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Caucao (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.valorCaucao}
                      onChange={(e) => setForm({ ...form, valorCaucao: e.target.value })}
                      placeholder="0,00"
                      className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Total Estimado (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.valorTotal}
                      onChange={(e) => setForm({ ...form, valorTotal: e.target.value })}
                      placeholder="0,00"
                      className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Observacoes gerais */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Observacoes Gerais</label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  rows={2}
                  placeholder="Instrucoes adicionais..."
                  className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-violet-500/20 outline-none transition resize-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 sm:py-2 rounded-xl border border-border text-sm hover:bg-accent transition touch-manipulation"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2.5 sm:py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
                >
                  {createMutation.isPending ? (
                    <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  {createMutation.isPending ? 'Salvando...' : 'Salvar e Imprimir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================
          MODAL: Detalhe / Gerenciar status
      ================================================ */}
      {showDetail && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto sm:py-8"
          onClick={() => setShowDetail(null)}
        >
          <div
            className="bg-card rounded-t-2xl sm:rounded-2xl border border-border/60 shadow-xl w-full sm:max-w-xl sm:mx-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">
                  Encomenda #{String(showDetail.numeroOrdem).padStart(4, '0')}
                </h2>
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[showDetail.status]?.color}`}>
                    {statusConfig[showDetail.status]?.label}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowDetail(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Info */}
            <div className="space-y-1 text-sm mb-4">
              <div><span className="font-semibold">Cliente:</span> {showDetail.clienteNome}</div>
              {showDetail.clienteTelefone && (
                <div><span className="font-semibold">Telefone:</span> {showDetail.clienteTelefone}</div>
              )}
              <div><span className="font-semibold">Retirada:</span> {fmtDate(showDetail.dataRetirada)} as {showDetail.horaRetirada}</div>
              <div><span className="font-semibold">Caucao:</span> {fmtCurrency(Number(showDetail.valorCaucao))}</div>
              {Number(showDetail.valorTotal) > 0 && (
                <div><span className="font-semibold">Total estimado:</span> {fmtCurrency(Number(showDetail.valorTotal))}</div>
              )}
              {showDetail.observacoes && (
                <div><span className="font-semibold">Obs:</span> {showDetail.observacoes}</div>
              )}
            </div>

            {/* Itens */}
            <div className="mb-4">
              <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                <Package className="h-4 w-4" /> Itens
              </h3>
              <div className="space-y-1">
                {showDetail.itens?.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/40">
                    <span className="text-muted-foreground text-xs mt-0.5 w-5 shrink-0">{i + 1}.</span>
                    <div>
                      <span className="font-medium">{item.descricao}</span>
                      <span className="text-muted-foreground text-xs ml-2">
                        {Number(item.quantidade).toLocaleString('pt-BR')} {item.unidade}
                      </span>
                      {item.observacao && (
                        <div className="text-xs text-muted-foreground">{item.observacao}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Acoes de status */}
            {showDetail.status !== 'cancelada' && showDetail.status !== 'retirada' && (
              <div className="mb-4">
                <h3 className="text-sm font-bold mb-2">Alterar Status</h3>
                <div className="flex flex-wrap gap-2">
                  {(['pendente', 'pronta', 'retirada'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => statusMutation.mutate({ id: showDetail.id, status: s })}
                      disabled={showDetail.status === s || statusMutation.isPending}
                      className={`px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-medium border transition disabled:opacity-40 capitalize touch-manipulation ${
                        showDetail.status === s
                          ? 'bg-violet-100 border-violet-300 dark:bg-violet-900/30 dark:border-violet-700'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      {statusConfig[s]?.label}
                    </button>
                  ))}
                  <button
                    onClick={() => statusMutation.mutate({ id: showDetail.id, status: 'cancelada' })}
                    disabled={statusMutation.isPending}
                    className="px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-medium border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition touch-manipulation"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Botoes de acao */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <button
                onClick={() => printEncomendaDirect(showDetail, () =>
                  toast.info('Impressora não configurada — abrindo prévia do navegador'),
                )}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-sm hover:bg-accent transition"
              >
                <Printer className="h-4 w-4" /> Reimprimir
              </button>
              {showDetail.status !== 'retirada' && (
                <button
                  onClick={() => {
                    if (confirm('Tem certeza que deseja excluir esta encomenda?'))
                      deleteMutation.mutate(showDetail.id)
                  }}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-300 text-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================
          MODAL: Encomendas Pendentes
      ================================================ */}
      {showPendentes && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto sm:py-8"
          onClick={() => setShowPendentes(false)}
        >
          <div
            className="bg-card rounded-t-2xl sm:rounded-2xl border border-border/60 shadow-xl w-full sm:max-w-2xl sm:mx-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-display font-bold flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-amber-500" />
                  Aguardando Retirada
                </h2>
                {(dataPendentes?.total ?? 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold">
                    {dataPendentes!.total}
                  </span>
                )}
              </div>
              <button onClick={() => setShowPendentes(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingPendentes ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-muted-foreground/40 border-t-muted-foreground rounded-full" />
                Carregando...
              </div>
            ) : !dataPendentes?.data?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                <p className="text-sm font-medium">Nenhuma encomenda pendente</p>
                <p className="text-xs">Todas as encomendas foram finalizadas!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dataPendentes!.data.map((enc: Encomenda) => {
                  const s = statusConfig[enc.status]
                  const StatusIcon = s.icon
                  const isAtrasada = new Date(enc.dataRetirada) < new Date(new Date().toDateString())
                  return (
                    <button
                      key={enc.id}
                      onClick={() => {
                        setShowDetail(enc)
                        setShowPendentes(false)
                      }}
                      className="w-full text-left p-3.5 rounded-xl border border-border hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 dark:hover:border-amber-700 transition group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-bold text-muted-foreground">
                              #{String(enc.numeroOrdem).padStart(4, '0')}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${s.color}`}>
                              <StatusIcon className="h-2.5 w-2.5" />
                              {s.label}
                            </span>
                            {isAtrasada && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                Atrasada
                              </span>
                            )}
                          </div>
                          <div className="font-semibold text-sm truncate">{enc.clienteNome}</div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{fmtDate(enc.dataRetirada)} às {enc.horaRetirada}</span>
                            <span>{enc.itens?.length ?? 0} item(ns)</span>
                            {Number(enc.valorCaucao) > 0 && (
                              <span>Caução: {fmtCurrency(Number(enc.valorCaucao))}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-amber-500 transition-colors" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
