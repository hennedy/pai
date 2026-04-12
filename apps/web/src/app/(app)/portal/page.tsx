'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  User, FileText, UmbrellaOff, ReceiptText, Gift, Stethoscope,
  Clock, Target, Megaphone, RefreshCw, CheckCircle, Pin,
  TrendingUp, AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'inicio' | 'perfil' | 'holerites' | 'ferias' | 'documentos' | 'comunicados' | 'metas' | 'ponto' | 'beneficios' | 'exames'

function fmtDate(d?: string | null) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—' }
function fmtCurrency(v?: number | null) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtMin(m: number) {
  const h = Math.floor(m / 60), min = m % 60
  return `${h}h${min.toString().padStart(2, '0')}`
}

// ─── Tab Início ───────────────────────────────────────────────────────────────

function TabInicio({ colab, setTab }: { colab: any; setTab: (t: Tab) => void }) {
  const now = new Date()
  const comp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const { data: comunicados } = useQuery({
    queryKey: ['portal', 'comunicados', 1],
    queryFn: () => api.get('/portal/me/comunicados', { page: 1, limit: 3 }) as Promise<{ items: any[] }>,
  })

  const { data: metas } = useQuery({
    queryKey: ['portal', 'metas'],
    queryFn: () => api.get('/portal/me/metas') as Promise<any[]>,
  })

  const { data: ponto } = useQuery({
    queryKey: ['portal', 'ponto', comp],
    queryFn: () => api.get('/portal/me/ponto', { competencia: comp }) as Promise<any>,
  })

  const PRIORIDADE_COLORS: Record<string, string> = {
    urgente: 'text-red-400', importante: 'text-amber-400', normal: 'text-muted-foreground',
  }

  return (
    <div className="space-y-6">
      {/* Boas-vindas */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
            {colab?.fotoUrl
              ? <img src={colab.fotoUrl} alt={colab.nome} className="h-full w-full object-cover" />
              : <span className="text-xl font-bold text-muted-foreground">
                  {(colab?.nomeSocial || colab?.nome || '').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
            }
          </div>
          <div>
            <h2 className="text-lg font-bold">Olá, {(colab?.nomeSocial || colab?.nome)?.split(' ')[0]}!</h2>
            <p className="text-sm text-muted-foreground">{colab?.cargo?.nome} · {colab?.unit?.nome}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Matrícula: {colab?.matricula}</p>
          </div>
        </div>
      </div>

      {/* Cards rápidos */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button onClick={() => setTab('holerites')} className="rounded-xl border bg-card p-4 text-left hover:bg-accent/50 transition-colors">
          <ReceiptText className="h-5 w-5 text-indigo-400 mb-2" />
          <p className="text-sm font-medium">Holerites</p>
          <p className="text-xs text-muted-foreground mt-0.5">Ver contracheques</p>
        </button>
        <button onClick={() => setTab('ferias')} className="rounded-xl border bg-card p-4 text-left hover:bg-accent/50 transition-colors">
          <UmbrellaOff className="h-5 w-5 text-green-400 mb-2" />
          <p className="text-sm font-medium">Férias</p>
          <p className="text-xs text-muted-foreground mt-0.5">Saldos e solicitações</p>
        </button>
        <button onClick={() => setTab('documentos')} className="rounded-xl border bg-card p-4 text-left hover:bg-accent/50 transition-colors">
          <FileText className="h-5 w-5 text-blue-400 mb-2" />
          <p className="text-sm font-medium">Documentos</p>
          <p className="text-xs text-muted-foreground mt-0.5">Contratos e declarações</p>
        </button>
        <button onClick={() => setTab('beneficios')} className="rounded-xl border bg-card p-4 text-left hover:bg-accent/50 transition-colors">
          <Gift className="h-5 w-5 text-amber-400 mb-2" />
          <p className="text-sm font-medium">Benefícios</p>
          <p className="text-xs text-muted-foreground mt-0.5">Meus benefícios ativos</p>
        </button>
        <button onClick={() => setTab('exames')} className="rounded-xl border bg-card p-4 text-left hover:bg-accent/50 transition-colors">
          <Stethoscope className="h-5 w-5 text-teal-400 mb-2" />
          <p className="text-sm font-medium">Exames (ASO)</p>
          <p className="text-xs text-muted-foreground mt-0.5">Histórico ocupacional</p>
        </button>
        <button onClick={() => setTab('ponto')} className="rounded-xl border bg-card p-4 text-left hover:bg-accent/50 transition-colors">
          <Clock className="h-5 w-5 text-violet-400 mb-2" />
          <p className="text-sm font-medium">Ponto</p>
          <p className="text-xs text-muted-foreground mt-0.5">Registros do mês</p>
        </button>
      </div>

      {/* Comunicados recentes */}
      {(comunicados?.items?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Comunicados recentes</h3>
            <Button variant="ghost" size="sm" onClick={() => setTab('comunicados')}>Ver todos</Button>
          </div>
          <div className="space-y-2">
            {comunicados!.items.map((c: any) => (
              <div key={c.id} className={cn('rounded-lg border bg-card p-3 flex items-start gap-3', !c.lido && 'border-primary/30')}>
                {c.fixado && <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />}
                <Megaphone className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', PRIORIDADE_COLORS[c.prioridade])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(c.publicadoEm)}</p>
                </div>
                {!c.lido && <span className="text-xs text-primary font-medium shrink-0">Novo</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resumo de ponto */}
      {ponto?.fechamento && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Ponto — {comp}</h3>
          <div className="rounded-xl border bg-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Trabalhado</p><p className="font-semibold">{fmtMin((ponto.fechamento.totalHorasTrabalhadas ?? 0) * 60)}</p></div>
            <div><p className="text-xs text-muted-foreground">H. Extra</p><p className="font-semibold text-blue-400">{fmtMin((ponto.fechamento.totalHorasExtras ?? 0) * 60)}</p></div>
            <div><p className="text-xs text-muted-foreground">Faltas</p><p className="font-semibold text-red-400">{ponto.fechamento.totalFaltas ?? 0}d</p></div>
            <div><p className="text-xs text-muted-foreground">Status</p><p className="font-semibold capitalize">{ponto.fechamento.status}</p></div>
          </div>
        </div>
      )}

      {/* Metas ativas */}
      {(metas?.filter((m: any) => m.status === 'em_andamento').length ?? 0) > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Minhas metas ativas</h3>
            <Button variant="ghost" size="sm" onClick={() => setTab('metas')}>Ver todas</Button>
          </div>
          <div className="space-y-2">
            {metas!.filter((m: any) => m.status === 'em_andamento').slice(0, 3).map((meta: any) => (
              <div key={meta.id} className="rounded-lg border bg-card p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{meta.titulo}</span>
                  {meta.ciclo && <span className="text-xs text-muted-foreground">{meta.ciclo.periodoRef}</span>}
                </div>
                {meta.metaValor && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{meta.valorAtual} {meta.unidade} de {meta.metaValor} {meta.unidade}</span>
                      <span>{Math.round((meta.valorAtual / meta.metaValor) * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/40">
                      <div className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, Math.round((meta.valorAtual / meta.metaValor) * 100))}%` }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab Perfil ───────────────────────────────────────────────────────────────

function TabPerfil({ colab }: { colab: any }) {
  const [section, setSection] = useState<string | null>('pessoal')

  const sections = [
    { id: 'pessoal', label: 'Dados Pessoais' },
    { id: 'endereco', label: 'Endereço' },
    { id: 'contatos', label: 'Contatos de Emergência' },
    { id: 'dependentes', label: 'Dependentes' },
    { id: 'formacoes', label: 'Formação Acadêmica' },
  ]

  if (!colab) return <div className="text-sm text-muted-foreground py-6 text-center">Carregando...</div>

  return (
    <div className="space-y-3">
      {sections.map((s) => (
        <div key={s.id} className="rounded-xl border bg-card overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/30 transition-colors"
            onClick={() => setSection(section === s.id ? null : s.id)}
          >
            {s.label}
            {section === s.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>

          {section === s.id && (
            <div className="px-4 pb-4 pt-1 border-t border-border/50">
              {s.id === 'pessoal' && (
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  {[
                    ['Nome', colab.nome], ['Nome social', colab.nomeSocial],
                    ['Matrícula', colab.matricula], ['Cargo', colab.cargo?.nome],
                    ['Tipo de contrato', colab.tipoContrato], ['Admissão', fmtDate(colab.dataAdmissao)],
                    ['E-mail', colab.email], ['E-mail corporativo', colab.emailCorporativo],
                    ['Telefone', colab.telefone], ['Celular', colab.celular],
                  ].map(([label, val]) => val ? (
                    <div key={label as string}><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{val}</p></div>
                  ) : null)}
                </div>
              )}

              {s.id === 'endereco' && colab.endereco && (
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  {[
                    ['CEP', colab.endereco.cep], ['Logradouro', colab.endereco.logradouro],
                    ['Número', colab.endereco.numero], ['Complemento', colab.endereco.complemento],
                    ['Bairro', colab.endereco.bairro], ['Cidade', colab.endereco.cidade],
                    ['UF', colab.endereco.uf],
                  ].map(([l, v]) => v ? (
                    <div key={l as string}><p className="text-xs text-muted-foreground">{l}</p><p className="font-medium">{v}</p></div>
                  ) : null)}
                </div>
              )}

              {s.id === 'contatos' && (
                colab.contatosEmergencia?.length
                  ? colab.contatosEmergencia.map((c: any) => (
                    <div key={c.id} className="flex flex-wrap gap-4 text-sm py-2 border-b last:border-0 border-border/30">
                      <div><p className="text-xs text-muted-foreground">Nome</p><p className="font-medium">{c.nome}</p></div>
                      <div><p className="text-xs text-muted-foreground">Parentesco</p><p className="font-medium">{c.parentesco}</p></div>
                      <div><p className="text-xs text-muted-foreground">Telefone</p><p className="font-medium">{c.telefone}</p></div>
                    </div>
                  ))
                  : <p className="text-sm text-muted-foreground py-2">Nenhum contato cadastrado</p>
              )}

              {s.id === 'dependentes' && (
                colab.dependentes?.length
                  ? colab.dependentes.map((d: any) => (
                    <div key={d.id} className="flex flex-wrap gap-4 text-sm py-2 border-b last:border-0 border-border/30">
                      <div><p className="text-xs text-muted-foreground">Nome</p><p className="font-medium">{d.nome}</p></div>
                      <div><p className="text-xs text-muted-foreground">Parentesco</p><p className="font-medium">{d.parentesco}</p></div>
                      {d.dataNascimento && <div><p className="text-xs text-muted-foreground">Nascimento</p><p className="font-medium">{fmtDate(d.dataNascimento)}</p></div>}
                    </div>
                  ))
                  : <p className="text-sm text-muted-foreground py-2">Nenhum dependente cadastrado</p>
              )}

              {s.id === 'formacoes' && (
                colab.formacoes?.length
                  ? colab.formacoes.map((f: any) => (
                    <div key={f.id} className="text-sm py-2 border-b last:border-0 border-border/30">
                      <p className="font-medium">{f.curso}</p>
                      <p className="text-xs text-muted-foreground">{f.instituicao} · {f.nivel} · {f.anoConclusao ?? 'Em curso'}</p>
                    </div>
                  ))
                  : <p className="text-sm text-muted-foreground py-2">Nenhuma formação cadastrada</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Tab Holerites ────────────────────────────────────────────────────────────

function TabHolerites() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'holerites'],
    queryFn: () => api.get('/portal/me/holerites', { limit: 24 }) as Promise<{ items: any[] }>,
  })

  if (isLoading) return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-2">
      {!data?.items?.length
        ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum holerite disponível</p>
        : data.items.map((h: any) => (
          <div key={h.id} className="rounded-xl border bg-card p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">{h.competencia}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Bruto: {fmtCurrency(h.salarioBruto)} · Líquido: <span className="text-green-400 font-medium">{fmtCurrency(h.salarioLiquido)}</span></p>
            </div>
            {h.arquivoUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={h.arquivoUrl} target="_blank" rel="noopener noreferrer"><FileText className="h-3.5 w-3.5 mr-1" /> PDF</a>
              </Button>
            )}
          </div>
        ))
      }
    </div>
  )
}

// ─── Tab Férias ───────────────────────────────────────────────────────────────

function TabFerias() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'ferias'],
    queryFn: () => api.get('/portal/me/ferias') as Promise<{ periodos: any[]; ferias: any[] }>,
  })

  const STATUS_COLORS: Record<string, string> = {
    aprovado: 'text-green-400', solicitado: 'text-amber-400',
    gozando: 'text-blue-400', concluido: 'text-muted-foreground',
    cancelado: 'text-red-400', reprovado: 'text-red-400',
  }

  if (isLoading) return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      {/* Períodos aquisitivos */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Períodos Aquisitivos</h3>
        <div className="space-y-2">
          {!data?.periodos?.length
            ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhum período aquisitivo</p>
            : data.periodos.map((p: any) => (
              <div key={p.id} className="rounded-xl border bg-card p-4 flex flex-wrap gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Período {p.numero}</p><p className="font-medium">{fmtDate(p.dataInicio)} — {fmtDate(p.dataFim)}</p></div>
                <div><p className="text-xs text-muted-foreground">Dias disponíveis</p><p className="font-bold text-green-400">{30 - (p.diasGozados ?? 0) - (p.diasVendidos ?? 0)}d</p></div>
                <div><p className="text-xs text-muted-foreground">Gozados</p><p className="font-medium">{p.diasGozados ?? 0}d</p></div>
                <div><p className="text-xs text-muted-foreground">Vendidos</p><p className="font-medium">{p.diasVendidos ?? 0}d</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><p className="font-medium capitalize">{p.status?.replace('_', ' ')}</p></div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Histórico de férias */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Histórico de Férias</h3>
        <div className="space-y-2">
          {!data?.ferias?.length
            ? <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma férias registrada</p>
            : data.ferias.map((f: any) => (
              <div key={f.id} className="rounded-xl border bg-card p-4 text-sm flex flex-wrap gap-4 items-center">
                <div><p className="text-xs text-muted-foreground">Período</p><p className="font-medium">{fmtDate(f.dataInicio)} — {fmtDate(f.dataFim)}</p></div>
                <div><p className="text-xs text-muted-foreground">Dias</p><p className="font-medium">{f.diasGozados}d</p></div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className={cn('font-medium capitalize', STATUS_COLORS[f.status] ?? '')}>{f.status?.replace('_', ' ')}</p>
                </div>
                {f.aprovadoPor && <div><p className="text-xs text-muted-foreground">Aprovado por</p><p className="font-medium">{f.aprovadoPor.nome}</p></div>}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── Tab Documentos ───────────────────────────────────────────────────────────

function TabDocumentos() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'documentos'],
    queryFn: () => api.get('/portal/me/documentos') as Promise<any[]>,
  })

  if (isLoading) return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-2">
      {!data?.length
        ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento disponível</p>
        : data.map((d: any) => (
          <div key={d.id} className="rounded-xl border bg-card p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-400 shrink-0" />
              <div>
                <p className="text-sm font-medium">{d.titulo}</p>
                <p className="text-xs text-muted-foreground capitalize">{d.tipo?.replace(/_/g, ' ')} · {fmtDate(d.createdAt)}</p>
                {d.dataVencimento && <p className="text-xs text-amber-400">Vence: {fmtDate(d.dataVencimento)}</p>}
              </div>
            </div>
            {d.arquivoUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={d.arquivoUrl} target="_blank" rel="noopener noreferrer">Baixar</a>
              </Button>
            )}
          </div>
        ))
      }
    </div>
  )
}

// ─── Tab Comunicados ──────────────────────────────────────────────────────────

function TabComunicados() {
  const qc = useQueryClient()
  const [detail, setDetail] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'comunicados', 'all'],
    queryFn: () => api.get('/portal/me/comunicados', { limit: 50 }) as Promise<{ items: any[] }>,
  })

  const lerMut = useMutation({
    mutationFn: (id: string) => api.post(`/portal/me/comunicados/${id}/ler`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal', 'comunicados'] }),
  })

  const PRIORIDADE_COLORS: Record<string, string> = {
    urgente: 'border-red-500/30 bg-red-500/5',
    importante: 'border-amber-500/30 bg-amber-500/5',
    normal: '',
  }

  if (isLoading) return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-2">
      {!data?.items?.length
        ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum comunicado disponível</p>
        : data.items.map((c: any) => (
          <div key={c.id} className={cn(
            'rounded-xl border bg-card p-4 flex items-start gap-3 cursor-pointer hover:bg-accent/30 transition-colors',
            PRIORIDADE_COLORS[c.prioridade],
            !c.lido && 'border-l-2 border-l-primary'
          )} onClick={() => {
            setDetail(c)
            if (!c.lido) lerMut.mutate(c.id)
          }}>
            {c.fixado && <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />}
            <Megaphone className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{c.titulo}</p>
                {!c.lido && <span className="text-xs text-primary font-semibold shrink-0">Novo</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(c.publicadoEm)} · {c.criadoPor?.nome}</p>
            </div>
            {c.lido && <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />}
          </div>
        ))
      }

      <Dialog open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null) }}>
        <DialogContent className="max-w-2xl flex flex-col max-h-[90dvh] overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6 pb-4">
            <DialogHeader><DialogTitle>{detail?.titulo}</DialogTitle></DialogHeader>
            {detail && <p className="text-xs text-muted-foreground mt-1">Por {detail.criadoPor?.nome} · {fmtDate(detail.publicadoEm)}</p>}
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-2">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{detail?.conteudo}</p>
            {detail?.arquivoUrl && (
              <Button variant="outline" size="sm" asChild className="mt-4">
                <a href={detail.arquivoUrl} target="_blank" rel="noopener noreferrer">Ver Anexo</a>
              </Button>
            )}
          </div>
          <div className="shrink-0 px-6 py-4 border-t border-border/50 bg-background flex justify-end">
            <Button variant="outline" onClick={() => setDetail(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Tab Metas ────────────────────────────────────────────────────────────────

function TabMetas() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'metas'],
    queryFn: () => api.get('/portal/me/metas') as Promise<any[]>,
  })

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    em_andamento: { label: 'Em Andamento', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
    concluida:    { label: 'Concluída',    color: 'bg-green-500/15 text-green-400 border-green-500/20' },
    nao_atingida: { label: 'Não Atingida', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
    cancelada:    { label: 'Cancelada',    color: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
  }

  if (isLoading) return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-3">
      {!data?.length
        ? <p className="text-sm text-muted-foreground text-center py-8">Nenhuma meta cadastrada</p>
        : data.map((meta: any) => {
          const st = STATUS_CONFIG[meta.status] ?? { label: meta.status, color: '' }
          return (
            <div key={meta.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{meta.titulo}</span>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border', st.color)}>{st.label}</span>
                    {meta.categoria && <span className="text-xs bg-muted/30 px-2 py-0.5 rounded">{meta.categoria}</span>}
                  </div>
                  {meta.ciclo && <p className="text-xs text-muted-foreground mt-0.5">Ciclo: {meta.ciclo.nome} ({meta.ciclo.periodoRef})</p>}
                  {meta.descricao && <p className="text-xs text-muted-foreground mt-0.5">{meta.descricao}</p>}
                  {meta.metaValor && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{meta.valorAtual} {meta.unidade} / {meta.metaValor} {meta.unidade}</span>
                        <span>{Math.min(100, Math.round((meta.valorAtual / meta.metaValor) * 100))}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40">
                        <div className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, Math.round((meta.valorAtual / meta.metaValor) * 100))}%` }} />
                      </div>
                    </div>
                  )}
                  {meta.dataLimite && <p className="text-xs text-muted-foreground mt-1">Prazo: {fmtDate(meta.dataLimite)}</p>}
                </div>
              </div>
            </div>
          )
        })
      }
    </div>
  )
}

// ─── Tab Ponto ────────────────────────────────────────────────────────────────

function TabPonto() {
  const now = new Date()
  const [comp, setComp] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'ponto', comp],
    queryFn: () => api.get('/portal/me/ponto', { competencia: comp }) as Promise<any>,
  })

  const TIPO_LABELS: Record<string, string> = {
    entrada: 'Entrada', saida_almoco: 'Saída Almoço', retorno_almoco: 'Retorno Almoço',
    saida: 'Saída', entrada_extra: 'Entrada Extra', saida_extra: 'Saída Extra',
  }

  if (isLoading) return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <input type="month" value={comp} onChange={(e) => setComp(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm" />
      </div>

      {data?.fechamento && (
        <div className="rounded-xl border bg-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-muted-foreground">Horas trabalhadas</p><p className="font-bold">{fmtMin((data.fechamento.totalHorasTrabalhadas ?? 0) * 60)}</p></div>
          <div><p className="text-xs text-muted-foreground">Horas extras</p><p className="font-bold text-blue-400">{fmtMin((data.fechamento.totalHorasExtras ?? 0) * 60)}</p></div>
          <div><p className="text-xs text-muted-foreground">Faltas</p><p className="font-bold text-red-400">{data.fechamento.totalFaltas ?? 0} dia(s)</p></div>
          <div><p className="text-xs text-muted-foreground">Status</p><p className="font-bold capitalize">{data.fechamento.status}</p></div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-3">Registros ({data?.registros?.length ?? 0})</h3>
        {!data?.registros?.length
          ? <p className="text-sm text-muted-foreground py-4 text-center border rounded-xl border-dashed">Nenhum registro neste mês</p>
          : <div className="space-y-1.5">
            {data.registros.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-mono text-xs bg-muted/30 px-2 py-0.5 rounded">
                  {new Date(r.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xs">{new Date(r.dataHora).toLocaleDateString('pt-BR')}</span>
                <span className="text-xs bg-muted/30 px-2 py-0.5 rounded">{TIPO_LABELS[r.tipo] ?? r.tipo}</span>
                {r.status === 'ajustado' && <span className="text-xs text-amber-400 ml-auto">Ajustado</span>}
              </div>
            ))}
          </div>
        }
      </div>
    </div>
  )
}

// ─── Tab Benefícios ───────────────────────────────────────────────────────────

function TabBeneficios() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'beneficios'],
    queryFn: () => api.get('/portal/me/beneficios') as Promise<any[]>,
  })

  if (isLoading) return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-2">
      {!data?.length
        ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum benefício ativo</p>
        : data.map((b: any) => (
          <div key={b.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <Gift className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">{b.beneficio?.nome}</p>
                <p className="text-xs text-muted-foreground capitalize">{b.beneficio?.tipo?.replace(/_/g, ' ')} · {b.beneficio?.operadora ?? '—'}</p>
                {b.valorColaborador && <p className="text-xs text-muted-foreground mt-0.5">Desconto: {fmtCurrency(b.valorColaborador)}/mês</p>}
                <p className="text-xs text-muted-foreground">Desde: {fmtDate(b.dataInicio)}</p>
              </div>
            </div>
          </div>
        ))
      }
    </div>
  )
}

// ─── Tab Exames ───────────────────────────────────────────────────────────────

function TabExames() {
  const { data, isLoading } = useQuery({
    queryKey: ['portal', 'exames'],
    queryFn: () => api.get('/portal/me/exames') as Promise<any[]>,
  })

  const TIPO_LABELS: Record<string, string> = {
    admissional: 'Admissional', periodico: 'Periódico', retorno_trabalho: 'Retorno',
    mudanca_funcao: 'Mudança de Função', demissional: 'Demissional',
  }
  const RESULTADO_COLORS: Record<string, string> = {
    apto: 'text-green-400', apto_com_restricoes: 'text-amber-400', inapto: 'text-red-400',
  }

  if (isLoading) return <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-2">
      {!data?.length
        ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum exame registrado</p>
        : data.map((e: any) => (
          <div key={e.id} className="rounded-xl border bg-card p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Stethoscope className="h-5 w-5 text-teal-400 shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{TIPO_LABELS[e.tipo] ?? e.tipo}</p>
                  {e.resultado && <span className={cn('text-xs font-medium', RESULTADO_COLORS[e.resultado] ?? '')}>{e.resultado.replace(/_/g, ' ')}</span>}
                </div>
                <p className="text-xs text-muted-foreground">{fmtDate(e.dataExame)} {e.dataVencimento ? `· Vence: ${fmtDate(e.dataVencimento)}` : ''}</p>
                {e.restricoes && <p className="text-xs text-amber-400 mt-0.5">Restrição: {e.restricoes}</p>}
              </div>
            </div>
            {e.arquivoUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={e.arquivoUrl} target="_blank" rel="noopener noreferrer">Laudo</a>
              </Button>
            )}
          </div>
        ))
      }
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TAB_ITEMS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'inicio',      label: 'Início',       icon: User },
  { id: 'perfil',      label: 'Meu Perfil',   icon: User },
  { id: 'holerites',   label: 'Holerites',    icon: ReceiptText },
  { id: 'ferias',      label: 'Férias',       icon: UmbrellaOff },
  { id: 'documentos',  label: 'Documentos',   icon: FileText },
  { id: 'comunicados', label: 'Comunicados',  icon: Megaphone },
  { id: 'metas',       label: 'Metas',        icon: TrendingUp },
  { id: 'ponto',       label: 'Ponto',        icon: Clock },
  { id: 'beneficios',  label: 'Benefícios',   icon: Gift },
  { id: 'exames',      label: 'Exames',       icon: Stethoscope },
]

export default function PortalPage() {
  const [tab, setTab] = useState<Tab>('inicio')

  const { data: colab, isLoading, error } = useQuery({
    queryKey: ['portal', 'me'],
    queryFn: () => api.get('/portal/me') as Promise<any>,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !colab) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400" />
        <p className="font-semibold">Perfil de colaborador não encontrado</p>
        <p className="text-sm text-muted-foreground max-w-xs">Seu usuário ainda não está vinculado a um colaborador. Solicite ao RH que faça o vínculo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portal do Colaborador</h1>
        <p className="text-muted-foreground text-sm mt-1">Seus dados, documentos e informações de RH</p>
      </div>

      {/* Tabs — scrollable */}
      <div className="flex gap-1 border-b border-border/50 overflow-x-auto scrollbar-hide">
        {TAB_ITEMS.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'inicio'      && <TabInicio colab={colab} setTab={setTab} />}
      {tab === 'perfil'      && <TabPerfil colab={colab} />}
      {tab === 'holerites'   && <TabHolerites />}
      {tab === 'ferias'      && <TabFerias />}
      {tab === 'documentos'  && <TabDocumentos />}
      {tab === 'comunicados' && <TabComunicados />}
      {tab === 'metas'       && <TabMetas />}
      {tab === 'ponto'       && <TabPonto />}
      {tab === 'beneficios'  && <TabBeneficios />}
      {tab === 'exames'      && <TabExames />}
    </div>
  )
}
