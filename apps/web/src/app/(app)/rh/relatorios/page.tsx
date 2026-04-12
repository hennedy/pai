'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  RefreshCw, Users, TrendingDown, TrendingUp, AlertCircle,
  BarChart2, DollarSign, Gift, Clock, Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v?: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d?: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}
function fmtMin(m: number) {
  const h = Math.floor(m / 60), min = m % 60
  return `${h}h${min.toString().padStart(2, '0')}`
}

function KpiCard({
  label, value, sub, color = 'text-foreground', icon: Icon,
}: {
  label: string; value: string | number; sub?: string
  color?: string; icon?: React.ElementType
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn('text-3xl font-bold mt-1', color)}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className="h-9 w-9 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Resumo Geral ────────────────────────────────────────────────────────

function TabResumo({ canVis }: { canVis: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'relatorios', 'resumo'],
    queryFn: () => api.get('/rh/relatorios/resumo') as Promise<any>,
    enabled: canVis,
  })

  if (isLoading) return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  const { headcount, movimentacao30d, alertas } = data ?? {}

  return (
    <div className="space-y-6">
      {/* Headcount */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Headcount Atual</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Ativos" value={headcount?.ativos ?? 0} color="text-green-400" icon={Users} />
          <KpiCard label="Inativos" value={headcount?.inativos ?? 0} color="text-zinc-400" icon={Users} />
          <KpiCard label="Em Férias" value={headcount?.ferias ?? 0} color="text-blue-400" icon={Users} />
          <KpiCard label="Afastados" value={headcount?.afastados ?? 0} color="text-amber-400" icon={Users} />
        </div>
      </div>

      {/* Movimentação */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Movimentação — Últimos 30 dias</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <KpiCard label="Admissões" value={movimentacao30d?.admissoes ?? 0} color="text-green-400" icon={TrendingUp} />
          <KpiCard label="Desligamentos" value={movimentacao30d?.desligamentos ?? 0} color="text-red-400" icon={TrendingDown} />
        </div>
      </div>

      {/* Alertas */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Alertas Pendentes</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Exames vencendo (60d)" value={alertas?.examesVencendo ?? 0} color={alertas?.examesVencendo > 0 ? 'text-amber-400' : 'text-foreground'} icon={AlertCircle} />
          <KpiCard label="Colaboradores inaptos" value={alertas?.examesInaptos ?? 0} color={alertas?.examesInaptos > 0 ? 'text-red-400' : 'text-foreground'} icon={AlertCircle} />
          <KpiCard label="Ajustes de ponto pendentes" value={alertas?.ajustesPendentes ?? 0} color={alertas?.ajustesPendentes > 0 ? 'text-amber-400' : 'text-foreground'} icon={Clock} />
          <KpiCard label="Fechamentos p/ aprovar" value={alertas?.fechamentosPendentes ?? 0} color={alertas?.fechamentosPendentes > 0 ? 'text-blue-400' : 'text-foreground'} icon={Clock} />
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Headcount ───────────────────────────────────────────────────────────

function TabHeadcount({ canVis }: { canVis: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'relatorios', 'headcount'],
    queryFn: () => api.get('/rh/relatorios/headcount') as Promise<any>,
    enabled: canVis,
  })

  const STATUS_LABELS: Record<string, string> = {
    ativo: 'Ativo', inativo: 'Inativo', ferias: 'Férias',
    afastado: 'Afastado', desligado: 'Desligado',
  }
  const CONTRATO_LABELS: Record<string, string> = {
    clt: 'CLT', pj: 'PJ', estagio: 'Estágio',
    aprendiz: 'Aprendiz', temporario: 'Temporário', autonomo: 'Autônomo',
  }

  if (isLoading) return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  const total = data?.porStatus?.reduce((s: number, r: any) => s + r._count.id, 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Por status */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Por Status</h3>
        <div className="rounded-xl border bg-card overflow-hidden">
          {data?.porStatus?.map((row: any) => {
            const pct = total > 0 ? Math.round((row._count.id / total) * 100) : 0
            return (
              <div key={row.status} className="flex items-center gap-4 px-4 py-3 border-b last:border-0 border-border/50">
                <span className="text-sm w-24 capitalize">{STATUS_LABELS[row.status] ?? row.status}</span>
                <div className="flex-1 h-2 rounded-full bg-muted/40">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm font-semibold w-8 text-right">{row._count.id}</span>
                <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Por tipo de contrato */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Por Tipo de Contrato (ativos)</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {data?.porTipoContrato?.map((row: any) => (
            <div key={row.tipoContrato} className="rounded-xl border bg-card p-4 text-center">
              <p className="text-2xl font-bold">{row._count.id}</p>
              <p className="text-xs text-muted-foreground mt-1">{CONTRATO_LABELS[row.tipoContrato] ?? row.tipoContrato}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Por unidade */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Por Unidade</h3>
        <div className="rounded-xl border bg-card overflow-hidden">
          {data?.porUnidade
            ?.filter((u: any) => u._count.colaboradores > 0)
            .sort((a: any, b: any) => b._count.colaboradores - a._count.colaboradores)
            .map((u: any) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-border/50">
                <span className="text-sm">{u.nome}</span>
                <span className="text-sm font-semibold">{u._count.colaboradores}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Top cargos */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Top 10 Cargos</h3>
        <div className="rounded-xl border bg-card overflow-hidden">
          {data?.porCargo
            ?.filter((c: any) => c._count.colaboradores > 0)
            .map((c: any, i: number) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-border/50">
                <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                <span className="text-sm flex-1">{c.nome}</span>
                <span className="text-sm font-semibold">{c._count.colaboradores}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Turnover ────────────────────────────────────────────────────────────

function TabTurnover({ canVis }: { canVis: boolean }) {
  const now = new Date()
  const [de, setDe] = useState(`${now.getFullYear()}-01-01`)
  const [ate, setAte] = useState(now.toISOString().slice(0, 10))

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'relatorios', 'turnover', de, ate],
    queryFn: () => api.get('/rh/relatorios/turnover', { de, ate }) as Promise<any>,
    enabled: canVis,
  })

  const TIPO_LABELS: Record<string, string> = {
    demissao_sem_justa_causa: 'Demissão s/ Justa Causa',
    demissao_por_justa_causa: 'Demissão p/ Justa Causa',
    pedido_demissao: 'Pedido de Demissão',
    acordo_mutuo: 'Acordo Mútuo',
    aposentadoria: 'Aposentadoria',
    falecimento: 'Falecimento',
    termino_contrato: 'Término de Contrato',
    outro: 'Outro',
  }

  // Monta série de meses para o período
  const mesesSerie: string[] = []
  if (de && ate) {
    const cur = new Date(de + 'T00:00:00')
    const end = new Date(ate + 'T00:00:00')
    while (cur <= end) {
      mesesSerie.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">De</label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Até</label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-36" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid sm:grid-cols-3 gap-3">
            <KpiCard label="Total de admissões" value={data?.totalAdmissoes ?? 0} color="text-green-400" icon={TrendingUp} />
            <KpiCard label="Total de desligamentos" value={data?.totalDesligamentos ?? 0} color="text-red-400" icon={TrendingDown} />
            <KpiCard label="Taxa de turnover" value={data?.taxaTurnover ?? '0%'} color="text-amber-400" icon={BarChart2} />
          </div>

          {/* Tabela mês a mês */}
          {mesesSerie.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Mês a mês</h3>
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="grid grid-cols-3 px-4 py-2 bg-muted/20 text-xs font-semibold text-muted-foreground">
                  <span>Mês</span><span className="text-center">Admissões</span><span className="text-right">Desligamentos</span>
                </div>
                {mesesSerie.map((m) => (
                  <div key={m} className="grid grid-cols-3 px-4 py-2.5 border-t border-border/30 text-sm">
                    <span className="text-muted-foreground">{m}</span>
                    <span className={cn('text-center font-medium', (data?.admissoes?.[m] ?? 0) > 0 ? 'text-green-400' : 'text-muted-foreground')}>
                      {data?.admissoes?.[m] ?? 0}
                    </span>
                    <span className={cn('text-right font-medium', (data?.desligamentos?.[m] ?? 0) > 0 ? 'text-red-400' : 'text-muted-foreground')}>
                      {data?.desligamentos?.[m] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tipos de desligamento */}
          {data?.tiposDesligamento?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Motivos de desligamento</h3>
              <div className="rounded-xl border bg-card overflow-hidden">
                {data.tiposDesligamento
                  .sort((a: any, b: any) => b._count.id - a._count.id)
                  .map((row: any) => (
                    <div key={row.tipoDesligamento} className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-border/50 text-sm">
                      <span>{TIPO_LABELS[row.tipoDesligamento] ?? row.tipoDesligamento}</span>
                      <span className="font-semibold">{row._count.id}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tab: Absenteísmo ─────────────────────────────────────────────────────────

function TabAbsenteismo({ canVis }: { canVis: boolean }) {
  const now = new Date()
  const [de, setDe] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
  const [ate, setAte] = useState(now.toISOString().slice(0, 10))

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'relatorios', 'absenteismo', de, ate],
    queryFn: () => api.get('/rh/relatorios/absenteismo', { de, ate }) as Promise<any>,
    enabled: canVis,
  })

  const TIPO_LABELS: Record<string, string> = {
    falta: 'Falta', atraso: 'Atraso', saida_antecipada: 'Saída Antecipada',
    hora_extra: 'Hora Extra', feriado: 'Feriado', atestado: 'Atestado',
    afastamento: 'Afastamento', folga_compensatoria: 'Folga Compensatória',
  }
  const TIPO_COLORS: Record<string, string> = {
    falta: 'text-red-400', atraso: 'text-amber-400', hora_extra: 'text-blue-400',
    atestado: 'text-purple-400',
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">De</label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-36" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Até</label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-36" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <KpiCard label="Total de ocorrências" value={data?.totalOcorrencias ?? 0} icon={AlertCircle} />

          {/* Por tipo */}
          {data?.porTipo?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Por tipo de ocorrência</h3>
              <div className="rounded-xl border bg-card overflow-hidden">
                {data.porTipo
                  .sort((a: any, b: any) => b._count.id - a._count.id)
                  .map((row: any) => (
                    <div key={row.tipo} className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-border/50 text-sm">
                      <span className={cn(TIPO_COLORS[row.tipo] ?? 'text-foreground')}>
                        {TIPO_LABELS[row.tipo] ?? row.tipo}
                      </span>
                      <div className="flex items-center gap-4">
                        {row._sum?.minutosImpacto > 0 && (
                          <span className="text-xs text-muted-foreground">{fmtMin(row._sum.minutosImpacto)}</span>
                        )}
                        <span className="font-semibold">{row._count.id}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Top colaboradores */}
          {data?.topColaboradores?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Colaboradores com mais ocorrências</h3>
              <div className="rounded-xl border bg-card overflow-hidden">
                {data.topColaboradores.map((row: any, i: number) => (
                  <div key={row.colaboradorId} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-border/50 text-sm">
                    <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{row.colaborador?.nome ?? '—'}</p>
                      {row.colaborador?.cargo && <p className="text-xs text-muted-foreground">{row.colaborador.cargo.nome}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{row._count.id} ocorrência(s)</p>
                      {row._sum?.minutosImpacto > 0 && <p className="text-xs text-muted-foreground">{fmtMin(row._sum.minutosImpacto)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tab: Desempenho ──────────────────────────────────────────────────────────

function TabDesempenho({ canVis }: { canVis: boolean }) {
  const { data: ciclos } = useQuery({
    queryKey: ['rh', 'desempenho', 'ciclos', 'all'],
    queryFn: () => api.get('/rh/desempenho/ciclos', { limit: 100 }) as Promise<{ items: any[] }>,
    enabled: canVis,
  })

  const [cicloId, setCicloId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['rh', 'relatorios', 'desempenho', cicloId],
    queryFn: () => api.get('/rh/relatorios/desempenho', cicloId ? { cicloId } : {}) as Promise<any>,
    enabled: canVis,
  })

  const TIPO_LABELS: Record<string, string> = {
    autoavaliacao: 'Autoavaliação', gestor: 'Gestor', par: 'Par',
    subordinado: 'Subordinado', cliente_interno: 'Cliente Interno',
  }
  const STATUS_META_LABELS: Record<string, string> = {
    em_andamento: 'Em Andamento', concluida: 'Concluída',
    nao_atingida: 'Não Atingida', cancelada: 'Cancelada',
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Select value={cicloId} onValueChange={setCicloId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Todos os ciclos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {ciclos?.items?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Ciclo ativo */}
          {data?.cicloAtivo && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
              <p className="text-xs text-muted-foreground mb-1">Ciclo em andamento</p>
              <p className="font-semibold">{data.cicloAtivo.nome}</p>
              <p className="text-xs text-muted-foreground">{data.cicloAtivo.periodoRef} · {fmtDate(data.cicloAtivo.dataInicio)} — {fmtDate(data.cicloAtivo.dataFim)}</p>
            </div>
          )}

          {/* KPIs avaliações */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Avaliações</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              <KpiCard label="Concluídas" value={data?.avaliacoes?.concluidas ?? 0} color="text-green-400" icon={Target} />
              <KpiCard label="Pendentes" value={data?.avaliacoes?.pendentes ?? 0} color="text-amber-400" icon={Target} />
              <KpiCard
                label="Média de pontuação"
                value={data?.avaliacoes?.mediaPontuacao != null ? `${data.avaliacoes.mediaPontuacao.toFixed(1)} pts` : '—'}
                color="text-blue-400"
                icon={BarChart2}
              />
            </div>
          </div>

          {/* Por tipo de avaliação */}
          {data?.avaliacoes?.porTipo?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Por tipo de avaliação (concluídas)</h3>
              <div className="rounded-xl border bg-card overflow-hidden">
                {data.avaliacoes.porTipo.map((row: any) => (
                  <div key={row.tipo} className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-border/50 text-sm">
                    <span>{TIPO_LABELS[row.tipo] ?? row.tipo}</span>
                    <div className="flex items-center gap-4">
                      {row._avg?.pontuacaoTotal != null && (
                        <span className="text-xs text-muted-foreground">Média: {row._avg.pontuacaoTotal.toFixed(1)}</span>
                      )}
                      <span className="font-semibold">{row._count.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status de metas */}
          {data?.metas?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Status das Metas</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {data.metas.map((row: any) => (
                  <div key={row.status} className="rounded-xl border bg-card p-4 flex items-center justify-between">
                    <span className="text-sm">{STATUS_META_LABELS[row.status] ?? row.status}</span>
                    <span className="text-2xl font-bold">{row._count.id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Tab: Folha / Benefícios ──────────────────────────────────────────────────

function TabFolhaBeneficios({ canVis }: { canVis: boolean }) {
  const now = new Date()
  const [competencia, setCompetencia] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

  const { data: folha, isLoading: loadFolha } = useQuery({
    queryKey: ['rh', 'relatorios', 'folha', competencia],
    queryFn: () => api.get('/rh/relatorios/folha', { competencia }) as Promise<any>,
    enabled: canVis,
  })

  const { data: beneficios, isLoading: loadBen } = useQuery({
    queryKey: ['rh', 'relatorios', 'beneficios'],
    queryFn: () => api.get('/rh/relatorios/beneficios') as Promise<any>,
    enabled: canVis,
  })

  const TIPO_BEN_LABELS: Record<string, string> = {
    vale_alimentacao: 'Vale Alimentação', vale_refeicao: 'Vale Refeição',
    plano_saude: 'Plano de Saúde', plano_odontologico: 'Plano Odontológico',
    vale_transporte: 'Vale Transporte', seguro_vida: 'Seguro de Vida',
    gympass: 'Gympass', outro: 'Outro',
  }

  return (
    <div className="space-y-6">
      {/* Folha */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold">Folha de Pagamento</h3>
          <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)}
            className="px-2 py-1 rounded-lg border border-border bg-background text-sm" />
        </div>

        {loadFolha ? (
          <div className="flex justify-center py-6"><RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <KpiCard label="Total bruto" value={fmtCurrency(folha?.resumo?.totalBruto)} icon={DollarSign} />
              <KpiCard label="Total líquido" value={fmtCurrency(folha?.resumo?.totalLiquido)} color="text-green-400" icon={DollarSign} />
              <KpiCard label="Total descontos" value={fmtCurrency(folha?.resumo?.totalDescontos)} color="text-red-400" icon={DollarSign} />
              <KpiCard label="Holerites gerados" value={folha?.resumo?.qtdHolerites ?? 0} icon={BarChart2} />
            </div>

            {folha?.historico?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">Histórico (últimas competências)</h4>
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="grid grid-cols-4 px-4 py-2 bg-muted/20 text-xs font-semibold text-muted-foreground">
                    <span>Competência</span><span className="text-right">Bruto</span><span className="text-right">Líquido</span><span className="text-right">Holerites</span>
                  </div>
                  {folha.historico.map((h: any) => (
                    <div key={h.competencia} className="grid grid-cols-4 px-4 py-2.5 border-t border-border/30 text-sm">
                      <span>{h.competencia}</span>
                      <span className="text-right">{fmtCurrency(h.totalBruto)}</span>
                      <span className="text-right text-green-400">{fmtCurrency(h.totalLiquido)}</span>
                      <span className="text-right text-muted-foreground">{h.qtd}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Benefícios */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Benefícios</h3>
        {loadBen ? (
          <div className="flex justify-center py-6"><RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <KpiCard label="Custo empresa / mês" value={fmtCurrency(beneficios?.custoTotal?.empresa)} icon={Gift} />
              <KpiCard label="Desconto colaboradores / mês" value={fmtCurrency(beneficios?.custoTotal?.colaborador)} icon={Gift} />
            </div>

            {beneficios?.porBeneficio?.length > 0 && (
              <div className="rounded-xl border bg-card overflow-hidden">
                {beneficios.porBeneficio
                  .filter((b: any) => b._count.colaboradores > 0)
                  .map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-border/50 text-sm">
                      <div>
                        <p className="font-medium">{b.nome}</p>
                        <p className="text-xs text-muted-foreground capitalize">{TIPO_BEN_LABELS[b.tipo] ?? b.tipo}</p>
                      </div>
                      <span className="font-semibold">{b._count.colaboradores} colaborador(es)</span>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'resumo' | 'headcount' | 'turnover' | 'absenteismo' | 'desempenho' | 'folha'

export default function RhRelatoriosPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const [tab, setTab] = useState<Tab>('resumo')

  const canVis = isFullAccess || isGerenteGeral() || hasPermission('rh_relatorios', 'visualizar')

  if (!canVis) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Sem permissão para acessar os Relatórios.</p>
      </div>
    )
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'resumo',       label: 'Resumo Geral' },
    { id: 'headcount',    label: 'Headcount' },
    { id: 'turnover',     label: 'Turnover' },
    { id: 'absenteismo',  label: 'Absenteísmo' },
    { id: 'desempenho',   label: 'Desempenho' },
    { id: 'folha',        label: 'Folha & Benefícios' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios e Indicadores RH</h1>
        <p className="text-muted-foreground text-sm mt-1">KPIs e análises do departamento de Recursos Humanos</p>
      </div>

      <div className="flex gap-1 border-b border-border/50 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}>{t.label}</button>
        ))}
      </div>

      {tab === 'resumo'      && <TabResumo canVis={canVis} />}
      {tab === 'headcount'   && <TabHeadcount canVis={canVis} />}
      {tab === 'turnover'    && <TabTurnover canVis={canVis} />}
      {tab === 'absenteismo' && <TabAbsenteismo canVis={canVis} />}
      {tab === 'desempenho'  && <TabDesempenho canVis={canVis} />}
      {tab === 'folha'       && <TabFolhaBeneficios canVis={canVis} />}
    </div>
  )
}
