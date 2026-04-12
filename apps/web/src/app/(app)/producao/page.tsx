'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { DataTable } from '@/components/data-table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  MoreHorizontal,
  Play,
  CheckCircle,
  XCircle,
  Trash2,
  ChefHat,
} from 'lucide-react'

// ============================================
// Tipos
// ============================================

interface Recipe {
  id: string
  nome: string
  categoria: string
  rendimento: number
  unidadeMedida: string
  custoEstimado?: number
  versao?: number
  ingredients?: RecipeIngredient[]
}

interface RecipeIngredient {
  productId: string
  productName?: string
  quantidade: number
  unidadeMedida: string
}

interface ProductionOrder {
  id: string
  receita: { nome: string }
  receitaId: string
  unidade: { nome: string }
  turno: string
  quantidadePlanejada: number
  quantidadeRealizada: number | null
  status: 'planejada' | 'em_andamento' | 'concluida' | 'cancelada'
  createdAt: string
}

interface Product {
  id: string
  nome: string
  unidadeMedida: string
}

// ============================================
// Mapeamento de cores dos badges de status
// ============================================

const statusBadgeColors: Record<string, string> = {
  planejada: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  em_andamento: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  concluida: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelada: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

const statusLabels: Record<string, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluida',
  cancelada: 'Cancelada',
}

const turnoLabels: Record<string, string> = {
  manha: 'Manha',
  tarde: 'Tarde',
  noite: 'Noite',
}

// ============================================
// Pagina principal de Producao
// ============================================

export default function ProducaoPage() {
  const selectedUnitId = useAuthStore((s) => s.selectedUnitId)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const queryClient = useQueryClient()

  // Estado das abas
  const [activeTab, setActiveTab] = useState('ordens')

  // Estado de paginacao e filtros - Ordens
  const [ordensPage, setOrdensPage] = useState(1)
  const [ordensSearch, setOrdensSearch] = useState('')
  const [filtroTurno, setFiltroTurno] = useState<string>('')
  const [filtroStatus, setFiltroStatus] = useState<string>('')

  // Estado de paginacao - Receitas
  const [receitasPage, setReceitasPage] = useState(1)
  const [receitasSearch, setReceitasSearch] = useState('')

  // Estado dos modais
  const [showNovaOrdem, setShowNovaOrdem] = useState(false)
  const [showNovaReceita, setShowNovaReceita] = useState(false)
  const [showConcluirOrdem, setShowConcluirOrdem] = useState<string | null>(null)
  const [qtdRealizada, setQtdRealizada] = useState('')

  const limit = 10

  // ------------------------------------------
  // Queries
  // ------------------------------------------

  // Ordens de producao
  const ordensQuery = useQuery({
    queryKey: ['production-orders', selectedUnitId, ordensPage, ordensSearch, filtroTurno, filtroStatus],
    queryFn: () =>
      api.get('/production-orders', {
        unitId: selectedUnitId!,
        page: ordensPage,
        limit,
        search: ordensSearch || undefined,
        turno: filtroTurno || undefined,
        status: filtroStatus || undefined,
      }),
    enabled: !!selectedUnitId,
  })

  // Receitas
  const receitasQuery = useQuery({
    queryKey: ['recipes', receitasPage, receitasSearch],
    queryFn: () =>
      api.get('/recipes', {
        page: receitasPage,
        limit,
        search: receitasSearch || undefined,
      }),
  })

  // Lista de receitas para o select do modal
  const receitasListQuery = useQuery({
    queryKey: ['recipes-list'],
    queryFn: () => api.get('/recipes', { limit: 999 }),
  })

  // Lista de produtos para ingredientes
  const productsListQuery = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/products', { limit: 999 }),
  })

  const receitasList: Recipe[] = receitasListQuery.data?.data || []
  const productsList: Product[] = productsListQuery.data?.data || []

  // ------------------------------------------
  // Mutations - Acoes nas ordens
  // ------------------------------------------

  const iniciarOrdemMutation = useMutation({
    mutationFn: (orderId: string) =>
      api.patch(`/production-orders/${orderId}/start`),
    onSuccess: () => {
      toast.success('Ordem iniciada com sucesso')
      queryClient.invalidateQueries({ queryKey: ['production-orders'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao iniciar ordem')
    },
  })

  const concluirOrdemMutation = useMutation({
    mutationFn: ({ orderId, quantidadeRealizada }: { orderId: string; quantidadeRealizada: number }) =>
      api.patch(`/production-orders/${orderId}/complete`, { quantidadeRealizada }),
    onSuccess: () => {
      toast.success('Ordem concluida com sucesso')
      setShowConcluirOrdem(null)
      setQtdRealizada('')
      queryClient.invalidateQueries({ queryKey: ['production-orders'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao concluir ordem')
    },
  })

  const cancelarOrdemMutation = useMutation({
    mutationFn: (orderId: string) =>
      api.patch(`/production-orders/${orderId}/cancel`),
    onSuccess: () => {
      toast.success('Ordem cancelada')
      queryClient.invalidateQueries({ queryKey: ['production-orders'] })
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao cancelar ordem')
    },
  })

  // ------------------------------------------
  // Colunas - Ordens de Producao
  // ------------------------------------------

  const ordensColumns = [
    {
      key: 'receita',
      header: 'Receita',
      cell: (row: ProductionOrder) => row.receita?.nome || '-',
    },
    {
      key: 'unidade',
      header: 'Unidade',
      cell: (row: ProductionOrder) => row.unidade?.nome || '-',
    },
    {
      key: 'turno',
      header: 'Turno',
      cell: (row: ProductionOrder) => turnoLabels[row.turno] || row.turno,
    },
    { key: 'quantidadePlanejada', header: 'Qtd Planejada' },
    {
      key: 'quantidadeRealizada',
      header: 'Qtd Realizada',
      cell: (row: ProductionOrder) => row.quantidadeRealizada ?? '-',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: ProductionOrder) => (
        <Badge className={statusBadgeColors[row.status] || ''}>
          {statusLabels[row.status] || row.status}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Data',
      cell: (row: ProductionOrder) =>
        new Date(row.createdAt).toLocaleDateString('pt-BR'),
    },
    {
      key: 'acoes',
      header: 'Acoes',
      cell: (row: ProductionOrder) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Iniciar - disponivel apenas se planejada e com permissao */}
            {row.status === 'planejada' && hasPermission('producao', 'iniciar') && (
              <DropdownMenuItem
                onClick={() => iniciarOrdemMutation.mutate(row.id)}
                className="text-blue-600"
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar
              </DropdownMenuItem>
            )}
            {/* Concluir - disponivel apenas se em andamento e com permissao */}
            {row.status === 'em_andamento' && hasPermission('producao', 'concluir') && (
              <DropdownMenuItem
                onClick={() => setShowConcluirOrdem(row.id)}
                className="text-green-600"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Concluir
              </DropdownMenuItem>
            )}
            {/* Cancelar - disponivel se planejada ou em andamento e com permissao */}
            {(row.status === 'planejada' || row.status === 'em_andamento') && hasPermission('producao', 'cancelar') && (
              <DropdownMenuItem
                onClick={() => cancelarOrdemMutation.mutate(row.id)}
                className="text-red-600"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  // ------------------------------------------
  // Colunas - Receitas
  // ------------------------------------------

  const receitasColumns = [
    { key: 'nome', header: 'Nome' },
    { key: 'categoria', header: 'Categoria' },
    { key: 'rendimento', header: 'Rendimento' },
    {
      key: 'custoEstimado',
      header: 'Custo Estimado',
      cell: (row: Recipe) =>
        row.custoEstimado != null
          ? `R$ ${row.custoEstimado.toFixed(2)}`
          : '-',
    },
    {
      key: 'versao',
      header: 'Versao',
      cell: (row: Recipe) => row.versao ?? 1,
    },
  ]

  // ------------------------------------------
  // Renderizacao
  // ------------------------------------------

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Cabecalho */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-warm-sm">
          <ChefHat className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Producao</h1>
          <p className="text-xs sm:text-sm text-muted-foreground/50">Gerencie ordens de producao e receitas</p>
        </div>
      </div>

      {/* Abas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ordens">Ordens de Producao</TabsTrigger>
          <TabsTrigger value="receitas">Receitas</TabsTrigger>
        </TabsList>

        {/* Aba - Ordens de Producao */}
        <TabsContent value="ordens">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            <div className="w-full sm:w-40">
              <Select value={filtroTurno} onValueChange={(v) => { setFiltroTurno(v === 'todos' ? '' : v); setOrdensPage(1) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os turnos</SelectItem>
                  <SelectItem value="manha">Manha</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                  <SelectItem value="noite">Noite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-44">
              <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v === 'todos' ? '' : v); setOrdensPage(1) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="planejada">Planejada</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluida">Concluida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DataTable
            columns={ordensColumns}
            data={ordensQuery.data?.data || []}
            total={ordensQuery.data?.total || 0}
            page={ordensPage}
            limit={limit}
            totalPages={ordensQuery.data?.totalPages || 1}
            onPageChange={setOrdensPage}
            loading={ordensQuery.isLoading}
            searchValue={ordensSearch}
            onSearchChange={(v) => {
              setOrdensSearch(v)
              setOrdensPage(1)
            }}
            actions={
              hasPermission('producao', 'criar') ? (
                <Button
                  onClick={() => setShowNovaOrdem(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Ordem
                </Button>
              ) : undefined
            }
          />
        </TabsContent>

        {/* Aba - Receitas */}
        <TabsContent value="receitas">
          <DataTable
            columns={receitasColumns}
            data={receitasQuery.data?.data || []}
            total={receitasQuery.data?.total || 0}
            page={receitasPage}
            limit={limit}
            totalPages={receitasQuery.data?.totalPages || 1}
            onPageChange={setReceitasPage}
            loading={receitasQuery.isLoading}
            searchValue={receitasSearch}
            onSearchChange={(v) => {
              setReceitasSearch(v)
              setReceitasPage(1)
            }}
            actions={
              hasPermission('receitas', 'criar') ? (
                <Button
                  onClick={() => setShowNovaReceita(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Receita
                </Button>
              ) : undefined
            }
          />
        </TabsContent>
      </Tabs>

      {/* Modal - Nova Ordem de Producao */}
      <NovaOrdemModal
        open={showNovaOrdem}
        onClose={() => setShowNovaOrdem(false)}
        receitas={receitasList}
        unitId={selectedUnitId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['production-orders'] })
        }}
      />

      {/* Modal - Concluir Ordem */}
      <Dialog
        open={!!showConcluirOrdem}
        onOpenChange={() => {
          setShowConcluirOrdem(null)
          setQtdRealizada('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir Ordem de Producao</DialogTitle>
            <DialogDescription>
              Informe a quantidade realizada para concluir a ordem.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (showConcluirOrdem) {
                concluirOrdemMutation.mutate({
                  orderId: showConcluirOrdem,
                  quantidadeRealizada: parseFloat(qtdRealizada),
                })
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Quantidade Realizada
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={qtdRealizada}
                onChange={(e) => setQtdRealizada(e.target.value)}
                placeholder="Quantidade produzida"
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowConcluirOrdem(null)
                  setQtdRealizada('')
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={concluirOrdemMutation.isPending || !qtdRealizada}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                {concluirOrdemMutation.isPending ? 'Concluindo...' : 'Concluir'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal - Nova Receita */}
      <NovaReceitaModal
        open={showNovaReceita}
        onClose={() => setShowNovaReceita(false)}
        products={productsList}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['recipes'] })
          queryClient.invalidateQueries({ queryKey: ['recipes-list'] })
        }}
      />
    </div>
  )
}

// ============================================
// Modal: Nova Ordem de Producao
// ============================================

function NovaOrdemModal({
  open,
  onClose,
  receitas,
  unitId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  receitas: Recipe[]
  unitId: string | null
  onSuccess: () => void
}) {
  const [receitaId, setReceitaId] = useState('')
  const [turno, setTurno] = useState('')
  const [quantidadePlanejada, setQuantidadePlanejada] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitId) {
      toast.error('Selecione uma unidade')
      return
    }

    setLoading(true)
    try {
      await api.post('/production-orders', {
        unitId,
        receitaId,
        turno,
        quantidadePlanejada: parseFloat(quantidadePlanejada),
      })
      toast.success('Ordem de producao criada com sucesso')
      setReceitaId('')
      setTurno('')
      setQuantidadePlanejada('')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar ordem de producao')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Ordem de Producao</DialogTitle>
          <DialogDescription>Crie uma nova ordem de producao para a unidade</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Receita</label>
            <Select value={receitaId} onValueChange={setReceitaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a receita" />
              </SelectTrigger>
              <SelectContent>
                {receitas.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Turno</label>
            <Select value={turno} onValueChange={setTurno}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o turno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">Manha</SelectItem>
                <SelectItem value="tarde">Tarde</SelectItem>
                <SelectItem value="noite">Noite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Quantidade Planejada
            </label>
            <Input
              type="number"
              min={1}
              step="1"
              value={quantidadePlanejada}
              onChange={(e) => setQuantidadePlanejada(e.target.value)}
              placeholder="Quantidade a produzir"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !receitaId || !turno}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {loading ? 'Criando...' : 'Criar Ordem'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Modal: Nova Receita
// ============================================

function NovaReceitaModal({
  open,
  onClose,
  products,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  products: Product[]
  onSuccess: () => void
}) {
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('')
  const [rendimento, setRendimento] = useState('')
  const [unidadeMedida, setUnidadeMedida] = useState('')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { productId: '', quantidade: 0, unidadeMedida: '' },
  ])
  const [loading, setLoading] = useState(false)

  const unidades = ['kg', 'g', 'un', 'l', 'ml']
  const categorias = ['paes', 'bolos', 'doces', 'salgados', 'bebidas', 'outros']

  // Adicionar ingrediente
  function addIngredient() {
    setIngredients([...ingredients, { productId: '', quantidade: 0, unidadeMedida: '' }])
  }

  // Remover ingrediente
  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  // Atualizar ingrediente
  function updateIngredient(index: number, field: string, value: any) {
    const newIngredients = [...ingredients]
    ;(newIngredients[index] as any)[field] = value
    setIngredients(newIngredients)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validIngredients = ingredients.filter((i) => i.productId && i.quantidade > 0)
    if (validIngredients.length === 0) {
      toast.error('Adicione pelo menos um ingrediente')
      return
    }

    setLoading(true)
    try {
      await api.post('/recipes', {
        nome,
        categoria,
        rendimento: parseFloat(rendimento),
        unidadeMedida,
        ingredients: validIngredients,
      })
      toast.success('Receita criada com sucesso')
      // Limpar formulario
      setNome('')
      setCategoria('')
      setRendimento('')
      setUnidadeMedida('')
      setIngredients([{ productId: '', quantidade: 0, unidadeMedida: '' }])
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar receita')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Receita</DialogTitle>
          <DialogDescription>Cadastre uma nova receita com seus ingredientes</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados basicos da receita */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nome</label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome da receita"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Categoria</label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Rendimento</label>
              <Input
                type="number"
                min={0.01}
                step="0.01"
                value={rendimento}
                onChange={(e) => setRendimento(e.target.value)}
                placeholder="Ex: 50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Unidade de Medida</label>
              <Select value={unidadeMedida} onValueChange={setUnidadeMedida}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ingredientes - Lista dinamica */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Ingredientes</h4>
              <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            {ingredients.map((ing, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-2 sm:items-center p-3 sm:p-0 rounded-xl sm:rounded-none bg-muted/30 sm:bg-transparent">
                {/* Produto */}
                <div className="flex-1">
                  <Select
                    value={ing.productId}
                    onValueChange={(v) => updateIngredient(index, 'productId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  {/* Quantidade */}
                  <div className="flex-1 sm:w-24 sm:flex-none">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={ing.quantidade || ''}
                      onChange={(e) =>
                        updateIngredient(index, 'quantidade', parseFloat(e.target.value) || 0)
                      }
                      placeholder="Qtd"
                    />
                  </div>
                  {/* Unidade de medida */}
                  <div className="flex-1 sm:w-24 sm:flex-none">
                    <Select
                      value={ing.unidadeMedida}
                      onValueChange={(v) => updateIngredient(index, 'unidadeMedida', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Un." />
                      </SelectTrigger>
                      <SelectContent>
                        {unidades.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Remover */}
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="p-2.5 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition touch-manipulation shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {loading ? 'Criando...' : 'Criar Receita'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
