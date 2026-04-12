'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { DataTable } from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
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
  Trash2,
  BoxIcon,
  FolderTree,
  ChevronRight,
  Package,
  Tag,
  Wrench,
  BarChart3,
  Factory,
  Wheat,
  Scale,
  ShoppingCart,
} from 'lucide-react'

// ============================================
// Tipos
// ============================================

interface Category {
  id: string
  nome: string
  createdAt: string
  updatedAt: string
  subcategories: Subcategory[]
  _count: { products: number }
}

interface Subcategory {
  id: string
  nome: string
  createdAt?: string
}

interface Product {
  id: string
  nome: string
  sku: string | null
  categoriaId: string | null
  subcategoriaId: string | null
  unidadeMedida: string
  codigoSistema: string | null
  codigoCotacao: string | null
  codigoBarras: string | null
  isBalanca: boolean
  codigoBalanca: string | null
  isEtiqueta: boolean
  validadeDias: number | null
  isUtensilio: boolean
  controlaEstoque: boolean
  enviaProducao: boolean
  isInsumo: boolean
  participaCotacao: boolean
  estoqueMinimo: number
  custoMedio: number
  status: string
  createdAt: string
  updatedAt: string
  categoria: { id: string; nome: string } | null
  subcategoria: { id: string; nome: string } | null
}

// ============================================
// Unidades de medida
// ============================================

const unidadesMedida = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'lt', label: 'Litro (lt)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'pc', label: 'Pacote (pc)' },
  { value: 'fd', label: 'Fardo (fd)' },
  { value: 'dz', label: 'Duzia (dz)' },
]

// ============================================
// Pagina principal de Produtos
// ============================================

export default function ProdutosPage() {
  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-warm-sm">
            <BoxIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground tracking-tight">
              Produtos
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground/60 mt-0.5">
              Catalogo de produtos, categorias e subcategorias
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos" className="gap-1.5">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Produtos</span>
          </TabsTrigger>
          <TabsTrigger value="categorias" className="gap-1.5">
            <FolderTree className="h-4 w-4" />
            <span className="hidden sm:inline">Categorias</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="categorias">
          <CategoriesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================
// Tab: Produtos
// ============================================

function ProductsTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const limit = 20

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Form state
  const [formNome, setFormNome] = useState('')
  const [formSku, setFormSku] = useState('')
  const [formCategoriaId, setFormCategoriaId] = useState('')
  const [formSubcategoriaId, setFormSubcategoriaId] = useState('')
  const [formUnidadeMedida, setFormUnidadeMedida] = useState('un')
  const [formCodigoSistema, setFormCodigoSistema] = useState('')
  const [formCodigoCotacao, setFormCodigoCotacao] = useState('')
  const [formCodigoBarras, setFormCodigoBarras] = useState('')
  const [formIsBalanca, setFormIsBalanca] = useState(false)
  const [formCodigoBalanca, setFormCodigoBalanca] = useState('')
  const [formIsEtiqueta, setFormIsEtiqueta] = useState(false)
  const [formValidadeDias, setFormValidadeDias] = useState('')
  const [formIsUtensilio, setFormIsUtensilio] = useState(false)
  const [formControlaEstoque, setFormControlaEstoque] = useState(true)
  const [formEnviaProducao, setFormEnviaProducao] = useState(false)
  const [formIsInsumo, setFormIsInsumo] = useState(false)
  const [formParticipaCotacao, setFormParticipaCotacao] = useState(false)
  const [formEstoqueMinimo, setFormEstoqueMinimo] = useState('')
  const [formCustoMedio, setFormCustoMedio] = useState('')

  // Fetch categories for selects
  const { data: categoriesData } = useQuery({
    queryKey: ['categories-all'],
    queryFn: () => api.get('/categories/all'),
  })
  const categories: Category[] = categoriesData?.data || []

  const selectedCategoryObj = categories.find((c) => c.id === formCategoriaId)
  const subcategories = selectedCategoryObj?.subcategories || []

  // Fetch products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', page, search, filterCategoria],
    queryFn: () =>
      api.get('/products', {
        page,
        limit,
        search: search || undefined,
        categoriaId: filterCategoria || undefined,
      }),
  })

  const products: Product[] = productsData?.data || []
  const total = productsData?.total || 0
  const totalPages = productsData?.totalPages || 1

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/products', data),
    onSuccess: () => {
      toast.success('Produto criado com sucesso')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      closeModal()
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao criar produto'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/products/${id}`, data),
    onSuccess: () => {
      toast.success('Produto atualizado com sucesso')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      closeModal()
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar produto'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success('Produto removido com sucesso')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao remover produto'),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/products/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status atualizado')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao alterar status'),
  })

  function resetForm() {
    setFormNome('')
    setFormSku('')
    setFormCategoriaId('')
    setFormSubcategoriaId('')
    setFormUnidadeMedida('un')
    setFormCodigoSistema('')
    setFormCodigoCotacao('')
    setFormCodigoBarras('')
    setFormIsBalanca(false)
    setFormCodigoBalanca('')
    setFormIsEtiqueta(false)
    setFormValidadeDias('')
    setFormIsUtensilio(false)
    setFormControlaEstoque(true)
    setFormEnviaProducao(false)
    setFormIsInsumo(false)
    setFormParticipaCotacao(false)
    setFormEstoqueMinimo('')
    setFormCustoMedio('')
  }

  function openCreate() {
    resetForm()
    setEditingProduct(null)
    setModalOpen(true)
  }

  function openEdit(product: Product) {
    setEditingProduct(product)
    setFormNome(product.nome)
    setFormSku(product.sku || '')
    setFormCategoriaId(product.categoriaId || '')
    setFormSubcategoriaId(product.subcategoriaId || '')
    setFormUnidadeMedida(product.unidadeMedida)
    setFormCodigoSistema(product.codigoSistema || '')
    setFormCodigoCotacao(product.codigoCotacao || '')
    setFormCodigoBarras(product.codigoBarras || '')
    setFormIsBalanca(product.isBalanca)
    setFormCodigoBalanca(product.codigoBalanca || '')
    setFormIsEtiqueta(product.isEtiqueta)
    setFormValidadeDias(product.validadeDias?.toString() || '')
    setFormIsUtensilio(product.isUtensilio)
    setFormControlaEstoque(product.controlaEstoque)
    setFormEnviaProducao(product.enviaProducao)
    setFormIsInsumo(product.isInsumo)
    setFormParticipaCotacao(product.participaCotacao)
    setFormEstoqueMinimo(product.estoqueMinimo?.toString() || '0')
    setFormCustoMedio(product.custoMedio?.toString() || '0')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingProduct(null)
    resetForm()
  }

  function handleSubmit() {
    if (!formNome.trim()) {
      toast.error('Nome e obrigatorio')
      return
    }

    const payload: any = {
      nome: formNome.trim(),
      sku: formSku.trim() || null,
      categoriaId: formCategoriaId || null,
      subcategoriaId: formSubcategoriaId || null,
      unidadeMedida: formUnidadeMedida,
      codigoSistema: formCodigoSistema.trim() || null,
      codigoBarras: formCodigoBarras.trim() || null,
      participaCotacao: formParticipaCotacao,
      codigoCotacao: formParticipaCotacao ? (formCodigoCotacao.trim() || null) : null,
      isBalanca: formIsBalanca,
      codigoBalanca: formIsBalanca ? (formCodigoBalanca.trim() || null) : null,
      isEtiqueta: formIsEtiqueta,
      validadeDias: formIsEtiqueta && formValidadeDias ? parseInt(formValidadeDias) : null,
      isUtensilio: formIsUtensilio,
      controlaEstoque: formControlaEstoque,
      enviaProducao: formEnviaProducao,
      isInsumo: formIsInsumo,
      estoqueMinimo: parseFloat(formEstoqueMinimo) || 0,
      custoMedio: parseFloat(formCustoMedio) || 0,
    }

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  const columns = [
    {
      key: 'nome',
      header: 'Produto',
      cell: (row: Product) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
            <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <button
              onClick={() => { setDetailProduct(row); setDetailOpen(true) }}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors text-left truncate block max-w-[200px] sm:max-w-none"
            >
              {row.nome}
            </button>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">
              {row.categoria?.nome || 'Sem categoria'}
              {row.subcategoria ? ` / ${row.subcategoria.nome}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'unidadeMedida',
      header: 'Un.',
      hideOnMobile: true,
      cell: (row: Product) => (
        <span className="text-xs font-medium bg-muted/50 px-2 py-1 rounded-md">{row.unidadeMedida}</span>
      ),
    },
    {
      key: 'flags',
      header: 'Flags',
      hideOnMobile: true,
      cell: (row: Product) => {
        const flags = [
          row.isEtiqueta && { label: 'Etiq', icon: Tag },
          row.isUtensilio && { label: 'Utens', icon: Wrench },
          row.controlaEstoque && { label: 'Estq', icon: BarChart3 },
          row.enviaProducao && { label: 'Prod', icon: Factory },
          row.isInsumo && { label: 'Ins', icon: Wheat },
          row.isBalanca && { label: 'Bal', icon: Scale },
          row.participaCotacao && { label: 'Cot', icon: ShoppingCart },
        ].filter(Boolean) as { label: string; icon: any }[]

        if (flags.length === 0) return <span className="text-muted-foreground/30 text-xs">-</span>

        return (
          <div className="flex flex-wrap gap-1">
            {flags.map((f) => (
              <span
                key={f.label}
                className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-muted/40 text-muted-foreground/70 border border-border/30"
                title={f.label}
              >
                <f.icon className="h-2.5 w-2.5" />
                {f.label}
              </span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row: Product) => (
        <Badge variant={row.status === 'ativo' ? 'success' : 'secondary'}>
          {row.status === 'ativo' ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row: Product) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground/50 hover:text-foreground"
          onClick={() => openEdit(row)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={products}
        total={total}
        page={page}
        limit={limit}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={isLoading}
        searchPlaceholder="Buscar por nome, SKU, codigo..."
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        actions={
          <div className="flex items-center gap-2">
            <Select value={filterCategoria} onValueChange={(v) => { setFilterCategoria(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-[150px] sm:w-[170px] h-9 text-sm">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openCreate} className="gap-1.5 h-9 shadow-warm">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Novo Produto</span>
            </Button>
          </div>
        }
      />

      {/* ====== Modal Criar/Editar Produto ====== */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Atualize as informacoes do produto' : 'Preencha os dados do novo produto'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Nome */}
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Nome *</label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Nome do produto"
                className="h-11"
              />
            </div>

            {/* Categoria + Subcategoria */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Categoria</label>
                <Select value={formCategoriaId || 'none'} onValueChange={(v) => { setFormCategoriaId(v === 'none' ? '' : v); setFormSubcategoriaId('') }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Subcategoria</label>
                <Select
                  value={formSubcategoriaId || 'none'}
                  onValueChange={(v) => setFormSubcategoriaId(v === 'none' ? '' : v)}
                  disabled={!formCategoriaId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formCategoriaId ? 'Selecione' : 'Selecione categoria primeiro'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {subcategories.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Un. medida + SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Unidade de medida</label>
                <Select value={formUnidadeMedida} onValueChange={setFormUnidadeMedida}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unidadesMedida.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-1.5 block">SKU (opcional)</label>
                <Input value={formSku} onChange={(e) => setFormSku(e.target.value)} placeholder="Codigo interno" />
              </div>
            </div>

            {/* Codigos */}
            <div>
              <label className="text-sm font-medium text-foreground/80 mb-2 block">Codigos de integracao</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  value={formCodigoSistema}
                  onChange={(e) => setFormCodigoSistema(e.target.value)}
                  placeholder="Cod. Sistema"
                />
                <Input
                  value={formCodigoBarras}
                  onChange={(e) => setFormCodigoBarras(e.target.value)}
                  placeholder="Cod. Barras (EAN)"
                />
              </div>
            </div>

            {/* Cotacao */}
            <div className="rounded-xl border border-border/40 p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 flex items-center justify-center">
                    <ShoppingCart className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Participa de cotacao</p>
                    <p className="text-[11px] text-muted-foreground/50">Ativar se o produto participa de cotacao de compras</p>
                  </div>
                </div>
                <Switch checked={formParticipaCotacao} onCheckedChange={setFormParticipaCotacao} />
              </div>
              {formParticipaCotacao && (
                <div className="mt-3 pl-11">
                  <Input
                    value={formCodigoCotacao}
                    onChange={(e) => setFormCodigoCotacao(e.target.value)}
                    placeholder="Codigo de cotacao (opcional)"
                    className="max-w-xs"
                  />
                </div>
              )}
            </div>

            {/* Balanca */}
            <div className="rounded-xl border border-border/40 p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                    <Scale className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Produto de balanca</p>
                    <p className="text-[11px] text-muted-foreground/50">Ativar se o produto e pesado em balanca</p>
                  </div>
                </div>
                <Switch checked={formIsBalanca} onCheckedChange={setFormIsBalanca} />
              </div>
              {formIsBalanca && (
                <div className="mt-3 pl-11">
                  <Input
                    value={formCodigoBalanca}
                    onChange={(e) => setFormCodigoBalanca(e.target.value)}
                    placeholder="Codigo da balanca"
                    className="max-w-xs"
                  />
                </div>
              )}
            </div>

            {/* Configuracoes / Flags */}
            <div className="rounded-xl border border-border/40 p-4 bg-muted/20">
              <p className="text-sm font-medium mb-3">Configuracoes do produto</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ConfigSwitch
                  icon={Tag}
                  iconBg="bg-purple-50 dark:bg-purple-900/20"
                  iconColor="text-purple-600 dark:text-purple-400"
                  label="Gera etiqueta"
                  checked={formIsEtiqueta}
                  onChange={setFormIsEtiqueta}
                />
                {formIsEtiqueta && (
                  <div className="flex items-center gap-2 sm:col-span-2 pl-1">
                    <label className="text-[13px] font-semibold text-muted-foreground whitespace-nowrap">Dias de validade:</label>
                    <input
                      type="number"
                      min="1"
                      value={formValidadeDias}
                      onChange={(e) => setFormValidadeDias(e.target.value)}
                      placeholder="Ex: 3"
                      className="w-24 px-3 py-1.5 rounded-lg border border-border/70 bg-card text-sm font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    />
                    <span className="text-[11px] text-muted-foreground/50">dias (contando o dia da producao)</span>
                  </div>
                )}
                <ConfigSwitch
                  icon={Wrench}
                  iconBg="bg-orange-50 dark:bg-orange-900/20"
                  iconColor="text-orange-600 dark:text-orange-400"
                  label="E utensilio"
                  checked={formIsUtensilio}
                  onChange={setFormIsUtensilio}
                />
                <ConfigSwitch
                  icon={BarChart3}
                  iconBg="bg-emerald-50 dark:bg-emerald-900/20"
                  iconColor="text-emerald-600 dark:text-emerald-400"
                  label="Controla estoque"
                  checked={formControlaEstoque}
                  onChange={setFormControlaEstoque}
                />
                <ConfigSwitch
                  icon={Factory}
                  iconBg="bg-sky-50 dark:bg-sky-900/20"
                  iconColor="text-sky-600 dark:text-sky-400"
                  label="Envia para producao"
                  checked={formEnviaProducao}
                  onChange={setFormEnviaProducao}
                />
                <ConfigSwitch
                  icon={Wheat}
                  iconBg="bg-amber-50 dark:bg-amber-900/20"
                  iconColor="text-amber-600 dark:text-amber-400"
                  label="E insumo"
                  checked={formIsInsumo}
                  onChange={setFormIsInsumo}
                />
              </div>
            </div>

            {/* Estoque minimo + Custo medio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Estoque minimo</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formEstoqueMinimo}
                  onChange={(e) => setFormEstoqueMinimo(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Custo medio (R$)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formCustoMedio}
                  onChange={(e) => setFormCustoMedio(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingProduct ? 'Salvar alteracoes' : 'Criar produto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Modal Detalhe ====== */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Produto</DialogTitle>
            <DialogDescription>Informacoes completas do produto</DialogDescription>
          </DialogHeader>
          {detailProduct && (
            <div className="space-y-4">
              {/* Product header */}
              <div className="flex items-center gap-3 pb-3 border-b border-border/40">
                <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                  <Package className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">{detailProduct.nome}</h3>
                  <p className="text-xs text-muted-foreground/50">
                    {detailProduct.categoria?.nome || 'Sem categoria'}
                    {detailProduct.subcategoria ? ` / ${detailProduct.subcategoria.nome}` : ''}
                  </p>
                </div>
                <Badge variant={detailProduct.status === 'ativo' ? 'success' : 'secondary'}>
                  {detailProduct.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <DetailField label="SKU" value={detailProduct.sku} />
                <DetailField label="Un. Medida" value={detailProduct.unidadeMedida} />
                <DetailField label="Cod. Sistema" value={detailProduct.codigoSistema} />
                <DetailField label="Cod. Barras" value={detailProduct.codigoBarras} />
                {detailProduct.participaCotacao && (
                  <DetailField label="Cod. Cotacao" value={detailProduct.codigoCotacao} />
                )}
                {detailProduct.isBalanca && (
                  <DetailField label="Cod. Balanca" value={detailProduct.codigoBalanca} />
                )}
              </div>

              {/* Flags */}
              <div className="border-t border-border/40 pt-3">
                <p className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider mb-2">Configuracoes</p>
                <div className="flex flex-wrap gap-1.5">
                  {detailProduct.isEtiqueta && <Badge variant="info">Gera etiqueta{detailProduct.validadeDias ? ` (${detailProduct.validadeDias}d)` : ''}</Badge>}
                  {detailProduct.isUtensilio && <Badge variant="warning">E utensilio</Badge>}
                  {detailProduct.controlaEstoque && <Badge variant="success">Controla estoque</Badge>}
                  {detailProduct.enviaProducao && <Badge variant="info">Envia producao</Badge>}
                  {detailProduct.isInsumo && <Badge variant="warning">E insumo</Badge>}
                  {detailProduct.isBalanca && <Badge variant="default">Balanca</Badge>}
                  {detailProduct.participaCotacao && <Badge variant="info">Cotacao</Badge>}
                  {!detailProduct.isEtiqueta && !detailProduct.isUtensilio && !detailProduct.controlaEstoque &&
                   !detailProduct.enviaProducao && !detailProduct.isInsumo && !detailProduct.isBalanca && !detailProduct.participaCotacao && (
                    <span className="text-xs text-muted-foreground/40">Nenhuma configuracao ativa</span>
                  )}
                </div>
              </div>

              {/* Values */}
              <div className="border-t border-border/40 pt-3 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-muted/30 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider">Estoque min.</p>
                  <p className="text-lg font-bold mt-0.5">{detailProduct.estoqueMinimo}</p>
                </div>
                <div className="rounded-xl bg-muted/30 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider">Custo medio</p>
                  <p className="text-lg font-bold mt-0.5">R$ {detailProduct.custoMedio.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {detailProduct && (
              <div className="flex gap-2 w-full justify-between">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja remover este produto?')) {
                      deleteMutation.mutate(detailProduct.id)
                      setDetailOpen(false)
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      statusMutation.mutate({
                        id: detailProduct.id,
                        status: detailProduct.status === 'ativo' ? 'inativo' : 'ativo',
                      })
                      setDetailOpen(false)
                    }}
                  >
                    {detailProduct.status === 'ativo' ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => { setDetailOpen(false); openEdit(detailProduct) }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                </div>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================
// Helper components
// ============================================

function ConfigSwitch({ icon: Icon, iconBg, iconColor, label, checked, onChange }: {
  icon: any; iconBg: string; iconColor: string; label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className={`h-7 w-7 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
        <span className="text-sm">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground/50 uppercase tracking-wider">{label}</p>
      <p className="font-medium text-sm mt-0.5">{value || '-'}</p>
    </div>
  )
}

// ============================================
// Tab: Categorias
// ============================================

function CategoriesTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const limit = 20

  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [catNome, setCatNome] = useState('')

  const [subModalOpen, setSubModalOpen] = useState(false)
  const [editingSub, setEditingSub] = useState<Subcategory | null>(null)
  const [subNome, setSubNome] = useState('')
  const [subParentId, setSubParentId] = useState('')

  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())

  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ['categories', page, search],
    queryFn: () => api.get('/categories', { page, limit, search: search || undefined }),
  })

  const categories: Category[] = categoriesData?.data || []
  const total = categoriesData?.total || 0
  const totalPages = categoriesData?.totalPages || 1

  const createCatMutation = useMutation({
    mutationFn: (data: any) => api.post('/categories', data),
    onSuccess: () => {
      toast.success('Categoria criada com sucesso')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories-all'] })
      closeCatModal()
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao criar categoria'),
  })

  const updateCatMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/categories/${id}`, data),
    onSuccess: () => {
      toast.success('Categoria atualizada')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories-all'] })
      closeCatModal()
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar categoria'),
  })

  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast.success('Categoria removida')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories-all'] })
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao remover categoria'),
  })

  const createSubMutation = useMutation({
    mutationFn: ({ catId, data }: { catId: string; data: any }) =>
      api.post(`/categories/${catId}/subcategories`, data),
    onSuccess: () => {
      toast.success('Subcategoria criada')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories-all'] })
      closeSubModal()
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao criar subcategoria'),
  })

  const updateSubMutation = useMutation({
    mutationFn: ({ catId, subId, data }: { catId: string; subId: string; data: any }) =>
      api.put(`/categories/${catId}/subcategories/${subId}`, data),
    onSuccess: () => {
      toast.success('Subcategoria atualizada')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories-all'] })
      closeSubModal()
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar subcategoria'),
  })

  const deleteSubMutation = useMutation({
    mutationFn: ({ catId, subId }: { catId: string; subId: string }) =>
      api.delete(`/categories/${catId}/subcategories/${subId}`),
    onSuccess: () => {
      toast.success('Subcategoria removida')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories-all'] })
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao remover subcategoria'),
  })

  function toggleExpand(catId: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      return next
    })
  }

  function openCreateCat() { setEditingCat(null); setCatNome(''); setCatModalOpen(true) }
  function openEditCat(cat: Category) { setEditingCat(cat); setCatNome(cat.nome); setCatModalOpen(true) }
  function closeCatModal() { setCatModalOpen(false); setEditingCat(null); setCatNome('') }

  function handleCatSubmit() {
    if (!catNome.trim()) { toast.error('Nome e obrigatorio'); return }
    if (editingCat) updateCatMutation.mutate({ id: editingCat.id, data: { nome: catNome.trim() } })
    else createCatMutation.mutate({ nome: catNome.trim() })
  }

  function openCreateSub(catId: string) { setEditingSub(null); setSubNome(''); setSubParentId(catId); setSubModalOpen(true) }
  function openEditSub(catId: string, sub: Subcategory) { setEditingSub(sub); setSubNome(sub.nome); setSubParentId(catId); setSubModalOpen(true) }
  function closeSubModal() { setSubModalOpen(false); setEditingSub(null); setSubNome(''); setSubParentId('') }

  function handleSubSubmit() {
    if (!subNome.trim()) { toast.error('Nome e obrigatorio'); return }
    if (editingSub) updateSubMutation.mutate({ catId: subParentId, subId: editingSub.id, data: { nome: subNome.trim() } })
    else createSubMutation.mutate({ catId: subParentId, data: { nome: subNome.trim() } })
  }

  const isCatSaving = createCatMutation.isPending || updateCatMutation.isPending
  const isSubSaving = createSubMutation.isPending || updateSubMutation.isPending

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 sm:max-w-sm group">
          <input
            type="text"
            placeholder="Buscar categorias..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-4 pr-4 py-2.5 sm:py-2 rounded-xl border border-border/70 bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all duration-200 shadow-warm-sm hover:border-border placeholder:text-muted-foreground/40"
          />
        </div>
        <Button onClick={openCreateCat} className="gap-1.5 h-9 shadow-warm">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova Categoria</span>
        </Button>
      </div>

      {/* Categories list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
        </div>
      ) : categories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
              <FolderTree className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground/70">Nenhuma categoria encontrada</p>
            <p className="text-xs text-muted-foreground/40 mt-1">Crie a primeira categoria para organizar seus produtos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => {
            const isExpanded = expandedCats.has(cat.id)
            return (
              <div key={cat.id} className="rounded-2xl border border-border/50 overflow-hidden bg-card shadow-warm-sm transition-shadow hover:shadow-warm">
                {/* Category row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleExpand(cat.id)}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors touch-manipulation"
                  >
                    <ChevronRight className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                  <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                    <FolderTree className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{cat.nome}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground/50">
                        {cat._count.products} produto{cat._count.products !== 1 ? 's' : ''}
                      </span>
                      {cat.subcategories.length > 0 && (
                        <>
                          <span className="text-muted-foreground/20">|</span>
                          <span className="text-[11px] text-muted-foreground/50">
                            {cat.subcategories.length} subcategoria{cat.subcategories.length !== 1 ? 's' : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-primary" onClick={() => openCreateSub(cat.id)} title="Nova subcategoria">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/40 hover:text-foreground" onClick={() => openEditCat(cat)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground/40 hover:text-destructive"
                      onClick={() => { if (confirm(`Remover categoria "${cat.nome}"?`)) deleteCatMutation.mutate(cat.id) }}
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Subcategories */}
                {isExpanded && cat.subcategories.length > 0 && (
                  <div className="border-t border-border/30 bg-muted/10">
                    {cat.subcategories.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-3 px-4 pl-16 py-2.5 border-b border-border/20 last:border-b-0 hover:bg-muted/20 transition-colors">
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
                        <span className="text-sm flex-1">{sub.nome}</span>
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground/40 hover:text-foreground" onClick={() => openEditSub(cat.id, sub)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground/40 hover:text-destructive"
                            onClick={() => { if (confirm(`Remover subcategoria "${sub.nome}"?`)) deleteSubMutation.mutate({ catId: cat.id, subId: sub.id }) }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isExpanded && cat.subcategories.length === 0 && (
                  <div className="border-t border-border/30 bg-muted/10 px-4 pl-16 py-4 text-sm text-muted-foreground/40">
                    Nenhuma subcategoria.{' '}
                    <button onClick={() => openCreateSub(cat.id)} className="text-primary hover:underline font-medium">
                      Criar uma
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 px-1">
              <span className="text-xs text-muted-foreground/50 tabular-nums">
                {total} categoria{total !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground/50 tabular-nums px-2">
                  {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Proximo
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Categoria */}
      <Dialog open={catModalOpen} onOpenChange={(open) => !open && closeCatModal()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
            <DialogDescription>
              {editingCat ? 'Atualize o nome da categoria' : 'Informe o nome da nova categoria'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-1">
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Nome *</label>
            <Input
              value={catNome}
              onChange={(e) => setCatNome(e.target.value)}
              placeholder="Nome da categoria"
              className="h-11"
              onKeyDown={(e) => e.key === 'Enter' && handleCatSubmit()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCatModal}>Cancelar</Button>
            <Button onClick={handleCatSubmit} disabled={isCatSaving}>
              {isCatSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingCat ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Subcategoria */}
      <Dialog open={subModalOpen} onOpenChange={(open) => !open && closeSubModal()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingSub ? 'Editar Subcategoria' : 'Nova Subcategoria'}</DialogTitle>
            <DialogDescription>
              {editingSub ? 'Atualize o nome da subcategoria' : 'Informe o nome da nova subcategoria'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-1">
            <label className="text-sm font-medium text-foreground/80 mb-1.5 block">Nome *</label>
            <Input
              value={subNome}
              onChange={(e) => setSubNome(e.target.value)}
              placeholder="Nome da subcategoria"
              className="h-11"
              onKeyDown={(e) => e.key === 'Enter' && handleSubSubmit()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeSubModal}>Cancelar</Button>
            <Button onClick={handleSubSubmit} disabled={isSubSaving}>
              {isSubSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingSub ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
