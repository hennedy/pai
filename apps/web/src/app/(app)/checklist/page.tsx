'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { DataTable } from '@/components/data-table'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Play, CheckCircle, ClipboardCheck, LayoutDashboard, Copy,
  Pencil, Trash2, Loader2, AlertCircle, ClipboardList,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const statusColors: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  concluido: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  atrasado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const turnoLabels: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
}

interface Execution {
  id: string
  status: 'pendente' | 'concluido' | 'atrasado'
  turno: 'manha' | 'tarde' | 'noite'
  data: string
  template?: { id: string; nome: string }
  executadoPor?: { id: string; nome: string }
  atribuidoA?: { id: string; nome: string } | null
}

function localDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function ChecklistPage() {
  const router = useRouter()
  const { selectedUnitId } = useAuthStore()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false)
  const [editingExec, setEditingExec] = useState<Execution | null>(null)
  const [editForm, setEditForm] = useState({ turno: 'manha' as 'manha' | 'tarde' | 'noite', responsavelId: '', data: '' })

  // Duplicate modal state
  const [duplicateExec, setDuplicateExec] = useState<Execution | null>(null)
  const [duplicateData, setDuplicateData] = useState(() => localDateStr())

  // Delete modal state
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Buscar execucoes
  const { data: execData, isLoading: execLoading } = useQuery({
    queryKey: ['checklist-executions', page, selectedUnitId],
    queryFn: () => api.get('/checklist/executions', {
      page,
      limit: 20,
      ...(selectedUnitId ? { unitId: selectedUnitId } : {}),
    }),
  })

  // Buscar colaboradores para o select de atribuição
  const { data: colaboradoresData } = useQuery({
    queryKey: ['colaboradores-lookup', selectedUnitId],
    queryFn: () => api.get('/rh/colaboradores/lookup', { status: 'ativo', ...(selectedUnitId ? { unitId: selectedUnitId } : {}) }),
    enabled: editOpen,
  })
  const colaboradores = colaboradoresData?.data || []
  const deletingExec: Execution | undefined = deleteId
    ? execData?.data?.find((e: Execution) => e.id === deleteId)
    : undefined

  // Duplicar execucao
  const duplicateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: string }) =>
      api.post(`/checklist/executions/${id}/duplicate`, { data }),
    onSuccess: (result) => {
      toast.success('Checklist duplicado com sucesso')
      queryClient.invalidateQueries({ queryKey: ['checklist-executions'] })
      setDuplicateExec(null)
      router.push(`/checklist/execucao/${result.id}`)
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao duplicar checklist'),
  })

  // Editar metadados da execucao
  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/checklist/executions/${id}/metadata`, data),
    onSuccess: () => {
      toast.success('Checklist atualizado com sucesso')
      queryClient.invalidateQueries({ queryKey: ['checklist-executions'] })
      setEditOpen(false)
      setEditingExec(null)
    },
    onError: (err: any) => toast.error(err?.message || 'Erro ao atualizar checklist'),
  })

  // Excluir execucao
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/checklist/executions/${id}`),
    onSuccess: () => {
      toast.success('Checklist excluído com sucesso')
      queryClient.invalidateQueries({ queryKey: ['checklist-executions'] })
      setDeleteId(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao excluir checklist')
      queryClient.invalidateQueries({ queryKey: ['checklist-executions'] })
      setDeleteId(null)
    },
  })

  function openEdit(exec: Execution) {
    setEditingExec(exec)
    setEditForm({
      turno: exec.turno,
      responsavelId: (exec as any).responsavel?.id || '',
      data: exec.data ? exec.data.slice(0, 10) : localDateStr(),
    })
    setEditOpen(true)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingExec) return
    editMutation.mutate({
      id: editingExec.id,
      data: {
        turno: editForm.turno,
        responsavelId: editForm.responsavelId || null,
        data: editForm.data || undefined,
      },
    })
  }

  const execColumns = [
    {
      key: 'template',
      header: 'Checklist',
      cell: (row: Execution) => (
        <span className="font-medium">{row.template?.nome || '-'}</span>
      ),
    },
    {
      key: 'turno',
      header: 'Turno',
      cell: (row: Execution) => (
        <span className="capitalize">{turnoLabels[row.turno] || row.turno}</span>
      ),
    },
    {
      key: 'data',
      header: 'Data',
      cell: (row: Execution) => {
        const d = row.data?.slice(0, 10)
        if (!d) return '-'
        const [y, m, day] = d.split('-')
        return `${day}/${m}/${y}`
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: Execution) => (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[row.status] || ''}`}>
          {row.status}
        </span>
      ),
    },
    {
      key: 'executadoPor',
      header: 'Executado por',
      cell: (row: Execution) => row.executadoPor?.nome || '-',
    },
    {
      key: 'responsavel',
      header: 'Responsável',
      cell: (row: Execution) => (row as any).responsavel?.nome || row.atribuidoA?.nome || '-',
    },
    {
      key: 'actions',
      header: 'Ações',
      cell: (row: Execution) => (
        <div className="flex items-center gap-1">
          {row.status !== 'concluido' && (
            <button
              onClick={() => router.push(`/checklist/execucao/${row.id}`)}
              className="text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center gap-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-2 py-1 rounded transition"
            >
              <Play className="h-3 w-3" /> Executar
            </button>
          )}
          {row.status === 'concluido' && (
            <span className="text-green-600 text-xs flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Concluído
            </span>
          )}

          <button
            onClick={() => { setDuplicateExec(row); setDuplicateData(localDateStr()) }}
            className="text-amber-600 hover:text-amber-700 text-xs font-medium flex items-center gap-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 px-2 py-1 rounded transition"
            title="Duplicar"
          >
            <Copy className="h-3 w-3" />
          </button>

          {row.status !== 'concluido' && (
            <>
              <button
                onClick={() => openEdit(row)}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => setDeleteId(row.id)}
                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-warm-md">
            <ClipboardCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Checklist Operacional</h1>
            <p className="text-xs sm:text-sm text-muted-foreground/50">Tarefas avulsas e execuções de checklists</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/checklist/templates')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border hover:bg-accent text-foreground text-sm font-medium transition shadow-sm"
          >
            <ClipboardList className="h-4 w-4 text-amber-500" /> Gerenciar Checklists
          </button>
          <button
            onClick={() => router.push('/checklist/dashboard')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border hover:bg-accent text-foreground text-sm font-medium transition shadow-sm"
          >
            <LayoutDashboard className="h-4 w-4 text-amber-500" /> Dashboard Analytics
          </button>
        </div>
      </div>

      <DataTable
        columns={execColumns}
        data={execData?.data || []}
        total={execData?.pagination?.total ?? execData?.total ?? 0}
        page={page}
        limit={20}
        totalPages={execData?.pagination?.totalPages ?? execData?.totalPages ?? 1}
        onPageChange={setPage}
        loading={execLoading}
        actions={undefined}
      />

      {/* Modal Editar */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) { setEditOpen(false); setEditingExec(null) } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Checklist</DialogTitle>
            <DialogDescription>
              Altere o turno ou o responsável por executar este checklist.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Checklist</label>
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                {editingExec?.template?.nome || '-'}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Data</label>
              <input
                type="date"
                value={editForm.data}
                onChange={(e) => setEditForm((p) => ({ ...p, data: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Turno</label>
              <select
                value={editForm.turno}
                onChange={(e) => setEditForm((p) => ({ ...p, turno: e.target.value as any }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
              >
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Atribuído a <span className="text-muted-foreground text-xs">(opcional)</span>
              </label>
              <select
                value={editForm.responsavelId}
                onChange={(e) => setEditForm((p) => ({ ...p, responsavelId: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
              >
                <option value="">Sem responsável</option>
                {colaboradores.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nomeSocial || c.nome}{c.cargo ? ` — ${c.cargo.nome}` : ''}</option>
                ))}
              </select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setEditOpen(false); setEditingExec(null) }}
                disabled={editMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={editMutation.isPending}
              >
                {editMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Duplicar */}
      <Dialog open={!!duplicateExec} onOpenChange={(open) => !open && setDuplicateExec(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-amber-500" /> Duplicar Checklist
            </DialogTitle>
            <DialogDescription>
              Selecione a data para o novo checklist duplicado de <strong>{duplicateExec?.template?.nome}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <label className="text-sm font-medium">Data</label>
            <input
              type="date"
              value={duplicateData}
              onChange={(e) => setDuplicateData(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateExec(null)} disabled={duplicateMutation.isPending}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!duplicateData || duplicateMutation.isPending}
              onClick={() => duplicateExec && duplicateMutation.mutate({ id: duplicateExec.id, data: duplicateData })}
            >
              {duplicateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Duplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Excluir */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Excluir Checklist
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o checklist{' '}
              <strong className="text-foreground">{deletingExec?.template?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleteMutation.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
