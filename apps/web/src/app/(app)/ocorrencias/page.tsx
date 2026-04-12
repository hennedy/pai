'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { DataTable } from '@/components/data-table'
import { toast } from 'sonner'
import { Plus, MessageSquare, Eye, AlertTriangle } from 'lucide-react'

const priorityColors: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  media: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critica: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const statusColors: Record<string, string> = {
  aberta: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  em_andamento: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  resolvida: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  encerrada: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
}

const tipoOptions = ['operacional', 'equipamento', 'pessoal', 'qualidade', 'seguranca', 'outro']
const prioridadeOptions = ['baixa', 'media', 'alta', 'critica']
const statusOptions = ['aberta', 'em_andamento', 'resolvida', 'encerrada']

export default function OcorrenciasPage() {
  const { selectedUnitId } = useAuthStore()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState<any>(null)
  const [comment, setComment] = useState('')
  const [form, setForm] = useState({
    titulo: '', descricao: '', tipo: 'operacional', setor: '', prioridade: 'media',
  })

  // Buscar ocorrencias
  const { data, isLoading } = useQuery({
    queryKey: ['occurrences', page, search, selectedUnitId, filterTipo, filterStatus],
    queryFn: () => api.get('/occurrences', {
      page, limit: 20, unitId: selectedUnitId!,
      tipo: filterTipo || undefined, status: filterStatus || undefined,
    }),
  })

  // Buscar detalhe
  const { data: detailData, refetch: refetchDetail } = useQuery({
    queryKey: ['occurrence-detail', showDetail?.id],
    queryFn: () => api.get(`/occurrences/${showDetail.id}`),
    enabled: !!showDetail?.id,
  })

  // Criar ocorrencia
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/occurrences', data),
    onSuccess: () => {
      toast.success('Ocorrencia registrada')
      queryClient.invalidateQueries({ queryKey: ['occurrences'] })
      setShowModal(false)
      setForm({ titulo: '', descricao: '', tipo: 'operacional', setor: '', prioridade: 'media' })
    },
    onError: (err: any) => toast.error(err.message),
  })

  // Mudar status
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/occurrences/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status atualizado')
      queryClient.invalidateQueries({ queryKey: ['occurrences'] })
      refetchDetail()
    },
    onError: (err: any) => toast.error(err.message),
  })

  // Adicionar comentario
  const commentMutation = useMutation({
    mutationFn: ({ id, texto }: { id: string; texto: string }) =>
      api.post(`/occurrences/${id}/comments`, { texto }),
    onSuccess: () => {
      toast.success('Comentario adicionado')
      setComment('')
      refetchDetail()
    },
    onError: (err: any) => toast.error(err.message),
  })

  const columns = [
    { key: 'titulo', header: 'Titulo' },
    { key: 'tipo', header: 'Tipo', cell: (row: any) => <span className="capitalize text-xs">{row.tipo}</span> },
    { key: 'setor', header: 'Setor' },
    { key: 'prioridade', header: 'Prioridade', cell: (row: any) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[row.prioridade] || ''}`}>
        {row.prioridade}
      </span>
    )},
    { key: 'status', header: 'Status', cell: (row: any) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[row.status] || ''}`}>
        {row.status.replace('_', ' ')}
      </span>
    )},
    { key: 'createdAt', header: 'Data', cell: (row: any) => new Date(row.createdAt).toLocaleDateString('pt-BR') },
    { key: 'actions', header: '', cell: (row: any) => (
      <button onClick={() => setShowDetail(row)} className="text-amber-600 hover:text-amber-700 text-xs font-medium flex items-center gap-1">
        <Eye className="h-3 w-3" /> Ver
      </button>
    )},
  ]

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-warm-sm">
          <AlertTriangle className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Ocorrencias</h1>
          <p className="text-xs sm:text-sm text-muted-foreground/50">Registro e acompanhamento de ocorrencias</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select value={filterTipo} onChange={(e) => { setFilterTipo(e.target.value); setPage(1) }} className="w-full sm:w-auto px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 outline-none transition">
          <option value="">Todos os tipos</option>
          {tipoOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }} className="w-full sm:w-auto px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 outline-none transition">
          <option value="">Todos os status</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

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
        searchPlaceholder="Buscar ocorrencias..."
        actions={
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition">
            <Plus className="h-4 w-4" /> Nova Ocorrencia
          </button>
        }
      />

      {/* Modal criar ocorrencia */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-card rounded-t-2xl sm:rounded-2xl border border-border/60 shadow-warm-xl w-full sm:max-w-lg sm:mx-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto safe-bottom" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-display font-bold mb-4">Nova Ocorrencia</h2>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...form, unitId: selectedUnitId }) }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Titulo *</label>
                <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Descricao *</label>
                <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required rows={3} className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 outline-none transition" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 outline-none transition">
                    {tipoOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Setor</label>
                  <input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Prioridade</label>
                  <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })} className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 outline-none transition">
                    {prioridadeOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 sm:py-2 rounded-xl border border-border text-sm hover:bg-accent transition touch-manipulation">Cancelar</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2.5 sm:py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition disabled:opacity-50 touch-manipulation">
                  {createMutation.isPending ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal detalhe */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto sm:py-8" onClick={() => setShowDetail(null)}>
          <div className="bg-card rounded-t-2xl sm:rounded-2xl border border-border/60 shadow-warm-xl w-full sm:max-w-2xl sm:mx-4 p-5 sm:p-6 max-h-[90vh] overflow-y-auto safe-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{detailData?.titulo || showDetail.titulo}</h2>
                <div className="flex gap-2 mt-1">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[detailData?.prioridade || showDetail.prioridade]}`}>
                    {detailData?.prioridade || showDetail.prioridade}
                  </span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[detailData?.status || showDetail.status]}`}>
                    {(detailData?.status || showDetail.status).replace('_', ' ')}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowDetail(null)} className="text-muted-foreground hover:text-foreground">X</button>
            </div>

            <p className="text-sm mb-4">{detailData?.descricao || showDetail.descricao}</p>

            {/* Acoes de status */}
            <div className="flex flex-wrap gap-2 mb-4">
              {['aberta', 'em_andamento', 'resolvida', 'encerrada'].map((s) => (
                <button
                  key={s}
                  onClick={() => statusMutation.mutate({ id: showDetail.id, status: s })}
                  disabled={(detailData?.status || showDetail.status) === s}
                  className={`px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-medium border transition disabled:opacity-30 capitalize touch-manipulation ${(detailData?.status || showDetail.status) === s ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700' : 'border-border hover:bg-accent'}`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Historico */}
            {detailData?.history && detailData.history.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-bold mb-2">Historico</h3>
                <div className="space-y-1">
                  {detailData.history.map((h: any) => (
                    <div key={h.id} className="text-xs text-muted-foreground">
                      {new Date(h.createdAt).toLocaleString('pt-BR')} - {h.user?.nome}: {h.statusDe} → {h.statusPara}
                      {h.observacao && ` (${h.observacao})`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comentarios */}
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
                <MessageSquare className="h-4 w-4" /> Comentarios
              </h3>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {(detailData?.comments || []).map((c: any) => (
                  <div key={c.id} className="p-2 rounded-lg bg-muted/50 text-sm">
                    <span className="font-medium">{c.user?.nome}</span>
                    <span className="text-xs text-muted-foreground ml-2">{new Date(c.createdAt).toLocaleString('pt-BR')}</span>
                    <p className="mt-1">{c.texto}</p>
                  </div>
                ))}
                {(!detailData?.comments || detailData.comments.length === 0) && (
                  <p className="text-xs text-muted-foreground">Nenhum comentario</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Adicionar comentario..."
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                />
                <button
                  onClick={() => comment && commentMutation.mutate({ id: showDetail.id, texto: comment })}
                  disabled={!comment || commentMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
