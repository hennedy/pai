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
import { Plus, Pencil, Loader2, Users, ShieldCheck, Crown, UserCog, User as UserIcon, Trash2 } from 'lucide-react'

// Tipos
interface UserRole {
  unitId: string
  unitCode: string
  roleId: string
  role: string
}

interface RoleOption {
  id: string
  nome: string
}

interface User {
  id: string
  nome: string
  email: string
  username: string | null
  cpf: string | null
  status: 'ativo' | 'inativo'
  roles: UserRole[]
  createdAt: string
}

interface UsersResponse {
  data: User[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface Unit {
  id: string
  codigo: string
  nome: string
}

interface UserFormData {
  nome: string
  email: string
  username: string
  cpf: string
  senha: string
  unitRoles: { unitId: string; roleId: string }[]
}

const ROLES_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  gerente_geral: { label: 'Gerente Geral', icon: Crown, color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800/30' },
  gerente_unidade: { label: 'Gerente Unidade', icon: ShieldCheck, color: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800/30' },
  supervisor: { label: 'Supervisor', icon: UserCog, color: 'text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-900/20 dark:border-violet-800/30' },
  producao: { label: 'Produção', icon: UserIcon, color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800/30' },
  administrativo: { label: 'Administrativo', icon: UserIcon, color: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900/20 dark:border-slate-800/30' },
}

// Avatar colors based on name
function getAvatarColor(name: string): string {
  const colors = [
    'from-amber-500 to-orange-600',
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-violet-500 to-purple-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600',
  ]
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  return colors[index]
}

export default function UsuariosPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const [formData, setFormData] = useState<UserFormData>({
    nome: '',
    email: '',
    username: '',
    cpf: '',
    senha: '',
    unitRoles: [{ unitId: '', roleId: '' }],
  })

  const limit = 10

  const { data: usersData, isLoading } = useQuery<UsersResponse>({
    queryKey: ['users', page, search],
    queryFn: () =>
      api.get('/users', { page, limit, search: search || undefined }),
  })

  const { data: unitsData } = useQuery<{ data: Unit[] }>({
    queryKey: ['units', 'all'],
    queryFn: () => api.get('/units', { limit: 100 }),
  })

  const { data: rolesData } = useQuery<RoleOption[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/users/roles'),
  })

  const createMutation = useMutation({
    mutationFn: (data: UserFormData) => api.post('/users', data),
    onSuccess: () => {
      toast.success('Usuario criado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar usuario')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserFormData> }) =>
      api.put(`/users/${id}`, data),
    onSuccess: () => {
      toast.success('Usuario atualizado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar usuario')
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ativo' | 'inativo' }) =>
      api.patch(`/users/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status atualizado!')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao alterar status')
    },
  })

  function openEditModal(user: User) {
    setEditingUser(user)
    setFormData({
      nome: user.nome,
      email: user.email,
      username: user.username ?? '',
      cpf: user.cpf ? user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '',
      senha: '',
      unitRoles: user.roles.map((r) => ({ unitId: r.unitId, roleId: r.roleId })),
    })
    setModalOpen(true)
  }

  function openCreateModal() {
    setEditingUser(null)
    setFormData({ nome: '', email: '', username: '', cpf: '', senha: '', unitRoles: [{ unitId: '', roleId: '' }] })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingUser(null)
    setFormData({ nome: '', email: '', username: '', cpf: '', senha: '', unitRoles: [{ unitId: '', roleId: '' }] })
  }


  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validRoles = formData.unitRoles.filter((r) => r.unitId && r.roleId)
    const cpfClean = formData.cpf ? formData.cpf.replace(/\D/g, '') : undefined
    const payload = { ...formData, cpf: cpfClean || '', unitRoles: validRoles }

    if (editingUser) {
      const { senha, ...rest } = payload
      updateMutation.mutate({
        id: editingUser.id,
        data: senha ? payload : rest,
      })
    } else {
      createMutation.mutate(payload)
    }
  }

  function addRoleLine() {
    setFormData((prev) => ({
      ...prev,
      unitRoles: [...prev.unitRoles, { unitId: '', roleId: '' }],
    }))
  }

  function removeRoleLine(index: number) {
    setFormData((prev) => ({
      ...prev,
      unitRoles: prev.unitRoles.filter((_: { unitId: string; roleId: string }, i: number) => i !== index),
    }))
  }

  function updateRoleLine(index: number, field: 'unitId' | 'roleId', value: string) {
    setFormData((prev) => ({
      ...prev,
      unitRoles: prev.unitRoles.map((r: { unitId: string; roleId: string }, i: number) => (i === index ? { ...r, [field]: value } : r)),
    }))
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  const columns = [
    {
      key: 'nome',
      header: 'Usuario',
      cell: (row: User) => (
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${getAvatarColor(row.nome)} text-white text-xs font-bold shadow-warm-sm shrink-0`}>
            {row.nome.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{row.nome}</p>
            <p className="text-[11px] text-muted-foreground/50">{row.email}</p>
            {row.username && (
              <p className="text-[11px] text-muted-foreground/40">@{row.username}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: User) => (
        <div className="flex items-center gap-2.5">
          <Switch
            checked={row.status === 'ativo'}
            onCheckedChange={(checked) =>
              toggleStatusMutation.mutate({
                id: row.id,
                status: checked ? 'ativo' : 'inativo',
              })
            }
          />
          <Badge variant={row.status === 'ativo' ? 'success' : 'secondary'}>
            {row.status === 'ativo' ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Perfis',
      cell: (row: User) => (
        <div className="flex flex-wrap gap-1.5">
          {row.roles.map((r, i) => {
            const config = ROLES_CONFIG[r.role] || ROLES_CONFIG.administrativo
            const RoleIcon = config.icon
            return (
              <span
                key={i}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${config.color}`}
              >
                <RoleIcon className="h-3 w-3" />
                {r.unitCode} · {config.label}
              </span>
            )
          })}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Desde',
      cell: (row: User) => (
        <span className="text-xs text-muted-foreground/50">
          {new Date(row.createdAt).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row: User) => (
        <Button variant="ghost" size="icon" onClick={() => openEditModal(row)} className="h-8 w-8">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-warm-sm">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Usuarios</h1>
          <p className="text-xs sm:text-sm text-muted-foreground/50">Gerenciamento de usuarios e perfis de acesso</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={usersData?.data || []}
        total={usersData?.total || 0}
        page={page}
        limit={limit}
        totalPages={usersData?.totalPages || 1}
        onPageChange={setPage}
        loading={isLoading}
        searchPlaceholder="Buscar por nome ou email..."
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        actions={
          <Button onClick={openCreateModal} className="bg-amber-600 hover:bg-amber-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuario
          </Button>
        }
      />

      {/* Modal de criar/editar usuario */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuario' : 'Novo Usuario'}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Atualize os dados do usuario abaixo.'
                : 'Preencha os dados para criar um novo usuario.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nome <span className="text-destructive">*</span></label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))}
                className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
                placeholder="Nome completo"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email <span className="text-destructive">*</span></label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Nome de usuario <span className="text-muted-foreground text-xs">(opcional)</span>
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
                className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
                placeholder="ex: joao.silva"
              />
              <p className="text-[11px] text-muted-foreground/50">Apenas letras minusculas, numeros, _, . e -</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                CPF <span className="text-muted-foreground text-xs">(opcional)</span>
              </label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => setFormData((p) => ({ ...p, cpf: e.target.value }))}
                className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
                placeholder="000.000.000-00"
                maxLength={14}
              />
              <p className="text-[11px] text-muted-foreground/50">Usado para vincular ao cadastro de colaborador</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Senha {editingUser ? <span className="text-muted-foreground text-xs">(deixe vazio para manter)</span> : <span className="text-destructive">*</span>}
              </label>
              <input
                type="password"
                required={!editingUser}
                value={formData.senha}
                onChange={(e) => setFormData((p) => ({ ...p, senha: e.target.value }))}
                className="w-full px-3.5 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
                placeholder="********"
              />
            </div>

            {/* Unidades e Roles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Unidades e Perfis</label>
                <Button type="button" variant="ghost" size="sm" onClick={addRoleLine} className="text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {formData.unitRoles.map((role, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-2 sm:items-center p-3 rounded-xl bg-muted/20 border border-border/30">
                    <select
                      value={role.unitId}
                      onChange={(e) => updateRoleLine(index, 'unitId', e.target.value)}
                      className="w-full sm:flex-1 px-3 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
                    >
                      <option value="">Selecione a unidade</option>
                      {(unitsData?.data || []).map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.codigo} - {unit.nome}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2 items-center">
                      <select
                        value={role.roleId}
                        onChange={(e) => updateRoleLine(index, 'roleId', e.target.value)}
                        className="flex-1 px-3 py-2.5 sm:py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition"
                      >
                        <option value="">Selecione o perfil</option>
                        {(rolesData || []).map((r) => {
                          const config = ROLES_CONFIG[r.nome]
                          return (
                            <option key={r.id} value={r.id}>
                              {config?.label || r.nome}
                            </option>
                          )
                        })}
                      </select>
                      {formData.unitRoles.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 h-9 w-9"
                          onClick={() => removeRoleLine(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
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
                {editingUser ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}
