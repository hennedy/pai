import { api } from '@/lib/api'
import { printEncomenda, type EncomendaParaImpressao } from '@/lib/print-encomenda'
import { toast } from 'sonner'

type PrintResult = { direct: boolean }

const DEFAULT_AGENT_URL = 'http://127.0.0.1:3456'

async function agentOnline(agentUrl: string): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2000)
    const r = await fetch(`${agentUrl}/health`, { signal: ctrl.signal })
    clearTimeout(t)
    return r.ok
  } catch {
    return false
  }
}

async function printViaAgent(agentUrl: string, ip: string, porta: number, bufferB64: string): Promise<void> {
  const res = await fetch(`${agentUrl}/print`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ip, port: porta, buffer: bufferB64 }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Agente retornou status ${res.status}`)
  }
}

export async function printEncomendaDirect(
  enc: EncomendaParaImpressao & { id: string },
  onFallback?: () => void,
): Promise<PrintResult> {
  try {
    const data = await api.get<{
      buffer: string
      impressora: { ip: string; porta: number; agentUrl: string | null } | null
    }>(`/encomendas/${enc.id}/receipt-buffer`)

    if (!data.impressora) throw new Error('no_printer')

    const agentUrl = data.impressora.agentUrl || DEFAULT_AGENT_URL
    const online   = await agentOnline(agentUrl)
    if (!online) throw new Error('agent_offline')

    await printViaAgent(agentUrl, data.impressora.ip, data.impressora.porta, data.buffer)
    toast.success('Impresso com sucesso')
    return { direct: true }
  } catch (err: any) {
    const msg = err?.message ?? ''
    if (msg === 'no_printer') {
      toast.warning('Nenhuma impressora configurada para esta unidade')
    } else if (msg === 'agent_offline') {
      toast.warning('Agente de impressão offline — verifique se o PAI Print Agent está rodando')
    }
    if (onFallback) onFallback()
    printEncomenda(enc)
    return { direct: false }
  }
}

export async function printEncomendaTotem(
  encId: string,
  enc: EncomendaParaImpressao,
  totemGet: (path: string, token?: string) => Promise<any>,
  token: string,
): Promise<PrintResult> {
  try {
    const data = await totemGet(`/totem/encomendas/${encId}/receipt-buffer`, token)

    if (!data?.impressora) throw new Error('no_printer')

    const agentUrl = data.impressora.agentUrl || DEFAULT_AGENT_URL
    const online   = await agentOnline(agentUrl)
    if (!online) throw new Error('agent_offline')

    await printViaAgent(agentUrl, data.impressora.ip, data.impressora.porta, data.buffer)
    return { direct: true }
  } catch {
    printEncomenda(enc)
    return { direct: false }
  }
}
