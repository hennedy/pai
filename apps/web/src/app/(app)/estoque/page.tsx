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
import { Textarea } from '@/components/ui/textarea'
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
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react'

// ============================================
// Tipos
// ============================================

interface Product {
  id: string
  sku: string
  nome: string
  categoria: string
  unidadeMedida: string
  estoqueMinimo: number
  status: string
}

interface StockBalance {
  id: string
  productId: string
  product: { nome: string }
  saldo: number
  unidadeMedida: string
  estoqueMinimo: number
}

interface StockMovement {
  id: string
  createdAt: string
  product: { nome: string }
  tipo: 'entrada' | 'saida' | 'ajuste' | 'perda'
  quantidade: number
  responsavel: { nome: string }
}

interface StockAlert {
  id: string
  product: { nome: string }
  saldo: number
  estoqueMinimo: number
  unidadeMedida: string
}

// ============================================
// Mapeamento de cores dos badges
// ============================================

const tipoBadgeColors: Record<string, string> = {
  entrada: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  saida: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  ajuste: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  perda: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
}

const tipoLabels: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saida',
  ajuste: 'Ajuste',
  perda: 'Perda',
}

// ============================================
// Tipos dos modais de movimentacao
// ============================================

type ModalType = 'entrada' | 'saida' | 'ajuste' | 'perda' | 'produto' | null

// ============================================
// Pagina principal de Estoque
// ============================================

export default function EstoquePage() {
  const selectedUnitId = useAuthStore((s) => s.selectedUnitId)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const queryClient = useQueryClient()

  // Estado das abas
  const [activeTab, setActiveTab] = useState('saldo')

  // Estado dos modais
  const [modalType, setModalType] = useState<ModalType>(null)

  // Estado de paginacao e busca por aba
  const [saldoPage, setSaldoPage] = useState(1)
  const [saldoSearch, setSaldoSearch] = useState('')
  const [movPage, setMovPage] = useState(1)
  const [movSearch, setMovSearch] = useState('')
  const [prodPage, setProdPage] = useState(1)
  const [prodSearch, setProdSearch] = useState('')
  const [alertPage, setAlertPage] = useState(1)

  const limit = 10

  // ------------------------------------------
  // Queries
  // ------------------------------------------

  // Saldo atual
  const saldoQuery = useQuery({
    queryKey: ['stock-balance', selectedUnitId, saldoPage, saldoSearch],
    queryFn: () =>
      api.get('/stock/balance', {
        unitId: selectedUnitId!,
        page: saldoPage,
        limit,
        search: saldoSearch || undefined,
      }),
    enabled: !!selectedUnitId,
  })

  // Movimentacoes
  const movQuery = useQuery({
    queryKey: ['stock-movements', selectedUnitId, movPage, movSearch],
    queryFn: () =>
      api.get('/stock/movements', {
        unitId: selectedUnitId!,
        page: movPage,
        limit,
        search: movSearch || undefined,
      }),
    enabled: !!selectedUnitId,
  })

  // Produtos
  const prodQuery = useQuery({
    queryKey: ['products', prodPage, prodSearch],
    queryFn: () =>
      api.get('/products', {
        page: prodPage,
        limit,
        search: prodSearch || undefined,
      }),
  })

  // Alertas
  const alertQuery = useQuery({
    queryKey: ['stock-alerts', selectedUnitId, alertPage],
    queryFn: () =>
      api.get('/stock/alerts', {
        unitId: selectedUnitId!,
        page: alertPage,
        limit,
      }),
    enabled: !!selectedUnitId,
  })

  // Lista de produtos para selects nos modais
  const productsListQuery = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/products', { limit: 999 }),
  })

  const productsList: Product[] = productsListQuery.data?.data || []

  // ------------------------------------------
  // Colunas das tabelas
  // ------------------------------------------

  const saldoColumns = [
    {
      key: 'product',
      header: 'Produto',
      cell: (row: StockBalance) => row.product?.nome || '-',
    },
    { key: 'saldo', header: 'Saldo' },
    { key: 'unidadeMedida', header: 'Unidade de Medida' },
    {
      key: 'status',
      header: 'Status',
      cell: (row: StockBalance) => {
        const abaixo = row.saldo < row.estoqueMinimo
        return (
          <Badge
            className={
              abaixo
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            }
          >
            {abaixo ? 'Abaixo do minimo' : 'Normal'}
          </Badge>
        )
      },
    },
  ]

  const movColumns = [
    {
      key: 'createdAt',
      header: 'Data',
      cell: (row: StockMovement) =>
        new Date(row.createdAt).toLocaleDateString('pt-BR'),
    },
    {
      key: 'product',
      header: 'Produto',
      cell: (row: StockMovement) => row.product?.nome || '-',
    },
    {
      key: 'tipo',
      header: 'Tipo',
      cell: (row: StockMovement) => (
        <Badge className={tipoBadgeColors[row.tipo] || ''}>
          {tipoLabels[row.tipo] || row.tipo}
        </Badge>
      ),
    },
    { key: 'quantidade', header: 'Quantidade' },
    {
      key: 'responsavel',
      header: 'Responsavel',
      cell: (row: StockMovement) => row.responsavel?.nome || '-',
    },
  ]

  const prodColumns = [
    { key: 'sku', header: 'SKU' },
    { key: 'nome', header: 'Nome' },
    { key: 'categoria', header: 'Categoria' },
    { key: 'unidadeMedida', header: 'Unidade de Medida' },
    { key: 'estoqueMinimo', header: 'Estoque Minimo' },
    {
      key: 'status',
      header: 'Status',
      cell: (row: Product) => (
        <Badge
          className={
            row.status === 'ativo'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
          }
        >
          {row.status === 'ativo' ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
  ]

  const alertColumns = [
    {
      key: 'product',
      header: 'Produto',
      cell: (row: StockAlert) => row.product?.nome || '-',
    },
    { key: 'saldo', header: 'Saldo Atual' },
    { key: 'estoqueMinimo', header: 'Estoque Minimo' },
    { key: 'unidadeMedida', header: 'Unidade' },
  ]

  // ------------------------------------------
  // Renderizacao
  // ------------------------------------------

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Cabecalho */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-warm-sm">
          <Package className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Estoque</h1>
          <p className="text-xs sm:text-sm text-muted-foreground/50">Gerencie o estoque de produtos da unidade</p>
        </div>
      </div>

      {/* Abas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="saldo">Saldo Atual</TabsTrigger>
          <TabsTrigger value="movimentacoes">Movimentacoes</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
        </TabsList>

        {/* Aba - Saldo Atual */}
        <TabsContent value="saldo">
          <DataTable
            columns={saldoColumns}
            data={saldoQuery.data?.data || []}
            total={saldoQuery.data?.total || 0}
            page={saldoPage}
            limit={limit}
            totalPages={saldoQuery.data?.totalPages || 1}
            onPageChange={setSaldoPage}
            loading={saldoQuery.isLoading}
            searchValue={saldoSearch}
            onSearchChange={(v) => {
              setSaldoSearch(v)
              setSaldoPage(1)
            }}
          />
        </TabsContent>

        {/* Aba - Movimentacoes */}
        <TabsContent value="movimentacoes">
          <DataTable
            columns={movColumns}
            data={movQuery.data?.data || []}
            total={movQuery.data?.total || 0}
            page={movPage}
            limit={limit}
            totalPages={movQuery.data?.totalPages || 1}
            onPageChange={setMovPage}
            loading={movQuery.isLoading}
            searchValue={movSearch}
            onSearchChange={(v) => {
              setMovSearch(v)
              setMovPage(1)
            }}
          />
        </TabsContent>

        {/* Aba - Produtos */}
        <TabsContent value="produtos">
          <DataTable
            columns={prodColumns}
            data={prodQuery.data?.data || []}
            total={prodQuery.data?.total || 0}
            page={prodPage}
            limit={limit}
            totalPages={prodQuery.data?.totalPages || 1}
            onPageChange={setProdPage}
            loading={prodQuery.isLoading}
            searchValue={prodSearch}
            onSearchChange={(v) => {
              setProdSearch(v)
              setProdPage(1)
            }}
            actions={
              hasPermission('produtos', 'criar') ? (
                <Button
                  onClick={() => setModalType('produto')}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Produto
                </Button>
              ) : undefined
            }
          />
        </TabsContent>

        {/* Aba - Alertas */}
        <TabsContent value="alertas">
          <DataTable
            columns={alertColumns}
            data={alertQuery.data?.data || []}
            total={alertQuery.data?.total || 0}
            page={alertPage}
            limit={limit}
            totalPages={alertQuery.data?.totalPages || 1}
            onPageChange={setAlertPage}
            loading={alertQuery.isLoading}
          />
        </TabsContent>

        {/* Aba - Inventario */}
        <TabsContent value="inventario">
          <InventarioForm
            products={productsList}
            unitId={selectedUnitId}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['stock-balance'] })
              queryClient.invalidateQueries({ queryKey: ['stock-alerts'] })
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Botoes flutuantes de acao */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 flex flex-col gap-2 sm:gap-3 z-40">
        {hasPermission('estoque', 'entrada') && (
          <button
            onClick={() => setModalType('entrada')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg bg-green-500 hover:bg-green-600 text-white font-medium transition touch-manipulation text-sm"
            title="Entrada"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Entrada
          </button>
        )}
        {hasPermission('estoque', 'saida') && (
          <button
            onClick={() => setModalType('saida')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg bg-red-500 hover:bg-red-600 text-white font-medium transition touch-manipulation text-sm"
            title="Saida"
          >
            <ArrowUpFromLine className="h-4 w-4" />
            Saida
          </button>
        )}
        {hasPermission('estoque', 'ajuste') && (
          <button
            onClick={() => setModalType('ajuste')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition touch-manipulation text-sm"
            title="Ajuste"
          >
            <RefreshCw className="h-4 w-4" />
            Ajuste
          </button>
        )}
        {hasPermission('estoque', 'perda') && (
          <button
            onClick={() => setModalType('perda')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition touch-manipulation text-sm"
            title="Perda"
          >
            <AlertTriangle className="h-4 w-4" />
            Perda
          </button>
        )}
      </div>

      {/* Modal - Entrada de Estoque */}
      <EntradaModal
        open={modalType === 'entrada'}
        onClose={() => setModalType(null)}
        products={productsList}
        unitId={selectedUnitId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['stock-balance'] })
          queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
          queryClient.invalidateQueries({ queryKey: ['stock-alerts'] })
        }}
      />

      {/* Modal - Saida de Estoque */}
      <SaidaModal
        open={modalType === 'saida'}
        onClose={() => setModalType(null)}
        products={productsList}
        unitId={selectedUnitId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['stock-balance'] })
          queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
          queryClient.invalidateQueries({ queryKey: ['stock-alerts'] })
        }}
      />

      {/* Modal - Ajuste de Estoque */}
      <AjusteModal
        open={modalType === 'ajuste'}
        onClose={() => setModalType(null)}
        products={productsList}
        unitId={selectedUnitId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['stock-balance'] })
          queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
          queryClient.invalidateQueries({ queryKey: ['stock-alerts'] })
        }}
      />

      {/* Modal - Perda de Estoque */}
      <PerdaModal
        open={modalType === 'perda'}
        onClose={() => setModalType(null)}
        products={productsList}
        unitId={selectedUnitId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['stock-balance'] })
          queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
          queryClient.invalidateQueries({ queryKey: ['stock-alerts'] })
        }}
      />

      {/* Modal - Novo Produto */}
      <NovoProdutoModal
        open={modalType === 'produto'}
        onClose={() => setModalType(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] })
          queryClient.invalidateQueries({ queryKey: ['products-list'] })
        }}
      />
    </div>
  )
}

// ============================================
// Componente: Formulario de Inventario
// ============================================

function InventarioForm({
  products,
  unitId,
  onSuccess,
}: {
  products: Product[]
  unitId: string | null
  onSuccess: () => void
}) {
  const [items, setItems] = useState<{ productId: string; quantidade: number }[]>([
    { productId: '', quantidade: 0 },
  ])
  const [loading, setLoading] = useState(false)

  // Adicionar linha
  function addItem() {
    setItems([...items, { productId: '', quantidade: 0 }])
  }

  // Remover linha
  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  // Atualizar item
  function updateItem(index: number, field: string, value: any) {
    const newItems = [...items]
    ;(newItems[index] as any)[field] = value
    setItems(newItems)
  }

  // Enviar inventario
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitId) {
      toast.error('Selecione uma unidade')
      return
    }

    const validItems = items.filter((i) => i.productId)
    if (validItems.length === 0) {
      toast.error('Adicione pelo menos um produto')
      return
    }

    setLoading(true)
    try {
      await api.post('/stock/inventory', {
        unitId,
        items: validItems,
      })
      toast.success('Inventario registrado com sucesso')
      setItems([{ productId: '', quantidade: 0 }])
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar inventario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h3 className="font-semibold text-sm">Contagem Fisica</h3>
        <p className="text-xs text-muted-foreground">
          Selecione os produtos e informe as quantidades contadas fisicamente.
        </p>

        {items.map((item, index) => (
          <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-0 bg-muted/30 sm:bg-transparent rounded-xl sm:rounded-none">
            <div className="flex-1">
              <Select
                value={item.productId}
                onValueChange={(v) => updateItem(index, 'productId', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
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
            <div className="w-full sm:w-32 flex items-center gap-2">
              <div className="flex-1 sm:flex-none sm:w-32">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={item.quantidade || ''}
                  onChange={(e) =>
                    updateItem(index, 'quantidade', parseFloat(e.target.value) || 0)
                  }
                  placeholder="Qtd"
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-2.5 sm:p-2 text-red-500 hover:text-red-700 transition touch-manipulation"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar Produto
        </Button>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="bg-amber-500 hover:bg-amber-600 text-white"
      >
        {loading ? 'Registrando...' : 'Registrar Inventario'}
      </Button>
    </form>
  )
}

// ============================================
// Modal: Entrada de Estoque
// ============================================

function EntradaModal({
  open,
  onClose,
  products,
  unitId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  products: Product[]
  unitId: string | null
  onSuccess: () => void
}) {
  const [productId, setProductId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [lote, setLote] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitId) {
      toast.error('Selecione uma unidade')
      return
    }

    setLoading(true)
    try {
      await api.post('/stock/movements', {
        unitId,
        productId,
        tipo: 'entrada',
        quantidade: parseFloat(quantidade),
        lote: lote || undefined,
        vencimento: vencimento || undefined,
      })
      toast.success('Entrada registrada com sucesso')
      // Limpar formulario
      setProductId('')
      setQuantidade('')
      setLote('')
      setVencimento('')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar entrada')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrada de Estoque</DialogTitle>
          <DialogDescription>Registre a entrada de produtos no estoque</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Produto</label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
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
          <div>
            <label className="block text-sm font-medium mb-1.5">Quantidade</label>
            <Input
              type="number"
              min={0.01}
              step="0.01"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Quantidade"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Lote</label>
            <Input
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              placeholder="Numero do lote (opcional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Vencimento</label>
            <Input
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !productId}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {loading ? 'Registrando...' : 'Registrar Entrada'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Modal: Saida de Estoque
// ============================================

function SaidaModal({
  open,
  onClose,
  products,
  unitId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  products: Product[]
  unitId: string | null
  onSuccess: () => void
}) {
  const [productId, setProductId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitId) {
      toast.error('Selecione uma unidade')
      return
    }

    setLoading(true)
    try {
      await api.post('/stock/movements', {
        unitId,
        productId,
        tipo: 'saida',
        quantidade: parseFloat(quantidade),
      })
      toast.success('Saida registrada com sucesso')
      setProductId('')
      setQuantidade('')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar saida')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saida de Estoque</DialogTitle>
          <DialogDescription>Registre a saida de produtos do estoque</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Produto</label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
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
          <div>
            <label className="block text-sm font-medium mb-1.5">Quantidade</label>
            <Input
              type="number"
              min={0.01}
              step="0.01"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Quantidade"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !productId}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {loading ? 'Registrando...' : 'Registrar Saida'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Modal: Ajuste de Estoque
// ============================================

function AjusteModal({
  open,
  onClose,
  products,
  unitId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  products: Product[]
  unitId: string | null
  onSuccess: () => void
}) {
  const [productId, setProductId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitId) {
      toast.error('Selecione uma unidade')
      return
    }
    if (!motivo.trim()) {
      toast.error('Informe o motivo do ajuste')
      return
    }

    setLoading(true)
    try {
      await api.post('/stock/movements', {
        unitId,
        productId,
        tipo: 'ajuste',
        quantidade: parseFloat(quantidade),
        motivo,
      })
      toast.success('Ajuste registrado com sucesso')
      setProductId('')
      setQuantidade('')
      setMotivo('')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar ajuste')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuste de Estoque</DialogTitle>
          <DialogDescription>
            Registre um ajuste no estoque. Valores negativos reduzem o saldo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Produto</label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
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
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Quantidade (pode ser negativa)
            </label>
            <Input
              type="number"
              step="0.01"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Ex: -5 ou 10"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Motivo *</label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo do ajuste"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !productId || !motivo.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {loading ? 'Registrando...' : 'Registrar Ajuste'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Modal: Perda de Estoque
// ============================================

function PerdaModal({
  open,
  onClose,
  products,
  unitId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  products: Product[]
  unitId: string | null
  onSuccess: () => void
}) {
  const [productId, setProductId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [lossType, setLossType] = useState('')
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)

  const lossTypes = [
    { value: 'quebra', label: 'Quebra' },
    { value: 'vencimento', label: 'Vencimento' },
    { value: 'erro_operacional', label: 'Erro Operacional' },
    { value: 'roubo', label: 'Roubo' },
    { value: 'outro', label: 'Outro' },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitId) {
      toast.error('Selecione uma unidade')
      return
    }

    setLoading(true)
    try {
      await api.post('/stock/movements', {
        unitId,
        productId,
        tipo: 'perda',
        quantidade: parseFloat(quantidade),
        lossType,
        motivo: motivo || undefined,
      })
      toast.success('Perda registrada com sucesso')
      setProductId('')
      setQuantidade('')
      setLossType('')
      setMotivo('')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar perda')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Perda</DialogTitle>
          <DialogDescription>Registre a perda de produtos no estoque</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Produto</label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
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
          <div>
            <label className="block text-sm font-medium mb-1.5">Quantidade</label>
            <Input
              type="number"
              min={0.01}
              step="0.01"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Quantidade perdida"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Tipo de Perda</label>
            <Select value={lossType} onValueChange={setLossType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {lossTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Motivo</label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da perda (opcional)"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !productId || !lossType}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {loading ? 'Registrando...' : 'Registrar Perda'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================
// Modal: Novo Produto
// ============================================

function NovoProdutoModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [sku, setSku] = useState('')
  const [nome, setNome] = useState('')
  const [categoria, setCategoria] = useState('')
  const [unidadeMedida, setUnidadeMedida] = useState('')
  const [estoqueMinimo, setEstoqueMinimo] = useState('')
  const [loading, setLoading] = useState(false)

  const unidades = ['kg', 'g', 'un', 'l', 'ml', 'cx', 'pc']
  const categorias = [
    'materia_prima',
    'embalagem',
    'produto_acabado',
    'insumo',
    'limpeza',
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/products', {
        sku,
        nome,
        categoria,
        unidadeMedida,
        estoqueMinimo: parseFloat(estoqueMinimo) || 0,
      })
      toast.success('Produto criado com sucesso')
      setSku('')
      setNome('')
      setCategoria('')
      setUnidadeMedida('')
      setEstoqueMinimo('')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar produto')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
          <DialogDescription>Cadastre um novo produto no sistema</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">SKU</label>
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Codigo SKU"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Nome</label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do produto"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Categoria</label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Unidade de Medida</label>
            <Select value={unidadeMedida} onValueChange={setUnidadeMedida}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
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
          <div>
            <label className="block text-sm font-medium mb-1.5">Estoque Minimo</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={estoqueMinimo}
              onChange={(e) => setEstoqueMinimo(e.target.value)}
              placeholder="Quantidade minima"
            />
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
              {loading ? 'Criando...' : 'Criar Produto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
