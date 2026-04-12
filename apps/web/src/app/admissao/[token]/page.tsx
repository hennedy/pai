'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronLeft, Wheat } from 'lucide-react'
import { cn } from '@/lib/utils'

// ===================== TIPOS =====================

interface ColaboradorInfo {
  nome: string
  matricula: string
  tipoContrato: string
  dataAdmissao?: string
  cargo?: { nome: string; nivel: string }
  unit?: { nome: string }
}

interface AdmissaoPublica {
  token: string
  status: string
  colaborador: ColaboradorInfo
  dataExpiracao?: string
}

// ===================== HELPERS =====================

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function fetchAdmissao(token: string): Promise<AdmissaoPublica> {
  const res = await fetch(`${API_URL}/rh/admissao/publico/${token}`)
  const data = await res.json()
  if (!res.ok) throw data
  return data
}

async function submitAdmissao(token: string, body: any) {
  const res = await fetch(`${API_URL}/rh/admissao/publico/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw data
  return data
}

// ===================== ETAPAS =====================

const STEPS = [
  { id: 'boas_vindas',  label: 'Boas-vindas'   },
  { id: 'pessoal',      label: 'Dados Pessoais' },
  { id: 'documentos',   label: 'Documentos'     },
  { id: 'contato',      label: 'Contato'        },
  { id: 'endereco',     label: 'Endereço'       },
  { id: 'bancario',     label: 'Dados Bancários'},
  { id: 'revisao',      label: 'Revisão'        },
]

// ===================== PÁGINA PÚBLICA =====================

export default function AdmissaoPublicaPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [admissao, setAdmissao]   = useState<AdmissaoPublica | null>(null)
  const [step, setStep]           = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // ── form data ──────────────────────────────────
  const [form, setForm] = useState({
    // pessoal
    nomeSocial: '', dataNascimento: '', genero: '', estadoCivil: '',
    nacionalidade: 'Brasileiro', naturalidade: '',
    // documentos
    cpf: '', rg: '', rgOrgao: '', rgDataEmissao: '',
    ctpsNumero: '', ctpsSerie: '', ctpsUF: '',
    pisNit: '', cnhNumero: '', cnhCategoria: '', cnhValidade: '',
    tituloEleitor: '', reservista: '',
    // contato
    email: '', telefone: '', celular: '',
    // endereço
    cep: '', logradouro: '', numero: '', complemento: '',
    bairro: '', cidade: '', uf: '',
    // bancário
    banco: '', agencia: '', conta: '', tipoConta: '',
  })

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  // ── carregar dados ──────────────────────────────
  useEffect(() => {
    fetchAdmissao(token)
      .then(setAdmissao)
      .catch((e) => setError(e?.error ?? 'Erro ao carregar formulário'))
      .finally(() => setLoading(false))
  }, [token])

  // ── submit ──────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true)
    try {
      const payload: any = {}
      Object.entries(form).forEach(([k, v]) => { if (v) payload[k] = v })
      await submitAdmissao(token, payload)
      setSubmitted(true)
    } catch (e: any) {
      toast.error(e?.error ?? 'Erro ao enviar formulário. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── CEP lookup ─────────────────────────────────
  async function buscarCep(cep: string) {
    const clean = cep.replace(/\D/g, '')
    if (clean.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          logradouro: data.logradouro ?? f.logradouro,
          bairro: data.bairro ?? f.bairro,
          cidade: data.localidade ?? f.cidade,
          uf: data.uf ?? f.uf,
        }))
      }
    } catch { /* silent */ }
  }

  // ── estados de carregamento/erro ────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-950 to-stone-950">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-950 to-stone-950 p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">Link inválido ou expirado</h1>
          <p className="text-stone-400">{error}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-950 to-stone-950 p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-green-500/20 border border-green-500/30">
            <CheckCircle className="h-10 w-10 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Formulário enviado!</h1>
            <p className="text-stone-400 mt-2">
              Seus dados foram recebidos com sucesso. O RH irá revisar e te informará sobre os próximos passos.
            </p>
          </div>
          <div className="rounded-xl bg-stone-800/60 border border-stone-700/40 p-4 text-sm text-stone-300">
            Bem-vindo(a) à equipe, <span className="text-amber-400 font-semibold">{admissao?.colaborador.nome.split(' ')[0]}</span>!
          </div>
        </div>
      </div>
    )
  }

  const totalSteps = STEPS.length
  const progress = Math.round((step / (totalSteps - 1)) * 100)

  return (
    <div className="min-h-dvh bg-gradient-to-br from-amber-950 to-stone-950 flex flex-col">
      {/* Topbar */}
      <header className="flex items-center gap-3 px-5 py-4 border-b border-stone-700/40">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-400/20">
          <Wheat className="h-4 w-4 text-amber-400" />
        </div>
        <div>
          <p className="font-bold text-amber-50 text-sm leading-none">PAI</p>
          <p className="text-[10px] text-stone-400 tracking-widest uppercase">Pernambucana Adm. Integrada</p>
        </div>
        <div className="ml-auto text-xs text-stone-400">
          Admissão Digital
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-stone-800">
        <div
          className="h-full bg-amber-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step labels */}
      <div className="flex items-center justify-center gap-1 px-4 py-2 overflow-x-auto">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 shrink-0">
            <span className={cn(
              'text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors',
              i === step ? 'bg-amber-500/20 text-amber-400' :
              i < step  ? 'text-stone-400' : 'text-stone-600'
            )}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="text-stone-600 text-xs">›</span>}
          </div>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-6">
        <div className="w-full max-w-lg space-y-6">

          {/* ETAPA 0: BOAS-VINDAS */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-stone-800/60 border border-stone-700/40 p-6 text-center space-y-3">
                <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-amber-500/15 text-amber-400 font-bold text-xl">
                  {admissao?.colaborador.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                </div>
                <h1 className="text-xl font-bold text-white">
                  Olá, {admissao?.colaborador.nome.split(' ')[0]}!
                </h1>
                <p className="text-stone-400 text-sm">
                  Você foi convidado(a) para preencher seu formulário de admissão na equipe PAI.
                </p>
              </div>
              <div className="rounded-xl bg-stone-800/40 border border-stone-700/30 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-400">Cargo</span>
                  <span className="text-stone-200 font-medium">{admissao?.colaborador.cargo?.nome ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Unidade</span>
                  <span className="text-stone-200 font-medium">{admissao?.colaborador.unit?.nome ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Tipo de contrato</span>
                  <span className="text-stone-200 font-medium uppercase">{admissao?.colaborador.tipoContrato}</span>
                </div>
                {admissao?.dataExpiracao && (
                  <div className="flex justify-between">
                    <span className="text-stone-400">Preencher até</span>
                    <span className="text-amber-400 font-medium">
                      {new Date(admissao.dataExpiracao).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-stone-500 text-center">
                Preencha todas as informações com cuidado. Seus dados serão usados apenas para fins administrativos e trabalhistas.
              </p>
            </div>
          )}

          {/* ETAPA 1: DADOS PESSOAIS */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Dados Pessoais</h2>
              <Field label="Nome social (se diferente do nome civil)" value={form.nomeSocial} onChange={(v) => set('nomeSocial', v)} placeholder="Ex: Nome pelo qual prefere ser chamado(a)" />
              <Field label="Data de nascimento *" type="date" value={form.dataNascimento} onChange={(v) => set('dataNascimento', v)} />
              <SelectField label="Gênero" value={form.genero} onChange={(v) => set('genero', v)} options={[
                { value: 'masculino', label: 'Masculino' },
                { value: 'feminino', label: 'Feminino' },
                { value: 'outro', label: 'Outro' },
                { value: 'prefiro_nao_informar', label: 'Prefiro não informar' },
              ]} />
              <SelectField label="Estado civil" value={form.estadoCivil} onChange={(v) => set('estadoCivil', v)} options={[
                { value: 'solteiro', label: 'Solteiro(a)' },
                { value: 'casado', label: 'Casado(a)' },
                { value: 'divorciado', label: 'Divorciado(a)' },
                { value: 'viuvo', label: 'Viúvo(a)' },
                { value: 'uniao_estavel', label: 'União Estável' },
                { value: 'outro', label: 'Outro' },
              ]} />
              <Field label="Nacionalidade" value={form.nacionalidade} onChange={(v) => set('nacionalidade', v)} />
              <Field label="Naturalidade (cidade/UF)" value={form.naturalidade} onChange={(v) => set('naturalidade', v)} placeholder="Ex: São Paulo / SP" />
            </div>
          )}

          {/* ETAPA 2: DOCUMENTOS */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Documentos</h2>
              <Field label="CPF *" value={form.cpf} onChange={(v) => set('cpf', v)} placeholder="000.000.000-00" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="RG" value={form.rg} onChange={(v) => set('rg', v)} />
                <Field label="Órgão emissor" value={form.rgOrgao} onChange={(v) => set('rgOrgao', v)} placeholder="SSP/SP" />
              </div>
              <Field label="Data emissão RG" type="date" value={form.rgDataEmissao} onChange={(v) => set('rgDataEmissao', v)} />
              <div className="grid grid-cols-3 gap-3">
                <Field label="CTPS Nº" value={form.ctpsNumero} onChange={(v) => set('ctpsNumero', v)} />
                <Field label="Série" value={form.ctpsSerie} onChange={(v) => set('ctpsSerie', v)} />
                <Field label="UF" value={form.ctpsUF} onChange={(v) => set('ctpsUF', v)} placeholder="SP" />
              </div>
              <Field label="PIS/NIT" value={form.pisNit} onChange={(v) => set('pisNit', v)} />
              <Field label="Título de eleitor" value={form.tituloEleitor} onChange={(v) => set('tituloEleitor', v)} />
              <Field label="Reservista" value={form.reservista} onChange={(v) => set('reservista', v)} />
              <div className="border-t border-stone-700/40 pt-4">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">CNH (opcional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Número CNH" value={form.cnhNumero} onChange={(v) => set('cnhNumero', v)} />
                  <Field label="Categoria" value={form.cnhCategoria} onChange={(v) => set('cnhCategoria', v)} placeholder="AB" />
                </div>
                <Field label="Validade CNH" type="date" value={form.cnhValidade} onChange={(v) => set('cnhValidade', v)} />
              </div>
            </div>
          )}

          {/* ETAPA 3: CONTATO */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Contato</h2>
              <Field label="E-mail pessoal" type="email" value={form.email} onChange={(v) => set('email', v)} placeholder="seu@email.com" />
              <Field label="Telefone fixo" value={form.telefone} onChange={(v) => set('telefone', v)} placeholder="(00) 0000-0000" />
              <Field label="Celular / WhatsApp *" value={form.celular} onChange={(v) => set('celular', v)} placeholder="(00) 00000-0000" />
            </div>
          )}

          {/* ETAPA 4: ENDEREÇO */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Endereço</h2>
              <Field
                label="CEP *"
                value={form.cep}
                onChange={(v) => { set('cep', v); buscarCep(v) }}
                placeholder="00000-000"
              />
              <Field label="Logradouro" value={form.logradouro} onChange={(v) => set('logradouro', v)} placeholder="Rua, Avenida..." />
              <div className="grid grid-cols-3 gap-3">
                <Field label="Número" value={form.numero} onChange={(v) => set('numero', v)} />
                <div className="col-span-2">
                  <Field label="Complemento" value={form.complemento} onChange={(v) => set('complemento', v)} placeholder="Apto, Bloco..." />
                </div>
              </div>
              <Field label="Bairro" value={form.bairro} onChange={(v) => set('bairro', v)} />
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="Cidade" value={form.cidade} onChange={(v) => set('cidade', v)} />
                </div>
                <Field label="UF" value={form.uf} onChange={(v) => set('uf', v)} placeholder="SP" />
              </div>
            </div>
          )}

          {/* ETAPA 5: BANCÁRIO */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Dados Bancários</h2>
              <p className="text-xs text-stone-400">Para recebimento do salário via depósito bancário.</p>
              <Field label="Banco *" value={form.banco} onChange={(v) => set('banco', v)} placeholder="Ex: Bradesco, Nubank, Caixa..." />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Agência" value={form.agencia} onChange={(v) => set('agencia', v)} placeholder="0000-0" />
                <Field label="Conta" value={form.conta} onChange={(v) => set('conta', v)} placeholder="00000-0" />
              </div>
              <SelectField label="Tipo de conta" value={form.tipoConta} onChange={(v) => set('tipoConta', v)} options={[
                { value: 'corrente', label: 'Conta Corrente' },
                { value: 'poupanca', label: 'Conta Poupança' },
              ]} />
            </div>
          )}

          {/* ETAPA 6: REVISÃO */}
          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Revisão Final</h2>
              <p className="text-sm text-stone-400">Revise as informações antes de enviar. Após o envio, o RH irá analisar seus dados.</p>
              <ReviewSection title="Dados Pessoais" items={[
                { label: 'Data de nascimento', value: form.dataNascimento },
                { label: 'Gênero', value: form.genero },
                { label: 'Estado civil', value: form.estadoCivil },
                { label: 'Naturalidade', value: form.naturalidade },
              ]} />
              <ReviewSection title="Documentos" items={[
                { label: 'CPF', value: form.cpf },
                { label: 'RG', value: form.rg },
                { label: 'CTPS', value: form.ctpsNumero ? `${form.ctpsNumero} / ${form.ctpsSerie}` : '' },
                { label: 'PIS/NIT', value: form.pisNit },
              ]} />
              <ReviewSection title="Contato" items={[
                { label: 'E-mail', value: form.email },
                { label: 'Celular', value: form.celular },
              ]} />
              <ReviewSection title="Endereço" items={[
                { label: 'CEP', value: form.cep },
                { label: 'Logradouro', value: form.logradouro ? `${form.logradouro}, ${form.numero}` : '' },
                { label: 'Cidade/UF', value: form.cidade ? `${form.cidade} / ${form.uf}` : '' },
              ]} />
              <ReviewSection title="Dados Bancários" items={[
                { label: 'Banco', value: form.banco },
                { label: 'Agência/Conta', value: form.agencia ? `${form.agencia} / ${form.conta}` : '' },
              ]} />
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-sm text-amber-200">
                Ao confirmar, você declara que todas as informações prestadas são verdadeiras.
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer Nav */}
      <footer className="shrink-0 px-4 py-4 border-t border-stone-700/40 bg-stone-900/60 backdrop-blur-sm">
        <div className="max-w-lg mx-auto flex gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 border-stone-600 text-stone-300 hover:text-white hover:bg-stone-700"
            >
              <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold"
            >
              Continuar <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" /> Confirmar e Enviar</>
              )}
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}

// ===================== COMPONENTES AUXILIARES =====================

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-stone-300 text-xs font-medium">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-stone-800/60 border-stone-600/50 text-stone-100 placeholder:text-stone-500 focus:border-amber-500/50 focus:ring-amber-500/20"
      />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-stone-300 text-xs font-medium">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-stone-800/60 border-stone-600/50 text-stone-100">
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

function ReviewSection({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  const filled = items.filter((i) => i.value)
  if (filled.length === 0) return null
  return (
    <div className="rounded-xl bg-stone-800/40 border border-stone-700/30 p-4 space-y-2">
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest">{title}</p>
      {filled.map((item) => (
        <div key={item.label} className="flex justify-between text-sm">
          <span className="text-stone-400">{item.label}</span>
          <span className="text-stone-200 font-medium text-right max-w-[60%] truncate">{item.value}</span>
        </div>
      ))}
    </div>
  )
}
