'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Loader2, LayoutList, Trash2, Building2, AlertCircle } from 'lucide-react'

interface Unit {
  id: string
  nome: string
  codigo: string
}

interface Setor {
  id: string
  nome: string
  status: 'ativo' | 'inativo'
  units: Unit[]
  checklistCount: number
  createdAt: string
}

interface SetoresResponse {
  data: Setor[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const emptyForm = {
  nome: '',
  unitIds: [] as string[],
}

export default function SetoresPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editingSetor, setEditingSetor] = useState<Setor | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const limit = 20

  const { data: setoresData, isLoading } = useQuery<SetoresResponse>({
    queryKey: ['setores', page, search],
    queryFn: () => api.get('/setores', { page, limit, search: search || undefined }),
  })

  const { data: unitsData } = useQuery<{ data: Unit[] }>({
    queryKey: ['units-list-simple'],
    queryFn: () => api.get('/units', { page: 1, limit: 100, status: 'ativo' }),
  })

  const units = unitsData?.data || []

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => api.post('/setores', data),
    onSuccess: () => {
      toast.success('Setor criado com sucesso')
      queryClient.invalidateQueries({ queryKey: ['setores'] })
      setModalOpen(false)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao criar setor')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/setores/${id}`, data),
    onSuccess: () => {
      toast.success('Setor atualizado com sucesso')
      queryClient.invalidateQueries({ queryKey: ['setores'] })
      setModalOpen(false)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao atualizar setor')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/setores/${id}`),
    onSuccess: () => {
      toast.success('Setor excluído com sucesso')
      queryClient.invalidateQueries({ queryKey: ['setores'] })
      setDeleteId(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao excluir setor')
      setDeleteId(null)
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ativo' | 'inativo' }) =>
      api.put(`/setores/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setores'] })
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao alterar status')
    },
  })

  function openCreateModal() {
    setEditingSetor(null)
    setFormData(emptyForm)
    setFormErrors({})
    setModalOpen(true)
  }

  function openEditModal(setor: Setor) {
    setEditingSetor(setor)
    setFormData({
      nome: setor.nome,
      unitIds: setor.units.map((u) => u.id),
    })
    setFormErrors({})
    setModalOpen(true)
  }

  function toggleUnit(unitId: string) {
    setFormData((prev) => ({
      ...prev,
      unitIds: prev.unitIds.includes(unitId)
        ? prev.unitIds.filter((id) => id !== unitId)
        : [...prev.unitIds, unitId],
    }))
  }

  function validate() {
    const errors: Record<string, string> = {}
    if (!formData.nome.trim()) errors.nome = 'Nome é obrigatório'
    if (formData.unitIds.length === 0) errors.unitIds = 'Selecione ao menos uma unidade'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (editingSetor) {
      updateMutation.mutate({ id: editingSetor.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const deletingSetor = setoresData?.data.find((s) => s.id === deleteId)
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const columns = [
    {
      key: 'nome',
      header: 'Setor',
      render: (row: Setor) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <LayoutList className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="font-medium text-sm">{row.nome}</span>
        </div>
      ),
    },
    {
      key: 'units',
      header: 'Unidades',
      render: (row: Setor) => (
        <div className="flex flex-wrap gap-1">
          {row.units.length === 0 ? (
            <span className="text-xs text-muted-foreground">Nenhuma unidade</span>
          ) : (
            row.units.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
              >
                <Building2 className="h-3 w-3" />
                {u.codigo}
              </span>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'checklistCount',
      header: 'Checklists',
      render: (row: Setor) => (
        <span className={`text-sm font-medium ${row.checklistCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
          {row.checklistCount}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Setor) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={row.status === 'ativo'}
            onCheckedChange={(checked) =>
              toggleStatusMutation.mutate({ id: row.id, status: checked ? 'ativo' : 'inativo' })
            }
          />
          <Badge variant={row.status === 'ativo' ? 'success' : 'default'}>
            {row.status === 'ativo' ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row: Setor) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            title="Editar"
          >
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setDeleteId(row.id)}
            className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
            title={row.checklistCount > 0 ? 'Setor em uso por checklists' : 'Excluir'}
          >
            <Trash2 className={`h-4 w-4 ${row.checklistCount > 0 ? 'text-muted-foreground/40' : 'text-destructive/70'}`} />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-warm-sm">
          <LayoutList className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Setores</h1>
          <p className="text-xs sm:text-sm text-muted-foreground/50">
            Gerencie os setores disponíveis e as unidades que podem utilizá-los
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={setoresData?.data || []}
        total={setoresData?.total || 0}
        page={page}
        limit={limit}
        totalPages={setoresData?.totalPages || 1}
        onPageChange={setPage}
        loading={isLoading}
        searchPlaceholder="Buscar setor..."
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        actions={
          <Button onClick={openCreateModal} className="bg-amber-600 hover:bg-amber-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Novo Setor
          </Button>
        }
      />

      {/* Modal criar/editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSetor ? 'Editar Setor' : 'Novo Setor'}</DialogTitle>
            <DialogDescription>
              {editingSetor
                ? 'Atualize o nome e as unidades vinculadas a este setor.'
                : 'Informe o nome do setor e selecione as unidades que poderão utilizá-lo.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5 mt-1">
            {/* Nome */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Nome do setor <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
                placeholder="Ex: Produção, Caixa, Limpeza..."
                autoFocus
              />
              {formErrors.nome && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {formErrors.nome}
                </p>
              )}
            </div>

            {/* Unidades */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Unidades <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground">
                Selecione as unidades que poderão usar este setor
              </p>

              {units.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma unidade ativa encontrada</p>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/60">
                  {units.map((unit) => {
                    const checked = formData.unitIds.includes(unit.id)
                    return (
                      <label
                        key={unit.id}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors select-none"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUnit(unit.id)}
                          className="h-4 w-4 rounded border-border text-amber-500 accent-amber-500"
                        />
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md font-mono">
                            {unit.codigo}
                          </span>
                          <span className="text-sm text-foreground truncate">{unit.nome}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}

              {formErrors.unitIds && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {formErrors.unitIds}
                </p>
              )}
            </div>

            <DialogFooter className="pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editingSetor ? 'Salvar alterações' : 'Criar setor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal confirmar exclusão */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir setor</DialogTitle>
            <DialogDescription>
              {deletingSetor?.checklistCount && deletingSetor.checklistCount > 0 ? (
                <span className="text-destructive font-medium">
                  Este setor está vinculado a {deletingSetor.checklistCount} checklist
                  {deletingSetor.checklistCount > 1 ? 's' : ''} e não pode ser excluído.
                  Desative-o ou remova os vínculos primeiro.
                </span>
              ) : (
                <>
                  Tem certeza que deseja excluir o setor{' '}
                  <strong className="text-foreground">{deletingSetor?.nome}</strong>?
                  Esta ação não pode ser desfeita.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {deletingSetor?.checklistCount && deletingSetor.checklistCount > 0 ? 'Fechar' : 'Cancelar'}
            </Button>
            {(!deletingSetor?.checklistCount || deletingSetor.checklistCount === 0) && (
              <Button
                variant="destructive"
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Excluir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
