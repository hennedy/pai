'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { SmartEmptyState } from '@/components/ui/smart-empty-state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Trash2,
  Plus,
  X,
  Loader2,
  Calendar,
  User,
  ChevronDown,
  ChevronRight,
  Eye,
  AlertTriangle,
  Scale,
  ScanLine,
  Weight,
  ArrowRightLeft,
  Building2,
  Camera,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { parseCodigoBalanca } from '@/components/balanca-scanner'

const BalancaScanner = dynamic(
  () => import('@/components/balanca-scanner').then((m) => ({ default: m.BalancaScanner })),
  { ssr: false },
)

// ============================================================
// Utilitarios
// ============================================================

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return (
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

function formatRelativeDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min atras`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h atras`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d atras`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// ============================================================
// Tipos
// ============================================================

interface TransferenciaItem {
  productId: string
  nome: string
  peso: number
  codigoBalanca: string
}

interface Unit {
  id: string
  nome: string
  codigo: string
}

// ============================================================
// Pagina principal
// ============================================================

export default function TransferenciasPage() {
  const { selectedUnitId, hasPermission } = useAuthStore()
  const queryClient = useQueryClient()

  const canVisualizar = hasPermission('transferencias', 'visualizar')
  const canContagem = hasPermission('transferencias', 'contagem')

  // Lista
  const [page, setPage] = useState(1)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  // Modal nova transferencia
  const [modalOpen, setModalOpen] = useState(false)
  const [origemUnitId, setOrigemUnitId] = useState('')
  const [destinoUnitId, setDestinoUnitId] = useState('')
  const [modalObs, setModalObs] = useState('')
  const [items, setItems] = useState<TransferenciaItem[]>([])

  // Scanner
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)

  // Detalhe / delete
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ---- Queries ----

  const { data: unitsData } = useQuery({
    queryKey: ['transferencia-units'],
    queryFn: () => api.get('/transferencia-counts/units').then((r) => r.data),
  })

  const units: Unit[] = unitsData?.data ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['transferencia-counts', selectedUnitId, page],
    queryFn: () => api.get(`/transferencia-counts?page=${page}&limit=20`).then((r) => r.data),
    enabled: canVisualizar,
  })

  const { data: detailData } = useQuery({
    queryKey: ['transferencia-counts', detailId],
    queryFn: () => api.get(`/transferencia-counts/${detailId}`).then((r) => r.data),
    enabled: !!detailId,
  })

  // ---- Mutations ----

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/transferencia-counts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencia-counts'] })
      toast.success('Transferencia registrada com sucesso!')
      setModalOpen(false)
      resetModal()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Erro ao registrar transferencia')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/transferencia-counts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencia-counts'] })
      toast.success('Transferencia excluida!')
      setDeleteId(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Erro ao excluir')
    },
  })

  // ---- Helpers ----

  function resetModal() {
    setOrigemUnitId('')
    setDestinoUnitId('')
    setModalObs('')
    setItems([])
  }

  function openModal() {
    resetModal()
    setModalOpen(true)
  }

  async function handleBarcodeDetected(barcode: string) {
    setScannerOpen(false)
    setScanLoading(true)

    const parsed = parseCodigoBalanca(barcode)
    if (!parsed) {
      toast.error('Codigo invalido. Use um codigo de balanca EAN-13 (13 digitos comecando com 2).')
      setScanLoading(false)
      return
    }

    const { codigoBalanca, pesoKg } = parsed

    try {
      const res = await api.get(`/transferencia-counts/products/by-balanca/${codigoBalanca}`)
      const product = res.data

      setItems((prev) => {
        const existing = prev.findIndex((i) => i.productId === product.id)
        if (existing >= 0) {
          const next = [...prev]
          next[existing] = {
            ...next[existing],
            peso: Math.round((next[existing].peso + pesoKg) * 1000) / 1000,
          }
          toast.success(`${product.nome}: +${pesoKg.toFixed(3)} kg adicionado`)
          return next
        }
        toast.success(`${product.nome} adicionado — ${pesoKg.toFixed(3)} kg`)
        return [...prev, { productId: product.id, nome: product.nome, peso: pesoKg, codigoBalanca }]
      })
    } catch (err: any) {
      if (err?.response?.status === 404) {
        toast.error(`Produto nao encontrado para o codigo ${codigoBalanca}`)
      } else {
        toast.error('Erro ao buscar produto')
      }
    } finally {
      setScanLoading(false)
    }
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  function handleSubmit() {
    if (!origemUnitId) { toast.error('Selecione a unidade de origem'); return }
    if (!destinoUnitId) { toast.error('Selecione a unidade de destino'); return }
    if (origemUnitId === destinoUnitId) { toast.error('Origem e destino nao podem ser iguais'); return }
    if (items.length === 0) { toast.error('Adicione pelo menos um item'); return }

    createMutation.mutate({
      origemUnitId,
      destinoUnitId,
      observacao: modalObs || undefined,
      items: items.map((i) => ({ productId: i.productId, peso: i.peso })),
    })
  }

  function toggleExpand(id: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const records = data?.data ?? []
  const pagination = data?.pagination
  const pesoTotal = items.reduce((acc, i) => acc + i.peso, 0)

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Transferencias entre Unidades"
        description="Registre os itens transferidos de uma unidade para outra"
        icon={ArrowRightLeft}
        iconGradient="from-blue-500 to-blue-600"
      >
        {canContagem && (
          <Button onClick={openModal} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nova Transferencia
          </Button>
        )}
      </PageHeader>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : records.length === 0 ? (
        <SmartEmptyState
          icon={ArrowRightLeft}
          title="Nenhuma transferencia registrada"
          description="Clique em Nova Transferencia para comecar"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {records.map((record: any) => {
            const expanded = expandedCards.has(record.id)
            const totalPeso = record.items.reduce((acc: number, i: any) => acc + i.peso, 0)

            return (
              <div key={record.id} className="border rounded-xl bg-card shadow-sm overflow-hidden">
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpand(record.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 shrink-0">
                      <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm flex items-center gap-1">
                          <span className="text-muted-foreground">{record.origemUnit.codigo}</span>
                          <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{record.destinoUnit.codigo}</span>
                        </span>
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Weight className="w-3 h-3" />
                          {totalPeso.toFixed(3)} kg
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {record.items.length} {record.items.length === 1 ? 'item' : 'itens'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {record.responsavel.nome}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatRelativeDate(record.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); setDetailId(record.id) }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {canContagem && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteId(record.id) }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {expanded && (
                  <div className="border-t px-4 py-3 bg-muted/20">
                    {/* Rota */}
                    <div className="flex items-center gap-2 text-sm mb-2 pb-2 border-b">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium">{record.origemUnit.nome}</span>
                      <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium">{record.destinoUnit.nome}</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {record.items.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between text-sm py-1">
                          <span>{item.product.nome}</span>
                          <span className="font-mono text-muted-foreground">{item.peso.toFixed(3)} kg</span>
                        </div>
                      ))}
                    </div>
                    {record.observacao && (
                      <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{record.observacao}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Paginacao */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground">{page} / {pagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Proximo</Button>
        </div>
      )}

      {/* ============================================================ */}
      {/* Modal: Nova transferencia                                     */}
      {/* ============================================================ */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false) }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              Nova Transferencia
            </DialogTitle>
            <DialogDescription>
              Selecione as unidades e escaneie os itens transferidos
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto flex flex-col gap-4 py-2">
            {/* Selecao de unidades */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  Unidade de Origem
                </label>
                <select
                  value={origemUnitId}
                  onChange={(e) => setOrigemUnitId(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                >
                  <option value="">Selecionar...</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id} disabled={u.id === destinoUnitId}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  Unidade de Destino
                </label>
                <select
                  value={destinoUnitId}
                  onChange={(e) => setDestinoUnitId(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                >
                  <option value="">Selecionar...</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id} disabled={u.id === origemUnitId}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Botao escanear */}
            <Button
              variant="outline"
              className="w-full border-dashed h-12 gap-2"
              onClick={() => setScannerOpen(true)}
              disabled={scanLoading}
            >
              {scanLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              {scanLoading ? 'Buscando produto...' : 'Adicionar Item (Escanear Codigo)'}
            </Button>

            {/* Lista de itens */}
            {items.length > 0 ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
                  <span className="flex items-center gap-1">
                    <Weight className="w-3 h-3" />
                    Total: {pesoTotal.toFixed(3)} kg
                  </span>
                </div>
                {items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 bg-muted/40 rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Scale className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate font-medium">{item.nome}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-muted-foreground text-xs">{item.peso.toFixed(3)} kg</span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground text-sm gap-2">
                <Scale className="w-8 h-8 opacity-30" />
                <span>Nenhum item adicionado</span>
              </div>
            )}

            {/* Observacao */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Observacao (opcional)</label>
              <textarea
                value={modalObs}
                onChange={(e) => setModalObs(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Alguma observacao sobre esta transferencia..."
                className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-background"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={!origemUnitId || !destinoUnitId || items.length === 0 || createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar Transferencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Modal: Scanner                                                */}
      {/* ============================================================ */}
      <Dialog open={scannerOpen} onOpenChange={(o) => { if (!o) setScannerOpen(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-blue-600" />
              Escanear Codigo de Balanca
            </DialogTitle>
            <DialogDescription>
              Aponte a camera para o codigo de barras impresso pela balanca
            </DialogDescription>
          </DialogHeader>
          <BalancaScanner
            onDetected={handleBarcodeDetected}
            onClose={() => setScannerOpen(false)}
          />
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setScannerOpen(false)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Modal: Detalhe                                                */}
      {/* ============================================================ */}
      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null) }}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes da Transferencia</DialogTitle>
          </DialogHeader>
          {detailData ? (
            <div className="flex-1 overflow-y-auto flex flex-col gap-4">
              {/* Rota */}
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex-1 text-center">
                  <p className="text-xs text-muted-foreground">Origem</p>
                  <p className="font-semibold text-sm">{detailData.origemUnit.nome}</p>
                  <p className="text-xs text-muted-foreground font-mono">{detailData.origemUnit.codigo}</p>
                </div>
                <ArrowRightLeft className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1 text-center">
                  <p className="text-xs text-muted-foreground">Destino</p>
                  <p className="font-semibold text-sm">{detailData.destinoUnit.nome}</p>
                  <p className="text-xs text-muted-foreground font-mono">{detailData.destinoUnit.codigo}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs">Responsavel</span>
                  <span className="font-medium">{detailData.responsavel.nome}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs">Data/Hora</span>
                  <span className="font-medium">{formatDateTime(detailData.createdAt)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs">Itens</span>
                  <span className="font-medium">{detailData.items.length}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground text-xs">Peso Total</span>
                  <span className="font-medium">
                    {detailData.items.reduce((acc: number, i: any) => acc + i.peso, 0).toFixed(3)} kg
                  </span>
                </div>
              </div>

              {detailData.observacao && (
                <p className="text-sm text-muted-foreground border-t pt-3">{detailData.observacao}</p>
              )}

              <div className="border-t pt-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">ITENS</div>
                <div className="flex flex-col gap-1">
                  {detailData.items.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
                      <span>{item.product.nome}</span>
                      <span className="font-mono text-muted-foreground">{item.peso.toFixed(3)} kg</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* Modal: Confirmacao exclusao                                   */}
      {/* ============================================================ */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Excluir Transferencia
            </DialogTitle>
            <DialogDescription>
              Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
