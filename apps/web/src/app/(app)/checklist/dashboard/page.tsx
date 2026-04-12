'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import {
  ArrowLeft, TrendingUp, AlertTriangle, CheckCircle, Clock,
  Play, Trophy, Medal, Star, Target,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const PERIODO_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
]

export default function ChecklistDashboardPage() {
  const router = useRouter()
  const { selectedUnitId } = useAuthStore()
  const [periodo, setPeriodo] = useState(30)

  // Execucoes recentes
  const { data: executionsInfo, isLoading } = useQuery({
    queryKey: ['checklist-executions-dashboard', selectedUnitId],
    queryFn: () => api.get('/checklist/executions', { limit: 100, ...(selectedUnitId ? { unitId: selectedUnitId } : {}) }),
  })

  // Ranking de usuarios
  const { data: rankingInfo, isLoading: rankingLoading } = useQuery({
    queryKey: ['checklist-ranking', selectedUnitId, periodo],
    queryFn: () => api.get('/checklist/ranking', {
      ...(selectedUnitId ? { unitId: selectedUnitId } : {}),
      periodo,
    }),
  })

  const executions: any[] = executionsInfo?.data || []
  const ranking: any[] = rankingInfo?.data || []

  // Status granulares
  const total = executions.length
  const concluidos = executions.filter((e: any) => e.status === 'concluido').length
  const atrasados = executions.filter((e: any) => e.status === 'atrasado').length
  // Iniciado = tem respostas mas ainda pendente
  const iniciados = executions.filter((e: any) => e.status === 'pendente' && (e._count?.responses ?? 0) > 0).length
  const naoIniciados = executions.filter((e: any) => e.status === 'pendente' && (e._count?.responses ?? 0) === 0).length

  const scores = executions.filter((e: any) => e.score !== null).map((e: any) => e.score)
  const avgScore = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0

  // Chart: evolucao do score dos ultimos 7 dias
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const dia = subDays(new Date(), 6 - i)
    const diaStr = format(dia, 'yyyy-MM-dd')
    const execsDia = executions.filter((e: any) => e.data?.startsWith(diaStr) && e.score !== null)
    const mediaDia = execsDia.length > 0
      ? execsDia.reduce((s: number, e: any) => s + e.score, 0) / execsDia.length
      : null
    return {
      date: format(dia, 'dd/MM', { locale: ptBR }),
      score: mediaDia ?? null,
    }
  })

  const hasChartData = chartData.some(d => d.score !== null)

  // Status distribuicao para mini-grafico
  const statusData = [
    { name: 'Concluídos', val: concluidos, color: '#10b981' },
    { name: 'Atrasados', val: atrasados, color: '#ef4444' },
    { name: 'Em andamento', val: iniciados, color: '#f59e0b' },
    { name: 'Não iniciados', val: naoIniciados, color: '#6b7280' },
  ].filter(d => d.val > 0)

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-20">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold">Analytics de Operação</h1>
            <p className="text-sm text-muted-foreground">Qualidade, Conformidade e Desempenho da Equipe</p>
          </div>
        </div>

        {/* Seletor de periodo */}
        <div className="flex gap-1 bg-accent rounded-xl p-1">
          {PERIODO_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriodo(opt.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-all',
                periodo === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-28 bg-accent rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* KPI Cards — 5 categorias de status */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Score medio */}
            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl p-5 text-white shadow-warm-md relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-20">
                <TrendingUp className="h-14 w-14" />
              </div>
              <h3 className="text-xs font-medium text-emerald-50 mb-1">Score Médio</h3>
              <p className="text-3xl font-display font-bold">{avgScore.toFixed(1)}%</p>
              <p className="text-xs text-emerald-100 mt-2">{scores.length} execuções avaliadas</p>
            </div>

            {/* Concluídos */}
            <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <CheckCircle className="h-4 w-4" />
                <h3 className="text-xs font-medium text-muted-foreground">Concluídos</h3>
              </div>
              <p className="text-2xl font-display font-bold">{concluidos}</p>
              <p className="text-xs text-muted-foreground mt-1">em {total} total</p>
            </div>

            {/* Iniciados / em andamento */}
            <div className="bg-card border border-amber-200 dark:border-amber-800/30 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-amber-500 mb-2">
                <Play className="h-4 w-4" />
                <h3 className="text-xs font-medium text-muted-foreground">Em Andamento</h3>
              </div>
              <p className="text-2xl font-display font-bold">{iniciados}</p>
              <p className="text-xs text-muted-foreground mt-1">iniciados, não finalizados</p>
            </div>

            {/* Nao iniciados */}
            <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                <h3 className="text-xs font-medium text-muted-foreground">Não Iniciados</h3>
              </div>
              <p className="text-2xl font-display font-bold">{naoIniciados}</p>
              <p className="text-xs text-muted-foreground mt-1">aguardando execução</p>
            </div>

            {/* Atrasados */}
            <div className="bg-card border border-red-200 dark:border-red-800/30 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-red-500 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="text-xs font-medium text-muted-foreground">Atrasados</h3>
              </div>
              <p className="text-2xl font-display font-bold text-red-600 dark:text-red-400">{atrasados}</p>
              <p className="text-xs text-red-500 mt-1 font-medium">requerem atenção</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score 7 dias */}
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
              <h3 className="text-base font-bold mb-5">Evolução do Score (7 Dias)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.15} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} className="text-xs" />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} className="text-xs" />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(val: any) => val !== null ? [`${Number(val).toFixed(1)}%`, 'Score'] : ['—', 'Score']}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#10b981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorScore)"
                      connectNulls={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {!hasChartData && (
                <p className="text-center text-xs text-muted-foreground -mt-4">Sem dados de score nos últimos 7 dias</p>
              )}
            </div>

            {/* Distribuicao de status */}
            <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
              <h3 className="text-base font-bold mb-5">Distribuição de Status</h3>
              {statusData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={statusData}
                      layout="vertical"
                      margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" opacity={0.15} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} className="text-xs font-medium" width={90} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                      <Bar dataKey="val" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20}
                        label={{ position: 'right', className: 'text-xs font-bold fill-foreground' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  Nenhuma execução registrada
                </div>
              )}
            </div>
          </div>

          {/* Ranking de Usuarios */}
          <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h3 className="text-base font-bold">Ranking da Equipe</h3>
              <span className="ml-auto text-xs text-muted-foreground bg-accent px-2.5 py-1 rounded-full">
                Últimos {periodo} dias
              </span>
            </div>

            {rankingLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-accent rounded-xl" />)}
              </div>
            ) : ranking.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Nenhum dado de execução para o período selecionado
              </div>
            ) : (
              <div className="space-y-3">
                {ranking.map((user: any, index: number) => (
                  <div
                    key={user.userId}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3 rounded-xl border transition-all',
                      index === 0 && 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10',
                      index === 1 && 'border-slate-300 bg-slate-50/50 dark:bg-slate-900/10',
                      index === 2 && 'border-orange-200 bg-orange-50/30 dark:bg-orange-900/10',
                      index > 2 && 'border-border/40 bg-background',
                    )}
                  >
                    {/* Posicao */}
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
                      index === 0 && 'bg-amber-400 text-white',
                      index === 1 && 'bg-slate-400 text-white',
                      index === 2 && 'bg-orange-400 text-white',
                      index > 2 && 'bg-accent text-muted-foreground',
                    )}>
                      {index < 3 ? <Medal className="h-4 w-4" /> : index + 1}
                    </div>

                    {/* Nome */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{user.nome}</p>
                      <p className="text-xs text-muted-foreground">{user.totalConcluidos} tarefas concluídas</p>
                    </div>

                    {/* Metricas */}
                    <div className="hidden sm:flex items-center gap-6 shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">Pontualidade</p>
                        <p className={cn(
                          'text-sm font-bold',
                          user.pontualidade === null ? 'text-muted-foreground' :
                          user.pontualidade >= 80 ? 'text-emerald-600' :
                          user.pontualidade >= 60 ? 'text-amber-600' : 'text-red-600'
                        )}>
                          {user.pontualidade !== null ? `${user.pontualidade}%` : '—'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">Qualidade</p>
                        <p className={cn(
                          'text-sm font-bold',
                          user.qualidade === null ? 'text-muted-foreground' :
                          user.qualidade >= 80 ? 'text-emerald-600' :
                          user.qualidade >= 60 ? 'text-amber-600' : 'text-red-600'
                        )}>
                          {user.qualidade !== null ? `${user.qualidade}%` : '—'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-0.5">Esforço</p>
                        <p className="text-sm font-bold text-blue-600">{user.esforco}%</p>
                      </div>
                    </div>

                    {/* Score geral */}
                    <div className="shrink-0 text-right">
                      <div className={cn(
                        'inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold',
                        index === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                        'bg-accent text-foreground'
                      )}>
                        <Star className="h-3.5 w-3.5" />
                        {user.scoreGeral}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {ranking.length > 0 && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Score geral = 40% pontualidade + 30% esforço + 30% qualidade
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
