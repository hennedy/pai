'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import {
  Save, ArrowLeft, Plus, LayoutTemplate, Settings2,
  GripVertical, Trash2, Camera, AlertTriangle, RepeatIcon, CalendarDays,
  Smartphone, Tag, X, CheckSquare, Type, Hash, Star, Package, Image,
  BanIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BuilderItem {
  id: string
  descricao: string
  tipo: string
  obrigatorio: boolean
  exigeFoto: boolean
  exigeObservacao: boolean
  isCritico: boolean
  peso: number
  rotulos: string[]
  responsavelId: string
}

type RecorrenciaTipo = 'sem_agendamento' | 'diario' | 'semanal' | 'mensal' | 'anual' | 'data_especifica'

interface Recorrencia {
  tipo: RecorrenciaTipo
  diasSemana: number[]
  intervaloSemanas: number
  diaDoMes: number
  mesAnual: number
  diaAnual: number
  datasEspecificas: string[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const itemTypeLabels: Record<string, string> = {
  checkbox: 'Confirmação (Feito/Não Feito)',
  texto: 'Texto Curto',
  foto: 'Tirar Foto Obrigatoriamente',
  numero: 'Valor Numérico (Medição)',
  estoque: 'Contagem de Estoque',
  estrelas: 'Avaliação (1 a 5 Estrelas)',
}

const itemTypeIcons: Record<string, React.ReactNode> = {
  checkbox: <CheckSquare className="h-4 w-4" />,
  texto: <Type className="h-4 w-4" />,
  foto: <Image className="h-4 w-4" />,
  numero: <Hash className="h-4 w-4" />,
  estoque: <Package className="h-4 w-4" />,
  estrelas: <Star className="h-4 w-4" />,
}

const DIAS_SEMANA = [
  { label: 'Dom', value: 0 },
  { label: 'Seg', value: 1 },
  { label: 'Ter', value: 2 },
  { label: 'Qua', value: 3 },
  { label: 'Qui', value: 4 },
  { label: 'Sex', value: 5 },
  { label: 'Sab', value: 6 },
]

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

const RECORRENCIA_OPTIONS: { value: RecorrenciaTipo; label: string; desc: string }[] = [
  { value: 'sem_agendamento', label: 'Sem agendamento', desc: 'Acionado manualmente' },
  { value: 'diario',          label: 'Diário',           desc: 'Repete todos os dias' },
  { value: 'semanal',         label: 'Semanal',          desc: 'Repete nos dias escolhidos' },
  { value: 'mensal',          label: 'Mensal',           desc: 'Repete num dia fixo do mês' },
  { value: 'anual',           label: 'Anual',            desc: 'Repete uma vez por ano' },
  { value: 'data_especifica', label: 'Data específica',  desc: 'Datas exatas pré-definidas' },
]

const EMPTY_RECORRENCIA: Recorrencia = {
  tipo: 'diario',
  diasSemana: [],
  intervaloSemanas: 1,
  diaDoMes: 1,
  mesAnual: 1,
  diaAnual: 1,
  datasEspecificas: [],
}

const ROTULOS_PADRAO = ['Conforme', 'Não conforme', 'Parcial', 'N/A']

// ─── Mobile Preview Component ────────────────────────────────────────────────

function MobilePreview({ items, templateNome }: { items: BuilderItem[]; templateNome: string }) {
  return (
    <div className="sticky top-24">
      <div className="flex items-center gap-2 text-muted-foreground mb-3">
        <Smartphone className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">Prévia Mobile</span>
      </div>

      {/* Phone frame */}
      <div className="mx-auto w-[220px] bg-slate-900 rounded-[32px] p-2 shadow-2xl">
        <div className="bg-background rounded-[24px] overflow-hidden">
          {/* Status bar */}
          <div className="bg-slate-900 h-6 flex items-center justify-center">
            <div className="w-16 h-1.5 bg-slate-700 rounded-full" />
          </div>

          {/* App header */}
          <div className="bg-amber-500 px-3 py-2.5">
            <p className="text-white text-xs font-bold truncate">{templateNome || 'Checklist'}</p>
            <p className="text-amber-100 text-[9px]">Hoje • Pendente</p>
          </div>

          {/* Items list */}
          <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-6 text-center text-[10px] text-muted-foreground px-3">
                Adicione itens para visualizar
              </div>
            ) : (
              items.map((item, idx) => (
                <div key={item.id} className="px-3 py-2.5 space-y-1.5">
                  <div className="flex items-start gap-1.5">
                    <span className={cn(
                      'mt-0.5 shrink-0',
                      item.isCritico ? 'text-red-500' : 'text-amber-500'
                    )}>
                      {itemTypeIcons[item.tipo] || <CheckSquare className="h-3 w-3" />}
                    </span>
                    <p className="text-[10px] font-medium leading-tight flex-1">
                      {item.descricao || `Item ${idx + 1}`}
                      {item.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
                    </p>
                  </div>

                  {/* Input preview by type */}
                  {item.tipo === 'checkbox' && (
                    <div className="flex gap-1 ml-5">
                      {item.rotulos.length > 0 ? (
                        item.rotulos.map(r => (
                          <span key={r} className="text-[8px] px-1.5 py-0.5 rounded bg-accent border border-border/60 truncate max-w-[50px]">{r}</span>
                        ))
                      ) : (
                        <>
                          <div className="h-4 w-10 rounded bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center">
                            <span className="text-[8px] text-emerald-600 font-bold">Sim</span>
                          </div>
                          <div className="h-4 w-10 rounded bg-red-100 dark:bg-red-900/30 border border-red-200 flex items-center justify-center">
                            <span className="text-[8px] text-red-500 font-bold">Não</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {item.tipo === 'texto' && (
                    <div className="ml-5 h-5 rounded bg-accent border border-border/60 text-[8px] text-muted-foreground px-1.5 flex items-center">
                      Digitar observação...
                    </div>
                  )}
                  {item.tipo === 'numero' && (
                    <div className="ml-5 h-5 w-14 rounded bg-accent border border-border/60 text-[8px] text-muted-foreground px-1.5 flex items-center">
                      0.00
                    </div>
                  )}
                  {item.tipo === 'estrelas' && (
                    <div className="ml-5 flex gap-0.5">
                      {[1,2,3,4,5].map(s => <Star key={s} className="h-3 w-3 text-amber-300" />)}
                    </div>
                  )}
                  {item.tipo === 'foto' && (
                    <div className="ml-5 h-8 w-16 rounded bg-accent border border-dashed border-border flex items-center justify-center">
                      <Camera className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                  {item.tipo === 'estoque' && (
                    <div className="ml-5 flex items-center gap-1">
                      <div className="h-4 w-4 rounded bg-accent border border-border text-[8px] flex items-center justify-center">-</div>
                      <div className="h-4 w-8 rounded bg-accent border border-border text-[8px] flex items-center justify-center">0</div>
                      <div className="h-4 w-4 rounded bg-accent border border-border text-[8px] flex items-center justify-center">+</div>
                    </div>
                  )}

                  {item.exigeFoto && item.tipo !== 'foto' && (
                    <div className="ml-5 flex items-center gap-1 text-[8px] text-emerald-600">
                      <Camera className="h-2.5 w-2.5" />
                      Foto obrigatória
                    </div>
                  )}
                  {item.isCritico && (
                    <div className="ml-5 flex items-center gap-1 text-[8px] text-red-500">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      Item crítico
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer button */}
          <div className="p-2.5 border-t border-border/40">
            <div className="w-full h-7 bg-amber-500 rounded-xl flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">Finalizar Checklist</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ChecklistBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const isEditMode = !!editId
  const { selectedUnitId } = useAuthStore()

  const generateId = () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36)

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: unitsData } = useQuery({
    queryKey: ['units', 'simple'],
    queryFn: () => api.get('/units', { limit: 100 }) as Promise<{ data: any[] }>,
  })
  const units: any[] = unitsData?.data || []

  // ─── State ───────────────────────────────────────────────────────────────

  const [loaded, setLoaded] = useState(false)

  const [templateForm, setTemplateForm] = useState({
    nome: '',
    unitId: selectedUnitId || '',
    sectorId: '',
    atribuidoAId: '',
    responsavelColabId: '',
    horario: 'abertura',
    obrigatorio: true,
    tempoLimiteMinutos: '',
  })

  const { data: sectorsData } = useQuery({
    queryKey: ['sectors', templateForm.unitId],
    queryFn: () => api.get(`/units/${templateForm.unitId}/sectors`) as Promise<{ data: any[] }>,
    enabled: !!templateForm.unitId,
  })
  const sectors: any[] = sectorsData?.data || []

  const { data: colaboradoresData } = useQuery({
    queryKey: ['colaboradores-lookup', templateForm.unitId],
    queryFn: () => api.get('/rh/colaboradores/lookup', { status: 'ativo', ...(templateForm.unitId ? { unitId: templateForm.unitId } : {}) }) as Promise<{ data: any[] }>,
  })
  const colaboradores: any[] = colaboradoresData?.data || []

  const [recorrencia, setRecorrencia] = useState<Recorrencia>(EMPTY_RECORRENCIA)
  const [datasExcecao, setDatasExcecao] = useState<string[]>([])
  const [novoRotuloInput, setNovoRotuloInput] = useState<string>('')

  const [items, setItems] = useState<BuilderItem[]>([
    {
      id: generateId(),
      descricao: '',
      tipo: 'checkbox',
      obrigatorio: true,
      exigeFoto: false,
      exigeObservacao: false,
      responsavelId: '',
      isCritico: false,
      peso: 1,
      rotulos: [],
    }
  ])

  // Carregar template existente para edicao
  const { data: editData } = useQuery({
    queryKey: ['checklist-template-edit', editId],
    queryFn: () => api.get(`/checklist/templates/${editId}`),
    enabled: isEditMode,
  })

  useEffect(() => {
    if (!editData || loaded) return
    const t = editData

    setTemplateForm({
      nome: t.nome || '',
      unitId: t.unitId || '',
      sectorId: t.sectorId || '',
      atribuidoAId: t.atribuidoAId || '',
      responsavelColabId: t.responsavelColabId || '',
      horario: t.horario || 'abertura',
      obrigatorio: t.obrigatorio ?? true,
      tempoLimiteMinutos: t.tempoLimiteMinutos ? String(t.tempoLimiteMinutos) : '',
    })

    if (t.recorrencia) {
      const r = t.recorrencia
      setRecorrencia({
        tipo: r.tipo || 'diario',
        diasSemana: r.diasSemana || [],
        intervaloSemanas: r.intervaloSemanas || 1,
        diaDoMes: r.diasMes?.[0] || 1,
        mesAnual: r.mes || 1,
        diaAnual: r.dia || 1,
        datasEspecificas: r.datas || [],
      })
    } else {
      setRecorrencia({ ...EMPTY_RECORRENCIA, tipo: 'sem_agendamento' })
    }

    if (t.datasExcecao) setDatasExcecao(t.datasExcecao)

    if (t.items?.length > 0) {
      setItems(t.items.map((item: any) => ({
        id: generateId(),
        descricao: item.descricao,
        tipo: item.tipo,
        obrigatorio: item.obrigatorio,
        exigeFoto: item.exigeFoto,
        exigeObservacao: item.exigeObservacao,
        isCritico: item.isCritico,
        peso: item.peso,
        rotulos: item.rotulos || [],
        responsavelId: item.responsavelId || '',
      })))
    }

    setLoaded(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editData])

  // ─── Mutation ────────────────────────────────────────────────────────────

  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => api.post('/checklist/templates', data),
    onSuccess: () => {
      toast.success('Checklist criado com sucesso!')
      router.push('/checklist/templates')
    },
    onError: (err: any) => toast.error(err?.error || err.message || 'Erro ao criar checklist'),
  })

  const updateTemplateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/checklist/templates/${editId}`, data),
    onSuccess: () => {
      toast.success('Checklist atualizado com sucesso!')
      router.push('/checklist/templates')
    },
    onError: (err: any) => toast.error(err?.error || err.message || 'Erro ao atualizar checklist'),
  })

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function buildRecorrencia() {
    if (recorrencia.tipo === 'sem_agendamento') return null

    const base: any = { tipo: recorrencia.tipo }

    if (recorrencia.tipo === 'semanal') {
      if (recorrencia.diasSemana.length === 0) {
        toast.error('Selecione pelo menos um dia da semana')
        return undefined
      }
      base.diasSemana = recorrencia.diasSemana
      if (recorrencia.intervaloSemanas > 1) base.intervaloSemanas = recorrencia.intervaloSemanas
    }

    if (recorrencia.tipo === 'mensal') {
      base.diasMes = [recorrencia.diaDoMes]
    }

    if (recorrencia.tipo === 'anual') {
      base.mes = recorrencia.mesAnual
      base.dia = recorrencia.diaAnual
    }

    if (recorrencia.tipo === 'data_especifica') {
      if (recorrencia.datasEspecificas.length === 0) {
        toast.error('Adicione pelo menos uma data específica')
        return undefined
      }
      base.datas = recorrencia.datasEspecificas
    }

    return base
  }

  function handleSave() {
    if (!templateForm.nome.trim()) return toast.error('Nome do template é obrigatório')
    if (!templateForm.unitId) return toast.error('Selecione a unidade')
    if (items.some(i => !i.descricao.trim())) return toast.error('Todos os itens precisam ter descrição')

    const recorrenciaFinal = buildRecorrencia()
    if (recorrenciaFinal === undefined) return

    const payload = {
      nome: templateForm.nome,
      unitId: templateForm.unitId,
      sectorId: templateForm.sectorId || null,
      atribuidoAId: templateForm.atribuidoAId || null,
      responsavelColabId: templateForm.responsavelColabId || null,
      horario: templateForm.horario,
      obrigatorio: templateForm.obrigatorio,
      recorrencia: recorrenciaFinal,
      datasExcecao: datasExcecao.length > 0 ? datasExcecao : null,
      tempoLimiteMinutos: templateForm.tempoLimiteMinutos ? Number(templateForm.tempoLimiteMinutos) : null,
      items: items.map((item, idx) => ({
        descricao: item.descricao,
        ordem: idx,
        tipo: item.tipo,
        obrigatorio: item.obrigatorio,
        exigeFoto: item.exigeFoto,
        exigeObservacao: item.exigeObservacao,
        isCritico: item.isCritico,
        peso: item.peso || 1,
        rotulos: item.rotulos.length > 0 ? item.rotulos : null,
        responsavelId: item.responsavelId || null,
      }))
    }

    if (isEditMode) {
      updateTemplateMutation.mutate(payload)
    } else {
      createTemplateMutation.mutate(payload)
    }
  }

  const isSaving = createTemplateMutation.isPending || updateTemplateMutation.isPending

  function addItem() {
    setItems([...items, {
      id: generateId(),
      descricao: '',
      tipo: 'checkbox',
      obrigatorio: true,
      exigeFoto: false,
      exigeObservacao: false,
      isCritico: false,
      peso: 1,
      rotulos: [],
      responsavelId: '',
    }])
  }

  function updateItem(id: string, updates: Partial<BuilderItem>) {
    setItems(items.map(item => item.id === id ? { ...item, ...updates } : item))
  }

  function removeItem(id: string) {
    if (items.length === 1) return toast.error('Checklist deve ter pelo menos um item.')
    setItems(items.filter(item => item.id !== id))
  }

  function toggleDiaSemana(dia: number) {
    setRecorrencia(r => ({
      ...r,
      diasSemana: r.diasSemana.includes(dia)
        ? r.diasSemana.filter(d => d !== dia)
        : [...r.diasSemana, dia].sort((a, b) => a - b),
    }))
  }

  function addDataEspecifica(data: string) {
    if (!data) return
    if (recorrencia.datasEspecificas.includes(data)) return
    setRecorrencia(r => ({ ...r, datasEspecificas: [...r.datasEspecificas, data].sort() }))
  }

  function removeDataEspecifica(data: string) {
    setRecorrencia(r => ({ ...r, datasEspecificas: r.datasEspecificas.filter(d => d !== data) }))
  }

  function addDataExcecao(data: string) {
    if (!data || datasExcecao.includes(data)) return
    setDatasExcecao(prev => [...prev, data].sort())
  }

  function removeDataExcecao(data: string) {
    setDatasExcecao(prev => prev.filter(d => d !== data))
  }

  function addRotuloToItem(itemId: string, rotulo: string) {
    const trimmed = rotulo.trim()
    if (!trimmed) return
    setItems(items.map(item =>
      item.id === itemId && !item.rotulos.includes(trimmed)
        ? { ...item, rotulos: [...item.rotulos, trimmed] }
        : item
    ))
  }

  function removeRotuloFromItem(itemId: string, rotulo: string) {
    setItems(items.map(item =>
      item.id === itemId
        ? { ...item, rotulos: item.rotulos.filter(r => r !== rotulo) }
        : item
    ))
  }

  const selectedOption = RECORRENCIA_OPTIONS.find(o => o.value === recorrencia.tipo)!

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-20">

      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur-md py-4 border-b border-border mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-accent text-muted-foreground transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold">
              {isEditMode ? 'Editar Checklist' : 'Construtor de Checklist'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditMode ? 'Altere os dados do checklist existente' : 'Crie um novo padrão de auditoria/tarefas'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium shadow-warm-sm transition-all hover:shadow-warm-md hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Salvando...' : isEditMode ? 'Salvar alterações' : 'Salvar Template'}
        </button>
      </div>

      {/* Two-column layout: form + mobile preview */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-8">

        {/* ── Left: Form ── */}
        <div className="space-y-6">

          {/* Informações do Template */}
          <div className="bg-card p-6 rounded-2xl border border-border/60 shadow-sm space-y-5">
            <div className="flex items-center gap-2 text-amber-500">
              <LayoutTemplate className="h-5 w-5" />
              <h2 className="text-lg font-bold text-foreground">Informações do Template</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Nome */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-semibold mb-1.5 text-foreground/80">Nome do Checklist *</label>
                <input
                  autoFocus
                  value={templateForm.nome}
                  onChange={e => setTemplateForm(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Auditoria de Fechamento de Caixa"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-all text-base"
                />
              </div>

              {/* Unidade */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground/80">Unidade *</label>
                <select
                  value={templateForm.unitId}
                  onChange={e => setTemplateForm(p => ({ ...p, unitId: e.target.value, sectorId: '' }))}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all',
                    !templateForm.unitId ? 'border-amber-500 text-amber-600' : 'border-border'
                  )}
                >
                  <option value="">-- Selecione a unidade --</option>
                  {units.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.codigo} — {u.nome}</option>
                  ))}
                </select>
              </div>

              {/* Setor */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground/80">Setor</label>
                <select
                  value={templateForm.sectorId}
                  onChange={e => setTemplateForm(p => ({ ...p, sectorId: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                >
                  <option value="">Geral / Nenhum setor</option>
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>

              {/* Responsável padrão */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground/80">Responsável padrão</label>
                <select
                  value={templateForm.responsavelColabId}
                  onChange={e => setTemplateForm(p => ({ ...p, responsavelColabId: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                >
                  <option value="">Sem responsável fixo</option>
                  {colaboradores.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.nomeSocial || c.nome}{c.cargo ? ` — ${c.cargo.nome}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Turno */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground/80">Turno/Horário *</label>
                <select
                  value={templateForm.horario}
                  onChange={e => setTemplateForm(p => ({ ...p, horario: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                >
                  <option value="abertura">Abertura</option>
                  <option value="manha">Manhã</option>
                  <option value="tarde">Tarde</option>
                  <option value="noite">Noite</option>
                  <option value="fechamento">Fechamento</option>
                </select>
              </div>

              {/* Validade */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground/80">Validade (minutos)</label>
                <input
                  type="number"
                  value={templateForm.tempoLimiteMinutos}
                  onChange={e => setTemplateForm(p => ({ ...p, tempoLimiteMinutos: e.target.value }))}
                  placeholder="Ex: 120 (vazio = expira à meia-noite)"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                />
              </div>

              {/* Obrigatório */}
              <div className="flex items-center gap-3 pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templateForm.obrigatorio}
                    onChange={e => setTemplateForm(p => ({ ...p, obrigatorio: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:ring-2 peer-focus:ring-amber-500/30 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                </label>
                <div>
                  <p className="text-sm font-semibold">Obrigatório</p>
                  <p className="text-xs text-muted-foreground">Agendado automaticamente pelo sistema</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Periodicidade / Agendamento ── */}
          <div className="bg-card p-6 rounded-2xl border border-amber-500/30 shadow-sm space-y-5">
            <div className="flex items-center gap-2 text-amber-500">
              <RepeatIcon className="h-5 w-5" />
              <h2 className="text-lg font-bold text-foreground">Regra de Agendamento</h2>
            </div>

            {/* Tipo selector */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {RECORRENCIA_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecorrencia({ ...EMPTY_RECORRENCIA, tipo: opt.value })}
                  className={cn(
                    'flex flex-col items-start gap-0.5 px-3.5 py-3 rounded-xl border text-left transition-all',
                    recorrencia.tipo === opt.value
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                      : 'border-border bg-background text-muted-foreground hover:border-amber-300 hover:text-foreground'
                  )}
                >
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-[10px] leading-tight opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>

            {/* Configuração condicional */}
            {recorrencia.tipo === 'diario' && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 text-sm text-amber-700 dark:text-amber-400">
                <CalendarDays className="h-4 w-4 shrink-0" />
                Será agendado todos os dias para as unidades aplicáveis.
              </div>
            )}

            {recorrencia.tipo === 'semanal' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/80">Dias da semana *</label>
                  <div className="flex flex-wrap gap-2">
                    {DIAS_SEMANA.map(dia => {
                      const active = recorrencia.diasSemana.includes(dia.value)
                      return (
                        <button
                          key={dia.value}
                          type="button"
                          onClick={() => toggleDiaSemana(dia.value)}
                          className={cn(
                            'px-4 py-2 rounded-xl text-sm font-semibold border transition-all touch-manipulation',
                            active
                              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                              : 'bg-card border-border text-muted-foreground hover:border-amber-400 hover:text-foreground'
                          )}
                        >
                          {dia.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Intervalo de semanas */}
                <div className="flex items-center gap-3 max-w-xs">
                  <label className="text-sm font-semibold text-foreground/80 whitespace-nowrap">A cada</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={recorrencia.intervaloSemanas}
                    onChange={e => setRecorrencia(r => ({ ...r, intervaloSemanas: Math.min(52, Math.max(1, Number(e.target.value))) }))}
                    className="w-16 px-3 py-2 rounded-xl border border-border bg-background text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                  />
                  <span className="text-sm text-muted-foreground">
                    {recorrencia.intervaloSemanas === 1 ? 'semana' : 'semanas'}
                  </span>
                </div>
              </div>
            )}

            {recorrencia.tipo === 'mensal' && (
              <div className="space-y-2 max-w-xs">
                <label className="text-sm font-semibold text-foreground/80">Dia do mês *</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={recorrencia.diaDoMes}
                    onChange={e => setRecorrencia(r => ({ ...r, diaDoMes: Math.min(31, Math.max(1, Number(e.target.value))) }))}
                    className="w-24 px-3 py-2.5 rounded-xl border border-border bg-background text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                  />
                  <span className="text-sm text-muted-foreground">de cada mês</span>
                </div>
              </div>
            )}

            {recorrencia.tipo === 'anual' && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/80">Mês *</label>
                  <select
                    value={recorrencia.mesAnual}
                    onChange={e => setRecorrencia(r => ({ ...r, mesAnual: Number(e.target.value) }))}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                  >
                    {MESES.map((m, i) => (
                      <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/80">Dia *</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={recorrencia.diaAnual}
                    onChange={e => setRecorrencia(r => ({ ...r, diaAnual: Math.min(31, Math.max(1, Number(e.target.value))) }))}
                    className="w-20 px-3 py-2.5 rounded-xl border border-border bg-background text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                  />
                </div>
                <p className="text-sm text-muted-foreground pb-2">
                  Todo dia <strong>{recorrencia.diaAnual}</strong> de <strong>{MESES[recorrencia.mesAnual - 1]}</strong>
                </p>
              </div>
            )}

            {recorrencia.tipo === 'data_especifica' && (
              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground/80">Datas *</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    id="builder-data-input"
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addDataEspecifica((e.target as HTMLInputElement).value)
                        ;(e.target as HTMLInputElement).value = ''
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('builder-data-input') as HTMLInputElement
                      addDataEspecifica(input?.value)
                      if (input) input.value = ''
                    }}
                    className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm font-semibold hover:bg-amber-100 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {recorrencia.datasEspecificas.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {recorrencia.datasEspecificas.map(d => (
                      <span key={d} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-sm font-medium text-amber-700 dark:text-amber-300">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')}
                        <button type="button" onClick={() => removeDataEspecifica(d)} className="hover:text-red-500 transition-colors ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Resumo */}
            {recorrencia.tipo !== 'sem_agendamento' && (
              <div className="rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                <strong>Agendamento:</strong> {selectedOption.label}
                {recorrencia.tipo === 'semanal' && recorrencia.diasSemana.length > 0 && (
                  <> — {recorrencia.diasSemana.map(d => DIAS_SEMANA.find(x => x.value === d)?.label).join(', ')}
                    {recorrencia.intervaloSemanas > 1 && ` (a cada ${recorrencia.intervaloSemanas} semanas)`}
                  </>
                )}
                {recorrencia.tipo === 'mensal' && (
                  <> — todo dia {recorrencia.diaDoMes}</>
                )}
                {recorrencia.tipo === 'anual' && (
                  <> — {recorrencia.diaAnual} de {MESES[recorrencia.mesAnual - 1]}</>
                )}
                {recorrencia.tipo === 'data_especifica' && recorrencia.datasEspecificas.length > 0 && (
                  <> — {recorrencia.datasEspecificas.length} data(s)</>
                )}
              </div>
            )}
          </div>

          {/* ── Datas de Exceção ── */}
          <div className="bg-card p-6 rounded-2xl border border-border/60 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-red-500">
              <BanIcon className="h-5 w-5" />
              <h2 className="text-lg font-bold text-foreground">Datas de Exceção</h2>
              <span className="ml-auto text-xs text-muted-foreground">Dias em que este checklist NÃO será gerado</span>
            </div>

            <div className="flex gap-2 items-center">
              <input
                type="date"
                id="excecao-data-input"
                className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addDataExcecao((e.target as HTMLInputElement).value)
                    ;(e.target as HTMLInputElement).value = ''
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('excecao-data-input') as HTMLInputElement
                  addDataExcecao(input?.value)
                  if (input) input.value = ''
                }}
                className="px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm font-semibold hover:bg-red-100 transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {datasExcecao.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {datasExcecao.map(d => (
                  <span key={d} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-sm font-medium text-red-600 dark:text-red-300">
                    <BanIcon className="h-3 w-3" />
                    {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')}
                    <button type="button" onClick={() => removeDataExcecao(d)} className="hover:text-red-700 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma data de exceção configurada</p>
            )}
          </div>

          {/* ── Etapas e Perguntas ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-500">
                <Settings2 className="h-5 w-5" />
                <h2 className="text-lg font-bold text-foreground">Etapas e Perguntas</h2>
              </div>
              <span className="text-sm text-muted-foreground bg-accent px-3 py-1 rounded-full">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="group bg-card p-5 rounded-2xl border border-border/50 shadow-sm hover:border-amber-500/50 transition-all flex gap-3 sm:gap-4 relative"
                >
                  <div className="cursor-grab text-muted-foreground/30 hover:text-foreground/60 active:cursor-grabbing mt-2 hidden sm:block">
                    <GripVertical className="h-5 w-5" />
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <input
                          value={item.descricao}
                          onChange={e => updateItem(item.id, { descricao: e.target.value })}
                          placeholder={`Item ${index + 1}: descreva a tarefa ou pergunta...`}
                          className="w-full text-base font-medium px-0 py-2 border-0 border-b border-border/50 bg-transparent focus:ring-0 focus:border-amber-500 focus:outline-none placeholder-muted-foreground transition"
                        />
                      </div>
                      <div className="sm:w-64">
                        <select
                          value={item.tipo}
                          onChange={e => updateItem(item.id, { tipo: e.target.value })}
                          className="w-full px-4 py-2 rounded-xl border border-border bg-background/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        >
                          {Object.entries(itemTypeLabels).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Flags */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium hover:text-amber-600 transition">
                        <input type="checkbox" checked={item.obrigatorio} onChange={e => updateItem(item.id, { obrigatorio: e.target.checked })} className="rounded accent-amber-500" />
                        Obrigatório
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-emerald-600 transition">
                        <Camera className="h-4 w-4" />
                        <input type="checkbox" checked={item.exigeFoto} onChange={e => updateItem(item.id, { exigeFoto: e.target.checked })} className="rounded accent-emerald-500" />
                        Exigir Foto
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-red-600 transition">
                        <AlertTriangle className="h-4 w-4" />
                        <input type="checkbox" checked={item.isCritico} onChange={e => updateItem(item.id, { isCritico: e.target.checked })} className="rounded accent-red-500" />
                        Atenção Crítica
                      </label>
                      {/* Peso */}
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-muted-foreground">Peso:</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={item.peso}
                          onChange={e => updateItem(item.id, { peso: Math.max(1, Number(e.target.value)) })}
                          className="w-14 px-2 py-1 rounded-lg border border-border bg-background text-sm text-center focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                        />
                      </div>
                    </div>

                    {/* Responsável da etapa */}
                    <div className="pt-1">
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Responsável pela etapa <span className="font-normal text-muted-foreground/60">(opcional)</span></label>
                      <select
                        value={item.responsavelId}
                        onChange={e => updateItem(item.id, { responsavelId: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition-all"
                      >
                        <option value="">Sem responsável específico</option>
                        {colaboradores.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.nomeSocial || c.nome}{c.cargo ? ` — ${c.cargo.nome}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Rótulos de conformidade */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">Rótulos de Conformidade</span>
                        <span className="text-[10px] text-muted-foreground/60">(opcional — para classificar respostas)</span>
                      </div>

                      {/* Rótulos padrão */}
                      <div className="flex flex-wrap gap-1.5">
                        {ROTULOS_PADRAO.map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => item.rotulos.includes(r) ? removeRotuloFromItem(item.id, r) : addRotuloToItem(item.id, r)}
                            className={cn(
                              'text-xs px-2.5 py-1 rounded-lg border transition-all',
                              item.rotulos.includes(r)
                                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                                : 'border-border bg-background text-muted-foreground hover:border-amber-300'
                            )}
                          >
                            {r}
                          </button>
                        ))}
                      </div>

                      {/* Rótulos customizados */}
                      {item.rotulos.filter(r => !ROTULOS_PADRAO.includes(r)).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {item.rotulos.filter(r => !ROTULOS_PADRAO.includes(r)).map(r => (
                            <span key={r} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                              {r}
                              <button type="button" onClick={() => removeRotuloFromItem(item.id, r)} className="hover:text-red-500">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Input para rotulo customizado */}
                      <div className="flex gap-2 max-w-xs">
                        <input
                          placeholder="Rótulo personalizado..."
                          value={novoRotuloInput}
                          onChange={e => setNovoRotuloInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addRotuloToItem(item.id, novoRotuloInput)
                              setNovoRotuloInput('')
                            }
                          }}
                          className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => { addRotuloToItem(item.id, novoRotuloInput); setNovoRotuloInput('') }}
                          className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:border-amber-400 text-muted-foreground hover:text-amber-600 transition-all"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 p-2 rounded-xl transition"
                    title="Remover item"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addItem}
              className="w-full py-4 border-2 border-dashed border-border/80 hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 rounded-2xl flex items-center justify-center gap-2 text-muted-foreground hover:text-amber-600 font-semibold transition-all"
            >
              <Plus className="h-5 w-5" /> Adicionar Novo Item
            </button>
          </div>
        </div>

        {/* ── Right: Mobile Preview ── */}
        <div className="hidden xl:block">
          <MobilePreview items={items} templateNome={templateForm.nome} />
        </div>

      </div>
    </div>
  )
}
