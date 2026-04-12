'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusCard } from '@/components/ui/status-card'
import { AttentionBanner } from '@/components/ui/attention-banner'
import { OperationalScore } from '@/components/ui/operational-score'
import { ChartSkeleton } from '@/components/ui/chart-skeleton'
import {
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Building2,
  AlertTriangle,
  ClipboardCheck,
  PackageX,
  TrendingUp,
  ShieldCheck,
  Activity,
  ChevronRight,
  CalendarDays,
  Zap,
  Target,
  Package,
  FileWarning,
  Sparkles,
  ClipboardList,
  PackagePlus,
  ShoppingCart,
  ArrowRight,
  LockKeyhole,
} from 'lucide-react'
import { useState } from 'react'

// ============================================
// Types
// ============================================

interface DashboardSummary {
  totalUnidadesAtivas: number
  ocorrenciasAbertas: number
  checklistsPendentesHoje: number
  alertasEstoque: number
}

interface ChartDataPoint {
  label: string
  planejado?: number
  realizado?: number
  valor?: number
}

interface LossProduct {
  id: string
  produto: string
  unidade: string
  quantidade: number
  valorPerdido: number
}

// ============================================
// Period filter
// ============================================

const periods = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: '7 dias' },
  { value: 'month', label: '30 dias' },
]

// ============================================
// Dashboard Page
// ============================================

export default function DashboardPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAuthLoading = useAuthStore((s) => s.isLoading)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const selectedUnitId = useAuthStore((s) => s.selectedUnitId)
  const [period, setPeriod] = useState('today')

  const canVisualizar = hasPermission('dashboard', 'visualizar')

  // Determine user's primary role for personalized greeting
  const primaryRole = user?.roles?.[0]?.role || ''
  const isManager = primaryRole === 'gerente_geral' || primaryRole === 'gerente_unidade'

  const { data: summary, isLoading: loadingSummary } = useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get('/dashboard/summary'),
    enabled: canVisualizar,
  })

  const { data: productionRes, isLoading: loadingProduction } = useQuery<{ data: ChartDataPoint[] }>({
    queryKey: ['dashboard', 'charts', 'production'],
    queryFn: () => api.get('/dashboard/charts/production'),
    enabled: canVisualizar,
  })

  const { data: occurrencesRes, isLoading: loadingOccurrences } = useQuery<{ data: ChartDataPoint[] }>({
    queryKey: ['dashboard', 'charts', 'occurrences'],
    queryFn: () => api.get('/dashboard/charts/occurrences'),
    enabled: canVisualizar,
  })

  const { data: checklistsRes, isLoading: loadingChecklists } = useQuery<{ data: ChartDataPoint[] }>({
    queryKey: ['dashboard', 'charts', 'checklists'],
    queryFn: () => api.get('/dashboard/charts/checklists'),
    enabled: canVisualizar,
  })

  const { data: lossesData, isLoading: loadingLosses } = useQuery<{ data: LossProduct[] }>({
    queryKey: ['reports', 'stock', 'losses'],
    queryFn: () => api.get('/reports/stock', { format: 'json', type: 'losses', limit: 5 }),
    enabled: canVisualizar,
  })

  const productionData = productionRes?.data || []
  const occurrencesData = occurrencesRes?.data || []
  const checklistsData = checklistsRes?.data || []
  const losses = lossesData?.data || []

  // Computed severity levels
  const ocSeverity = !summary ? 'neutral' as const :
    summary.ocorrenciasAbertas > 5 ? 'critical' as const :
    summary.ocorrenciasAbertas > 0 ? 'warning' as const : 'healthy' as const

  const clSeverity = !summary ? 'neutral' as const :
    summary.checklistsPendentesHoje > 3 ? 'warning' as const :
    summary.checklistsPendentesHoje > 0 ? 'warning' as const : 'healthy' as const

  const estSeverity = !summary ? 'neutral' as const :
    summary.alertasEstoque > 5 ? 'critical' as const :
    summary.alertasEstoque > 0 ? 'warning' as const : 'healthy' as const

  // Count critical items for the attention section
  const criticalCount = (summary?.ocorrenciasAbertas || 0) + (summary?.alertasEstoque || 0)
  const hasCriticalItems = criticalCount > 0 && !loadingSummary

  // Compute operational health score (0-100)
  const operationalScore = !summary ? 0 : Math.max(0, Math.min(100,
    100
    - (summary.ocorrenciasAbertas * 8)
    - (summary.checklistsPendentesHoje * 5)
    - (summary.alertasEstoque * 4)
  ))

  // Worker-mode permissions
  const canContagemUtensilio = hasPermission('utensilios', 'contagem')
  const canReposicaoUtensilio = hasPermission('utensilios', 'reposicao')
  const canCriarPedido = hasPermission('compras', 'criar_pedido')
  const canExecutarChecklist = hasPermission('checklist', 'executar')
  const isWorkerMode = !isAuthLoading && !canVisualizar

  // Queries para modo operador (so executam quando sem acesso ao dashboard)
  const { data: openCycleData } = useQuery({
    queryKey: ['purchases', 'open-cycle'],
    queryFn: () => api.get('/purchases', { status: 'aberto', limit: 1 }),
    enabled: isWorkerMode && canCriarPedido,
  })

  const { data: pendingChecklistData } = useQuery({
    queryKey: ['checklist-executions', 'pending-worker', selectedUnitId],
    queryFn: () => api.get('/checklist/executions', {
      status: 'pendente',
      limit: 5,
      ...(selectedUnitId ? { unitId: selectedUnitId } : {}),
    }),
    enabled: isWorkerMode && canExecutarChecklist,
  })

  const openCycle = openCycleData?.data?.[0] ?? null
  const pendingChecklists: any[] = pendingChecklistData?.data || []
  const pendingChecklistCount = pendingChecklistData?.total || pendingChecklists.length

  // Greeting based on time
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  // Worker Hub — para usuarios sem acesso ao dashboard gerencial
  if (isWorkerMode) {
    const hasAnyAction = canContagemUtensilio || canReposicaoUtensilio || (canCriarPedido && openCycle) || canExecutarChecklist

    return (
      <div className="space-y-6 animate-fade-up">
        {/* Header */}
        <div>
          <h1 className="font-display text-2xl sm:text-[1.75rem] font-semibold text-foreground tracking-tightest flex items-center gap-2.5">
            {greeting}, {user?.nome?.split(' ')[0] || 'Usuario'}
            <Sparkles className="h-5 w-5 text-amber-400/60" />
          </h1>
          <p className="text-[13px] text-muted-foreground/50 mt-1 flex items-center gap-1.5 font-medium">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {!hasAnyAction ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-muted/40 flex items-center justify-center">
              <LockKeyhole className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground mb-1">Nenhuma acao disponivel</h2>
              <p className="text-sm text-muted-foreground/60 max-w-sm">
                Seu perfil ainda nao tem acoes configuradas. Fale com o administrador.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Contagem de utensilios */}
            {canContagemUtensilio && (
              <WorkerActionCard
                icon={ClipboardList}
                iconBg="bg-blue-50 dark:bg-blue-900/20"
                iconColor="text-blue-600 dark:text-blue-400"
                title="Nova contagem"
                description="Registre a contagem de utensilios do turno atual"
                label="Ir para Utensilios"
                onClick={() => router.push('/utensilios')}
              />
            )}

            {/* Reposicao de utensilios */}
            {canReposicaoUtensilio && (
              <WorkerActionCard
                icon={PackagePlus}
                iconBg="bg-emerald-50 dark:bg-emerald-900/20"
                iconColor="text-emerald-600 dark:text-emerald-400"
                title="Reposicao de utensilios"
                description="Registre itens reposto no estoque de utensilios"
                label="Ir para Utensilios"
                onClick={() => router.push('/utensilios')}
              />
            )}

            {/* Pedido de compras — so aparece se houver ciclo aberto */}
            {canCriarPedido && openCycle && (
              <WorkerActionCard
                icon={ShoppingCart}
                iconBg="bg-amber-50 dark:bg-amber-900/20"
                iconColor="text-amber-600 dark:text-amber-400"
                title="Preencher pedido de compras"
                description="Ha um ciclo de compras aberto aguardando seu pedido"
                label="Ir para Compras"
                onClick={() => router.push('/compras')}
                badge="Ciclo aberto"
                badgeVariant="warning"
              />
            )}

            {/* Checklists pendentes */}
            {canExecutarChecklist && (
              <WorkerActionCard
                icon={ClipboardCheck}
                iconBg="bg-violet-50 dark:bg-violet-900/20"
                iconColor="text-violet-600 dark:text-violet-400"
                title="Checklists pendentes"
                description={
                  pendingChecklistCount > 0
                    ? `${pendingChecklistCount} checklist${pendingChecklistCount !== 1 ? 's' : ''} aguardando preenchimento`
                    : 'Nenhum checklist pendente no momento'
                }
                label="Ir para Checklist"
                onClick={() => router.push('/checklist')}
                badge={pendingChecklistCount > 0 ? String(pendingChecklistCount) : undefined}
                badgeVariant={pendingChecklistCount > 0 ? 'warning' : undefined}
              />
            )}
          </div>
        )}
      </div>
    )
  }

  const chartTooltipStyle = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border) / 0.4)',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgb(0 0 0 / 0.06)',
    fontSize: '12px',
    padding: '8px 12px',
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      {/* ====== HEADER: Greeting + Period Filter ====== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-[1.75rem] font-semibold text-foreground tracking-tightest flex items-center gap-2.5">
            {greeting}, {user?.nome?.split(' ')[0] || 'Usuario'}
            <Sparkles className="h-5 w-5 text-amber-400/60" />
          </h1>
          <p className="text-[13px] text-muted-foreground/50 mt-1 flex items-center gap-1.5 font-medium">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {isManager && <span className="ml-1 text-primary/60 font-semibold">· Visao gerencial</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 border border-border/30">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3.5 py-1.5 text-[13px] font-semibold rounded-lg transition-all duration-200 ${
                period === p.value
                  ? 'bg-card text-foreground shadow-warm-sm border border-border/30'
                  : 'text-muted-foreground/50 hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ====== ATTENTION BANNER ====== */}
      {hasCriticalItems && (
        <AttentionBanner
          variant={summary!.ocorrenciasAbertas > 5 ? 'critical' : 'warning'}
          title={`${criticalCount} item${criticalCount !== 1 ? 's' : ''} precisam da sua atencao`}
          description={[
            summary!.ocorrenciasAbertas > 0 && `${summary!.ocorrenciasAbertas} ocorrencia${summary!.ocorrenciasAbertas !== 1 ? 's' : ''} aberta${summary!.ocorrenciasAbertas !== 1 ? 's' : ''}`,
            summary!.alertasEstoque > 0 && `${summary!.alertasEstoque} alerta${summary!.alertasEstoque !== 1 ? 's' : ''} de estoque`,
          ].filter(Boolean).join(' · ')}
          action={{ label: 'Ver detalhes', onClick: () => router.push('/ocorrencias') }}
        />
      )}

      {!hasCriticalItems && !loadingSummary && (
        <AttentionBanner
          variant="success"
          title="Operacao saudavel"
          description="Nenhum problema critico identificado no momento. Bom trabalho!"
        />
      )}

      {/* ====== HEALTH SCORE + KPI CARDS ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 items-start">
        {/* Operational Health Score */}
        <Card className="lg:w-[200px]">
          <CardContent className="pt-5 pb-4 flex flex-col items-center">
            <OperationalScore
              score={operationalScore}
              label="Saude operacional"
              subtitle="Indice geral da operacao"
              loading={loadingSummary}
            />
          </CardContent>
        </Card>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="stagger-1 animate-fade-up">
            <StatusCard
              title="Unidades Ativas"
              value={summary?.totalUnidadesAtivas ?? 0}
              icon={Building2}
              severity="neutral"
              loading={loadingSummary}
              subtitle="em operacao"
            />
          </div>
          <div className="stagger-2 animate-fade-up">
            <StatusCard
              title="Ocorrencias"
              value={summary?.ocorrenciasAbertas ?? 0}
              icon={AlertTriangle}
              severity={ocSeverity}
              loading={loadingSummary}
              subtitle={summary?.ocorrenciasAbertas === 0 ? 'nenhuma aberta' : 'aguardando resolucao'}
              action={summary?.ocorrenciasAbertas ? { label: 'Resolver', onClick: () => router.push('/ocorrencias') } : undefined}
            />
          </div>
          <div className="stagger-3 animate-fade-up">
            <StatusCard
              title="Checklists"
              value={summary?.checklistsPendentesHoje ?? 0}
              icon={ClipboardCheck}
              severity={clSeverity}
              loading={loadingSummary}
              subtitle={summary?.checklistsPendentesHoje === 0 ? 'tudo concluido hoje' : 'pendentes hoje'}
              action={summary?.checklistsPendentesHoje ? { label: 'Completar', onClick: () => router.push('/checklist') } : undefined}
            />
          </div>
          <div className="stagger-4 animate-fade-up">
            <StatusCard
              title="Alertas Estoque"
              value={summary?.alertasEstoque ?? 0}
              icon={PackageX}
              severity={estSeverity}
              loading={loadingSummary}
              subtitle={summary?.alertasEstoque === 0 ? 'niveis normais' : 'abaixo do minimo'}
              action={summary?.alertasEstoque ? { label: 'Verificar', onClick: () => router.push('/estoque') } : undefined}
            />
          </div>
        </div>
      </div>

      {/* ====== OPERATIONAL BLOCKS: "What needs attention" ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today's Summary */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-[15px] font-semibold">Resumo de hoje</CardTitle>
                  <p className="text-[11px] text-muted-foreground/50">Producao planejada vs realizada</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/producao')} className="text-xs text-muted-foreground/50 gap-1">
                Ver tudo <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingProduction ? (
              <ChartSkeleton height={240} />
            ) : productionData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-3">
                  <Target className="h-5 w-5 text-amber-500/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground/60">Sem producao registrada</p>
                <p className="text-xs text-muted-foreground/40 mt-0.5">Verifique se ha ordens pendentes</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => router.push('/producao')}>
                  Ir para producao
                </Button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={productionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground) / 0.4)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground) / 0.4)' }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="planejado" stroke="#d97706" name="Planejada" strokeWidth={2.5} dot={{ r: 2.5, fill: '#d97706' }} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="realizado" stroke="#059669" name="Realizada" strokeWidth={2.5} dot={{ r: 2.5, fill: '#059669' }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions / Risk Items */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                <Zap className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Acoes rapidas</CardTitle>
                <p className="text-[11px] text-muted-foreground/50">Tarefas pendentes</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickAction
              label="Checklists pendentes"
              count={summary?.checklistsPendentesHoje || 0}
              severity={summary?.checklistsPendentesHoje ? 'warning' : 'ok'}
              onClick={() => router.push('/checklist')}
              emptyText="Todos concluidos"
            />
            <QuickAction
              label="Ocorrencias abertas"
              count={summary?.ocorrenciasAbertas || 0}
              severity={summary?.ocorrenciasAbertas && summary.ocorrenciasAbertas > 3 ? 'critical' : summary?.ocorrenciasAbertas ? 'warning' : 'ok'}
              onClick={() => router.push('/ocorrencias')}
              emptyText="Nenhuma pendente"
            />
            <QuickAction
              label="Produtos em risco"
              count={summary?.alertasEstoque || 0}
              severity={summary?.alertasEstoque && summary.alertasEstoque > 3 ? 'critical' : summary?.alertasEstoque ? 'warning' : 'ok'}
              onClick={() => router.push('/estoque')}
              emptyText="Estoque normal"
            />

            <div className="pt-2 border-t border-border/30">
              <p className="text-[11px] font-medium text-muted-foreground/40 uppercase tracking-wider mb-2">Atalhos</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="text-xs h-8 justify-start gap-1.5" onClick={() => router.push('/producao')}>
                  <TrendingUp className="h-3 w-3" /> Producao
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-8 justify-start gap-1.5" onClick={() => router.push('/compras')}>
                  <Package className="h-3 w-3" /> Compras
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-8 justify-start gap-1.5" onClick={() => router.push('/relatorios')}>
                  <FileWarning className="h-3 w-3" /> Relatorios
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-8 justify-start gap-1.5" onClick={() => router.push('/estoque')}>
                  <PackageX className="h-3 w-3" /> Estoque
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ====== CHARTS ROW ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Occurrences by type */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-[15px] font-semibold">Ocorrencias por tipo</CardTitle>
                  <p className="text-[11px] text-muted-foreground/50">Ultimos 30 dias</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingOccurrences ? (
              <ChartSkeleton height={240} />
            ) : occurrencesData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-500/50" />
                </div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Nenhuma ocorrencia</p>
                <p className="text-xs text-muted-foreground/40 mt-0.5">Operacao saudavel nos ultimos 30 dias</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={occurrencesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground) / 0.4)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground) / 0.4)' }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="valor" fill="#d97706" name="Qtd" radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Checklist completion rate */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-[15px] font-semibold">Taxa de conclusao</CardTitle>
                  <p className="text-[11px] text-muted-foreground/50">Checklists por unidade</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingChecklists ? (
              <ChartSkeleton height={240} />
            ) : checklistsData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-3">
                  <ClipboardCheck className="h-5 w-5 text-blue-500/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground/60">Sem dados de checklist</p>
                <p className="text-xs text-muted-foreground/40 mt-0.5">Inicie um checklist para ver metricas</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => router.push('/checklist')}>
                  Iniciar checklist
                </Button>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={checklistsData} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground) / 0.4)' }} unit="%" />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground) / 0.4)' }} width={55} />
                  <Tooltip formatter={(value: number) => `${value}%`} contentStyle={chartTooltipStyle} />
                  <Bar dataKey="valor" fill="#059669" name="Taxa (%)" radius={[0, 6, 6, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ====== LOSSES TABLE: Top problemas ====== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                <PackageX className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Top perdas</CardTitle>
                <p className="text-[11px] text-muted-foreground/50">Produtos com maiores perdas recentes</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/relatorios')} className="text-xs text-muted-foreground/50 gap-1">
              Relatorio completo <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {losses.length === 0 ? (
            <div className="flex items-center gap-3 py-6 justify-center">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-emerald-500/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Sem perdas registradas</p>
                <p className="text-xs text-muted-foreground/40">Excelente controle de estoque</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="pb-2.5 text-left text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Produto</th>
                    <th className="pb-2.5 text-left text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Unidade</th>
                    <th className="pb-2.5 text-right text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Qtd</th>
                    <th className="pb-2.5 text-right text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-wider">Perda</th>
                  </tr>
                </thead>
                <tbody>
                  {losses.map((item, idx) => (
                    <tr key={item.id} className="border-b border-border/15 last:border-0 hover:bg-muted/15 transition-colors">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold w-4 ${idx === 0 ? 'text-red-500' : idx === 1 ? 'text-amber-500' : 'text-muted-foreground/30'}`}>
                            {idx + 1}
                          </span>
                          <span className="font-medium text-sm">{item.produto}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-muted-foreground/50 text-xs">{item.unidade}</td>
                      <td className="py-2.5 text-right tabular-nums text-sm">{item.quantidade}</td>
                      <td className="py-2.5 text-right font-semibold text-red-600 dark:text-red-400 tabular-nums text-sm">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorPerdido)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// Worker Action Card
// ============================================

function WorkerActionCard({ icon: Icon, iconBg, iconColor, title, description, label, onClick, badge, badgeVariant }: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  description: string
  label: string
  onClick: () => void
  badge?: string
  badgeVariant?: 'warning' | 'success' | 'destructive'
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-warm-sm hover:shadow-warm transition-shadow flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {badge && badgeVariant && (
              <Badge variant={badgeVariant} className="text-[10px]">{badge}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground/60 mt-0.5 font-medium">{description}</p>
        </div>
      </div>
      <button
        onClick={onClick}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted/40 hover:bg-muted/70 text-xs font-semibold text-foreground/70 hover:text-foreground transition-all duration-200"
      >
        {label}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ============================================
// Quick Action Item
// ============================================

function QuickAction({ label, count, severity, onClick, emptyText }: {
  label: string
  count: number
  severity: 'ok' | 'warning' | 'critical'
  onClick: () => void
  emptyText: string
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-all duration-200 text-left group"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`h-2 w-2 rounded-full shrink-0 transition-all duration-300 ${
          severity === 'critical' ? 'bg-red-500 shadow-[0_0_6px_rgb(239_68_68/0.4)]' :
          severity === 'warning' ? 'bg-amber-500 shadow-[0_0_6px_rgb(245_158_11/0.3)]' :
          'bg-emerald-500'
        }`} />
        <span className="text-sm text-foreground/80 truncate group-hover:text-foreground transition-colors">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {count > 0 ? (
          <Badge variant={severity === 'critical' ? 'destructive' : severity === 'warning' ? 'warning' : 'success'}>
            {count}
          </Badge>
        ) : (
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{emptyText}</span>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 group-hover:translate-x-0.5 transition-all duration-200" />
      </div>
    </button>
  )
}
