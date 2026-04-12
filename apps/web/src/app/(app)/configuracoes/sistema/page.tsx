'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Loader2, Bot, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react'

type Provider = 'claude' | 'gemini'

export default function SistemaTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [iaAtiva, setIaAtiva] = useState(false)
  const [provider, setProvider] = useState<Provider>('claude')

  useEffect(() => {
    api.get('/config').then((data: any) => {
      setIaAtiva(data.ia_analise_checklist_ativa === 'true')
      setProvider((data.ia_provider as Provider) || 'claude')
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function salvar() {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await api.put('/config', {
        ia_analise_checklist_ativa: String(iaAtiva),
        ia_provider: provider,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Sistema</h2>
        <p className="text-sm text-muted-foreground mt-1">Configurações gerais do sistema e integrações de IA.</p>
      </div>

      {/* Análise de fotos por IA */}
      <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              <h3 className="font-semibold">Análise de fotos por IA</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Ao tirar uma foto no checklist do totem, a IA analisa automaticamente e sugere a conformidade do item.
            </p>
          </div>
          <button
            onClick={() => setIaAtiva(v => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              iaAtiva ? 'bg-violet-600' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                iaAtiva ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {iaAtiva && (
          <div className="space-y-3 pt-1 border-t border-border/40">
            <p className="text-sm font-medium text-muted-foreground">Provedor de IA</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Claude */}
              <button
                onClick={() => setProvider('claude')}
                className={`flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition ${
                  provider === 'claude'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                    : 'border-border hover:border-border/80 bg-card'
                }`}
              >
                <Bot className={`h-8 w-8 ${provider === 'claude' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                <div className="text-center">
                  <p className={`font-semibold text-sm ${provider === 'claude' ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                    Claude
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Anthropic · Sonnet 4.6</p>
                </div>
                {provider === 'claude' && (
                  <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-medium">Ativo</span>
                )}
              </button>

              {/* Gemini */}
              <button
                onClick={() => setProvider('gemini')}
                className={`flex flex-col items-center gap-2.5 rounded-xl border-2 p-4 transition ${
                  provider === 'gemini'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-border hover:border-border/80 bg-card'
                }`}
              >
                <Sparkles className={`h-8 w-8 ${provider === 'gemini' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                <div className="text-center">
                  <p className={`font-semibold text-sm ${provider === 'gemini' ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                    Gemini
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Google · 1.5 Flash</p>
                </div>
                {provider === 'gemini' && (
                  <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-medium">Ativo</span>
                )}
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Configure a chave de API correspondente no arquivo <code className="bg-muted px-1 py-0.5 rounded text-xs">.env</code> do servidor:{' '}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                {provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'}
              </code>
            </p>
          </div>
        )}
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 text-emerald-600 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Configurações salvas com sucesso.
        </div>
      )}

      <button
        onClick={salvar}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Salvar configurações
      </button>
    </div>
  )
}
