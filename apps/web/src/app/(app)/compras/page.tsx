'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Loader2, ShoppingCart, Package, BarChart3, Search, X, ChevronDown, Check, Trash2, Clock, Download } from 'lucide-react'

// Tipos
interface PurchaseCycle {
  id: string
  titulo: string
  dataAbertura: string
  dataFechamento: string | null
  status: 'aberto' | 'fechado' | 'reaberto' | 'consolidado'
  createdAt: string
}

interface CyclesResponse {
  data: PurchaseCycle[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface Product {
  id: string
  nome: string
  unidadeMedida: string
}

interface RequestItem {
  id: string
  produtoId: string
  produtoNome: string
  quantidade: number
  unidadeMedida: string
  unidadeNome: string
  observacao: string
}

interface Unit {
  id: string
  nome: string
  codigo: string
}

interface ConsolidationItem {
  product: {
    id: string
    nome: string
    sku: string
    unidadeMedida: string
    codigoCotacao: string | null
  }
  totalQuantidade: number
  unidades: {
    unit: Unit
    quantidade: number
    solicitacoes: number
  }[]
}

// Mapa de cores para status dos ciclos
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  aberto: { label: 'Aberto', variant: 'default' },
  reaberto: { label: 'Reaberto', variant: 'default' },
  fechado: { label: 'Fechado', variant: 'secondary' },
  consolidado: { label: 'Consolidado', variant: 'outline' },
}

export default function ComprasPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('ciclos')

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-warm-sm">
          <ShoppingCart className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Compras</h1>
          <p className="text-xs sm:text-sm text-muted-foreground/50">Ciclos de compras e consolidacao</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ciclos" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Ciclos
          </TabsTrigger>
          <TabsTrigger value="requisicoes" className="gap-2">
            <Package className="h-4 w-4" />
            Requisicoes
          </TabsTrigger>
          <TabsTrigger value="consolidacao" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Consolidacao
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ciclos">
          <CiclosTab />
        </TabsContent>
        <TabsContent value="requisicoes">
          <RequisicoesTab />
        </TabsContent>
        <TabsContent value="consolidacao">
          <ConsolidacaoTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ===== ABA CICLOS =====
function CiclosTab() {
  const queryClient = useQueryClient()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [formTitulo, setFormTitulo] = useState('')
  const [formDataFechamento, setFormDataFechamento] = useState('')

  // Buscar ciclos
  const { data: cyclesData, isLoading } = useQuery<CyclesResponse>({
    queryKey: ['purchase-cycles'],
    queryFn: () => api.get('/purchase-cycles'),
  })

  // Criar ciclo
  const createMutation = useMutation({
    mutationFn: (data: { titulo: string; dataFechamento?: string }) =>
      api.post('/purchase-cycles', data),
    onSuccess: () => {
      toast.success('Ciclo de compras criado com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['purchase-cycles'] })
      setCreateModalOpen(false)
      setFormTitulo('')
      setFormDataFechamento('')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar ciclo')
    },
  })

  // Alterar status do ciclo (fechar, reabrir)
  const changeStatusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.patch(`/purchase-cycles/${id}/status`, { action }),
    onSuccess: (_data, variables) => {
      const actionLabels: Record<string, string> = {
        fechar: 'Ciclo fechado',
        reabrir: 'Ciclo reaberto',
        consolidar: 'Ciclo consolidado',
      }
      toast.success(actionLabels[variables.action] || 'Status atualizado!')
      queryClient.invalidateQueries({ queryKey: ['purchase-cycles'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao alterar status do ciclo')
    },
  })

  // Excluir ciclo
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/purchase-cycles/${id}`),
    onSuccess: () => {
      toast.success('Ciclo excluido com sucesso!')
      queryClient.invalidateQueries({ queryKey: ['purchase-cycles'] })
      setDeleteConfirmId(null)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir ciclo')
    },
  })

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: { titulo: string; dataFechamento?: string } = { titulo: formTitulo }
    if (formDataFechamento) {
      payload.dataFechamento = new Date(formDataFechamento).toISOString()
    }
    createMutation.mutate(payload)
  }

  // Formatar data para exibicao
  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('pt-BR')
  }

  // Calcular tempo restante ate fechamento automatico
  function getAutoCloseInfo(dateStr: string | null, status: string) {
    if (!dateStr || (status !== 'aberto' && status !== 'reaberto')) return null
    const fechamento = new Date(dateStr)
    const now = new Date()
    const diff = fechamento.getTime() - now.getTime()
    if (diff <= 0) return { text: 'Fechamento automatico pendente', urgent: true }
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24))
    const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    if (dias > 0) return { text: `Fecha automaticamente em ${dias}d ${horas}h`, urgent: dias <= 1 }
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return { text: `Fecha automaticamente em ${horas}h ${minutos}min`, urgent: true }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {hasPermission('compras', 'criar_ciclo') && (
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Ciclo
          </Button>
        )}
      </div>

      {/* Lista de ciclos */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(cyclesData?.data || []).length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhum ciclo de compras encontrado
              </CardContent>
            </Card>
          )}
          {(cyclesData?.data || []).map((cycle) => {
            const autoClose = getAutoCloseInfo(cycle.dataFechamento, cycle.status)
            return (
              <Card key={cycle.id}>
                <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{cycle.titulo}</h3>
                      <Badge variant={STATUS_CONFIG[cycle.status]?.variant || 'outline'}>
                        {STATUS_CONFIG[cycle.status]?.label || cycle.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Aberto em {formatDate(cycle.dataAbertura)}
                      {cycle.dataFechamento && ` — Fechamento: ${formatDate(cycle.dataFechamento)}`}
                    </p>
                    {autoClose && (
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${autoClose.urgent ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                        <Clock className="h-3.5 w-3.5" />
                        {autoClose.text}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Botoes conforme status e permissao */}
                    {(cycle.status === 'aberto' || cycle.status === 'reaberto') && hasPermission('compras', 'fechar_ciclo') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => changeStatusMutation.mutate({ id: cycle.id, action: 'fechar' })}
                        disabled={changeStatusMutation.isPending}
                      >
                        Fechar Ciclo
                      </Button>
                    )}
                    {cycle.status === 'fechado' && (
                      <>
                        {hasPermission('compras', 'reabrir_ciclo') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => changeStatusMutation.mutate({ id: cycle.id, action: 'reabrir' })}
                            disabled={changeStatusMutation.isPending}
                          >
                            Reabrir
                          </Button>
                        )}
                        {hasPermission('compras', 'consolidar') && (
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => changeStatusMutation.mutate({ id: cycle.id, action: 'consolidar' })}
                            disabled={changeStatusMutation.isPending}
                          >
                            Consolidar
                          </Button>
                        )}
                      </>
                    )}
                    {cycle.status === 'consolidado' && (
                      <span className="text-sm text-muted-foreground">Ciclo finalizado</span>
                    )}
                    {/* Excluir - nao permite em consolidados */}
                    {cycle.status !== 'consolidado' && hasPermission('compras', 'excluir_ciclo') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => setDeleteConfirmId(cycle.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal criar ciclo */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Ciclo de Compras</DialogTitle>
            <DialogDescription>Defina o titulo e a data de fechamento do ciclo.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Titulo</label>
              <input
                type="text"
                required
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
                placeholder="Ex: Semana 12/2026"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Data de Fechamento Automatico (opcional)</label>
              <p className="text-xs text-muted-foreground">O ciclo sera fechado automaticamente as 23:59 desta data</p>
              <input
                type="date"
                value={formDataFechamento}
                onChange={(e) => setFormDataFechamento(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Ciclo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal confirmar exclusao */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Ciclo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este ciclo? Todas as requisicoes vinculadas serao removidas. Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===== COMBOBOX DE PRODUTO COM BUSCA =====
function ProductCombobox({
  products,
  value,
  onChange,
}: {
  products: Product[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedProduct = products.find((p) => p.id === value)

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const term = search.toLowerCase()
    return products.filter((p) => p.nome.toLowerCase().includes(term))
  }, [products, search])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch('') }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border bg-background text-sm transition-all duration-200 outline-none ${
          open
            ? 'border-amber-500 ring-2 ring-amber-500/20'
            : 'border-border hover:border-border/80'
        }`}
      >
        <span className={selectedProduct ? 'text-foreground' : 'text-muted-foreground/50'}>
          {selectedProduct ? `${selectedProduct.nome} (${selectedProduct.unidadeMedida})` : 'Selecione o produto...'}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange(''); setSearch('') }}
              className="p-0.5 rounded-md hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground/50" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 rounded-xl border border-border bg-card shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="p-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-border/50 bg-muted/30 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 outline-none transition-all placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground/50">
                Nenhum produto encontrado
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onChange(p.id); setOpen(false); setSearch('') }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
                    p.id === value
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="h-7 w-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                    <Package className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{p.nome}</span>
                    <span className="text-[11px] text-muted-foreground/50">{p.unidadeMedida}</span>
                  </div>
                  {p.id === value && <Check className="h-4 w-4 text-amber-600 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== ABA REQUISICOES =====
function RequisicoesTab() {
  const queryClient = useQueryClient()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const [selectedCycleId, setSelectedCycleId] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const quantidadeRef = useRef<HTMLInputElement>(null)

  // Buscar ciclos abertos para selecao
  const { data: cyclesData } = useQuery<CyclesResponse>({
    queryKey: ['purchase-cycles'],
    queryFn: () => api.get('/purchase-cycles'),
  })

  // Buscar produtos disponiveis (apenas os que participam de cotacao)
  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['products', 'cotacao'],
    queryFn: () => api.get('/products', { limit: 100, participaCotacao: true }),
  })

  // Buscar requisicoes do ciclo selecionado
  const { data: requestsData, isLoading: loadingRequests } = useQuery<{ data: RequestItem[] }>({
    queryKey: ['purchase-cycles', selectedCycleId, 'requests'],
    queryFn: () => api.get(`/purchase-cycles/${selectedCycleId}/requests`),
    enabled: !!selectedCycleId,
  })

  // Adicionar produto ao ciclo
  const addRequestMutation = useMutation({
    mutationFn: (data: { productId: string; quantidade: number; observacao: string }) =>
      api.post(`/purchase-cycles/${selectedCycleId}/requests`, data),
    onSuccess: () => {
      toast.success('Produto adicionado a requisicao!')
      queryClient.invalidateQueries({ queryKey: ['purchase-cycles', selectedCycleId, 'requests'] })
      setProdutoId('')
      setQuantidade('')
      setObservacao('')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao adicionar produto')
    },
  })

  // Filtrar apenas ciclos abertos
  const openCycles = (cyclesData?.data || []).filter((c) => c.status === 'aberto' || c.status === 'reaberto')
  const products = productsData?.data || []
  const requests = requestsData?.data || []

  function handleAddProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCycleId || !produtoId || !quantidade) return
    addRequestMutation.mutate({
      productId: produtoId,
      quantidade: parseFloat(quantidade),
      observacao,
    })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Selecao do ciclo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base">Selecione o Ciclo Aberto</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
          >
            <option value="">Selecione um ciclo...</option>
            {openCycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.titulo}
              </option>
            ))}
          </select>
          {openCycles.length === 0 && (
            <p className="text-sm text-muted-foreground mt-3">
              Nenhum ciclo aberto disponivel. Crie um novo ciclo na aba Ciclos.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Formulario para adicionar produto */}
      {selectedCycleId && hasPermission('compras', 'criar_pedido') && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base">Adicionar Produto</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddProduct} className="space-y-3">
              {/* Produto - combobox com busca */}
              <ProductCombobox products={products} value={produtoId} onChange={setProdutoId} />

              {/* Quantidade + Observacao + Botao */}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  ref={quantidadeRef}
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="Quantidade"
                  className="w-full sm:w-32 px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-muted-foreground/50"
                />
                <input
                  type="text"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Observacao (opcional)"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-muted-foreground/50"
                />
                <Button
                  type="submit"
                  disabled={addRequestMutation.isPending || !produtoId || !quantidade}
                  className="bg-amber-600 hover:bg-amber-700 text-white h-10 sm:h-auto px-5 rounded-xl gap-2"
                >
                  {addRequestMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span className="sm:hidden">Adicionar</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de requisicoes do ciclo */}
      {selectedCycleId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base">Itens da Requisicao</CardTitle>
              {requests.length > 0 && (
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {requests.length} {requests.length === 1 ? 'item' : 'itens'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingRequests ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="py-10 text-center">
                <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Package className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-sm text-muted-foreground/60">Nenhum item adicionado a este ciclo</p>
                <p className="text-xs text-muted-foreground/40 mt-1">Use o formulario acima para adicionar produtos</p>
              </div>
            ) : (
              <>
                {/* Desktop: tabela */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-3 py-2.5 text-left font-medium text-muted-foreground/70 text-xs uppercase tracking-wider">Produto</th>
                        <th className="px-3 py-2.5 text-left font-medium text-muted-foreground/70 text-xs uppercase tracking-wider">Unidade</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground/70 text-xs uppercase tracking-wider">Qtd</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground/70 text-xs uppercase tracking-wider">Medida</th>
                        <th className="px-3 py-2.5 text-left font-medium text-muted-foreground/70 text-xs uppercase tracking-wider">Obs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((item) => (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-2.5 font-medium">{item.produtoNome}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{item.unidadeNome}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{item.quantidade}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{item.unidadeMedida}</td>
                          <td className="px-3 py-2.5 text-muted-foreground/70">{item.observacao || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: cards */}
                <div className="sm:hidden space-y-2">
                  {requests.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/50 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{item.produtoNome}</span>
                        <span className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                          {item.quantidade} {item.unidadeMedida}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground/60">
                        <span>{item.unidadeNome}</span>
                        {item.observacao && <span className="truncate ml-2 max-w-[50%] text-right">{item.observacao}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ===== ABA CONSOLIDACAO =====
function ConsolidacaoTab() {
  const [selectedCycleId, setSelectedCycleId] = useState('')

  // Buscar ciclos fechados/consolidados para selecao
  const { data: cyclesData } = useQuery<CyclesResponse>({
    queryKey: ['purchase-cycles'],
    queryFn: () => api.get('/purchase-cycles'),
  })

  // Buscar todas as unidades para montar as colunas da matriz
  const { data: unitsData } = useQuery<{ data: Unit[] }>({
    queryKey: ['units-all'],
    queryFn: () => api.get('/units', { limit: 100, status: 'ativo' }),
  })

  // Buscar consolidacao do ciclo selecionado (sem paginacao - limite alto)
  const { data: consolidationData, isLoading: loadingConsolidation } = useQuery<{ data: ConsolidationItem[] }>({
    queryKey: ['purchase-cycles', selectedCycleId, 'consolidation'],
    queryFn: () => api.get(`/purchase-cycles/${selectedCycleId}/consolidation`, { limit: 500 }),
    enabled: !!selectedCycleId,
  })

  // Ciclos fechados ou consolidados
  const closedCycles = (cyclesData?.data || []).filter(
    (c) => c.status === 'fechado' || c.status === 'consolidado'
  )

  const units = unitsData?.data || []
  const items = consolidationData?.data || []

  // Helper: quantidade de uma unidade para um item
  function getQtd(item: ConsolidationItem, unitId: string): number {
    return item.unidades.find((u) => u.unit.id === unitId)?.quantidade ?? 0
  }

  // Exportar CSV no formato da planilha modelo
  function handleExport() {
    const header = 'Código Club Cotação;Nome Produto;Tip Emb.;Qtd Emb;Estoque;Estoq. Sug.;Sugestão;Pedido;Obs.;Obs.;Obs.'
    const rows = items.map((item) => {
      const codigo = item.product.codigoCotacao || ''
      const nome = item.product.nome
      const tipEmb = item.product.unidadeMedida.toUpperCase()
      return `${codigo};${nome};${tipEmb};1; ; ; ;1;;;`
    })
    const csv = [header, ...rows].join('\r\n')
    // BOM para compatibilidade com Excel brasileiro
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const cicloTitulo = closedCycles.find((c) => c.id === selectedCycleId)?.titulo || 'consolidacao'
    a.download = `${cicloTitulo.replace(/[^a-zA-Z0-9]/g, '_')}_cotacao.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Selecao do ciclo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecione o Ciclo para Consolidacao</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            className="w-full max-w-md px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
          >
            <option value="">Selecione um ciclo...</option>
            {closedCycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.titulo} ({STATUS_CONFIG[cycle.status]?.label || cycle.status})
              </option>
            ))}
          </select>
          {closedCycles.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              Nenhum ciclo fechado disponivel para consolidacao.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tabela matriz: linhas = produtos, colunas = unidades */}
      {selectedCycleId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Consolidacao por Unidade</CardTitle>
              {items.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExport}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exportar Planilha
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingConsolidation ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum dado de consolidacao encontrado
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider border border-border/60 whitespace-nowrap">
                        Produto
                      </th>
                      <th className="px-3 py-2.5 text-center font-medium text-muted-foreground text-xs uppercase tracking-wider border border-border/60 whitespace-nowrap">
                        Und.
                      </th>
                      {units.map((unit) => (
                        <th
                          key={unit.id}
                          className="px-3 py-2.5 text-center font-medium text-muted-foreground text-xs uppercase tracking-wider border border-border/60 whitespace-nowrap"
                        >
                          {unit.nome}
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-center font-semibold text-amber-700 dark:text-amber-400 text-xs uppercase tracking-wider border border-border/60 whitespace-nowrap bg-amber-50 dark:bg-amber-900/20">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr
                        key={item.product.id}
                        className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                      >
                        <td className="px-3 py-2 font-medium border border-border/60 whitespace-nowrap">
                          {item.product.nome}
                          {item.product.codigoCotacao && (
                            <span className="ml-2 text-xs text-muted-foreground/60 font-normal">
                              #{item.product.codigoCotacao}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground border border-border/60 uppercase">
                          {item.product.unidadeMedida}
                        </td>
                        {units.map((unit) => {
                          const qtd = getQtd(item, unit.id)
                          return (
                            <td
                              key={unit.id}
                              className={`px-3 py-2 text-center border border-border/60 tabular-nums ${
                                qtd > 0 ? 'font-semibold' : 'text-muted-foreground/30'
                              }`}
                            >
                              {qtd > 0 ? qtd : '—'}
                            </td>
                          )
                        })}
                        <td className="px-3 py-2 text-center font-bold tabular-nums border border-border/60 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                          {item.totalQuantidade}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
