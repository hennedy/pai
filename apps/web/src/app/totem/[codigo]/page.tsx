'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { printEncomenda } from '@/lib/print-encomenda'
import {
  ClipboardCheck,
  Hash,
  User,
  ChevronLeft,
  Delete,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  Wheat,
  RefreshCw,
  LogOut,
  Star,
  ChevronRight,
  Camera,
  PackageX,
  Scale,
  ScanLine,
  Keyboard,
  X,
  ArrowRightLeft,
  Building2,
  ShoppingCart,
  Factory,
  Trash2,
  BadgeCheck,
  ShoppingBag,
  Plus,
  Printer,
  ChevronUp,
  ChevronDown,
  ListChecks,
  Clock,
  PackageCheck,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen =
  | 'home'
  | 'pin'
  | 'checklists'
  | 'checklist_execution'
  | 'contagem'
  | 'contagem_utensilios'
  | 'contagem_paes'
  | 'contagem_descartes'
  | 'contagem_transferencias'
  | 'portal'
  | 'requisicoes'
  | 'encomendas'
  | 'encomendas-menu'
  | 'encomendas-pendentes'

type PendingAction = 'checklists' | 'contagem' | 'portal' | 'requisicoes' | 'encomendas'

type TotemModulo = 'checklists' | 'contagem_utensilios' | 'contagem_paes' | 'contagem_descartes' | 'contagem_transferencias' | 'requisicoes'

interface TotemUser {
  id: string
  colaboradorId: string
  nome: string
  unitId: string
  permissoes: TotemModulo[]
  roles: { unitId: string; unitCode: string; role: string }[]
  hasUserAccount?: boolean
}

interface ChecklistExecution {
  id: string
  status: string
  turno: string
  data: string
  template: { id: string; nome: string }
  atribuidoA: { id: string; nome: string } | null
  responsavel: { id: string; nome: string } | null
}

interface ChecklistItem {
  id: string
  descricao: string
  ordem: number
  tipo: 'checkbox' | 'texto' | 'numero' | 'estoque' | 'foto' | 'estrelas'
  obrigatorio: boolean
  exigeFoto: boolean
  exigeObservacao: boolean
  isCritico: boolean
  opcoes: any
  responsavel: { id: string; nome: string } | null
}

interface ChecklistExecutionDetail {
  id: string
  status: string
  turno: string
  template: { id: string; nome: string; items: ChecklistItem[] }
  responses: { itemId: string; resposta: string | null; conformidade: string | null; naoAplicavel: boolean }[]
}

interface ItemResponse {
  itemId: string
  resposta: string | null
  conformidade: string | null
  fotoUrl: string | null
  naoAplicavel: boolean
}

interface UtensilProduct {
  id: string
  nome: string
  sku: string
  unidadeMedida: string
}

interface DescartesItem {
  productId: string
  nome: string
  peso: number
  codigoBalanca: string
}

/**
 * Parseia codigo de balanca EAN-13 (prefixo 2).
 * Formato: 2 PPPPP WWWWW C
 */
function parseCodigoBalanca(barcode: string): { codigoBalanca: string; pesoKg: number } | null {
  const clean = barcode.replace(/\s/g, '')
  if (clean.length !== 13 || !clean.startsWith('2')) return null
  const codigoBalanca = clean.substring(1, 6)
  const pesoGramas = parseInt(clean.substring(6, 11), 10)
  if (isNaN(pesoGramas)) return null
  return { codigoBalanca, pesoKg: pesoGramas / 1000 }
}

// ─── IA Badge ─────────────────────────────────────────────────────────────────

function IaBadge({ analise }: { analise: { conformidade: string; justificativa: string; confianca: string } }) {
  const isConforme = analise.conformidade === 'Conforme'
  const isNaoConforme = analise.conformidade === 'Não Conforme'
  const color = isConforme
    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
    : isNaoConforme
    ? 'bg-red-500/15 border-red-500/40 text-red-400'
    : 'bg-amber-500/15 border-amber-500/40 text-amber-400'
  const icon = isConforme ? '✓' : isNaoConforme ? '✗' : '~'
  return (
    <div className={`rounded-xl border px-3 py-2.5 space-y-0.5 ${color}`}>
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-sm">{icon} IA: {analise.conformidade}</span>
        {analise.confianca === 'baixa' && (
          <span className="text-xs opacity-60">(baixa confiança)</span>
        )}
      </div>
      <p className="text-xs opacity-80 leading-snug">{analise.justificativa}</p>
    </div>
  )
}

// ─── Barcode Scanner (totem) ──────────────────────────────────────────────────

function TotemBarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (barcode: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const detectedRef = useRef(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualInput, setManualInput] = useState('')

  const stopCamera = useCallback(() => {
    try { controlsRef.current?.stop() } catch { /* ignore */ }
    controlsRef.current = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const handleDetect = useCallback(
    (barcode: string) => {
      if (detectedRef.current) return
      detectedRef.current = true
      stopCamera()
      onDetected(barcode)
    },
    [stopCamera, onDetected],
  )

  useEffect(() => {
    let cancelled = false

    async function start() {
      if (!videoRef.current) return

      // 1. Verificar contexto seguro
      if (!navigator.mediaDevices?.getUserMedia) {
        setScanError('Camera requer HTTPS. Acesse via https:// ou use o campo manual.')
        setShowManual(true)
        return
      }

      // 2. Obter stream
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      } catch (e: any) {
        if (cancelled) return
        const name = e?.name ?? ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setScanError('Permissao de camera negada. Use o campo manual.')
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setScanError('Nenhuma camera encontrada. Use o campo manual.')
        } else {
          setScanError(`Camera indisponivel (${name || e?.message || 'erro'}). Use o campo manual.`)
        }
        setShowManual(true)
        return
      }

      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
      streamRef.current = stream

      videoRef.current.srcObject = stream
      try { await videoRef.current.play() } catch { /* nao critico */ }
      setScanning(true)

      // 3. Iniciar ZXing com o stream
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const { DecodeHintType, BarcodeFormat } = await import('@zxing/library')

        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13])
        hints.set(DecodeHintType.TRY_HARDER, true)

        const reader = new BrowserMultiFormatReader(hints)
        if (cancelled) return

        const controls = await reader.decodeFromStream(stream, videoRef.current, (result) => {
          if (cancelled || !result) return
          handleDetect(result.getText())
        })

        if (cancelled) { controls.stop(); return }
        controlsRef.current = controls
      } catch (e: any) {
        if (cancelled) return
        setScanError(`Erro no leitor (${e?.message ?? 'desconhecido'}). Use o campo manual.`)
        setShowManual(true)
      }
    }

    start()
    return () => { cancelled = true; stopCamera() }
  }, [handleDetect, stopCamera])

  return (
    <div className="space-y-4">
      {/* Video — sempre montado para o ZXing ter a referencia */}
      <div className={`relative rounded-xl overflow-hidden bg-black aspect-video ${showManual ? 'hidden' : ''}`}>
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-28 border-2 border-red-400 rounded-xl opacity-80 animate-pulse" />
          </div>
        )}
        {scanning && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <span className="text-xs text-white bg-black/60 px-3 py-1 rounded-full flex items-center gap-1">
              <ScanLine className="w-3 h-3" /> Aponte para o codigo de balanca
            </span>
          </div>
        )}
        {!scanning && !scanError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Erro */}
      {scanError && (
        <p className="text-amber-400 text-sm text-center">{scanError}</p>
      )}

      {/* Manual */}
      {showManual ? (
        <div className="space-y-2">
          <p className="text-zinc-400 text-xs flex items-center gap-1">
            <Keyboard className="w-3.5 h-3.5" /> Digitar codigo de barras
          </p>
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={13}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value.replace(/\D/g, ''))}
              placeholder="2012340123456"
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-xl px-4 py-3 text-white font-mono text-lg text-center focus:outline-none focus:border-red-500/60"
            />
            <button
              onClick={() => manualInput.length >= 8 && handleDetect(manualInput)}
              disabled={manualInput.length < 8}
              className="px-4 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold transition disabled:opacity-40"
            >
              OK
            </button>
          </div>
          <p className="text-zinc-600 text-xs text-center">EAN-13 comecando com 2 (13 digitos)</p>
        </div>
      ) : (
        <button
          onClick={() => setShowManual(true)}
          className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm transition flex items-center justify-center gap-2"
        >
          <Keyboard className="w-4 h-4" /> Digitar manualmente
        </button>
      )}

      <button
        onClick={onClose}
        className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm transition"
      >
        Cancelar
      </button>
    </div>
  )
}

// ─── API helper (sem usar o singleton global de auth) ────────────────────────

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
}

async function totemGet<T = any>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${getApiBase()}${path}`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro' }))
    const error: any = new Error(err.error || 'Erro na requisição')
    error.status = res.status
    throw error
  }
  return res.json()
}

async function totemPut<T = any>(path: string, body: any, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro' }))
    const error: any = new Error(err.error || 'Erro na requisição')
    error.status = res.status
    throw error
  }
  return res.json()
}

async function totemPatch<T = any>(path: string, body: any, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro' }))
    const error: any = new Error(err.error || 'Erro na requisição')
    error.status = res.status
    throw error
  }
  return res.json()
}

async function totemPost<T = any>(path: string, body: any, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro' }))
    const error: any = new Error(err.error || 'Erro na requisição')
    error.status = res.status
    throw error
  }
  return res.json()
}

// ─── Clock hook ───────────────────────────────────────────────────────────────

function useClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// ─── Inactivity hook ─────────────────────────────────────────────────────────

function useInactivity(onIdle: () => void, timeoutMs = 90_000) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(onIdle, timeoutMs)
  }, [onIdle, timeoutMs])

  useEffect(() => {
    const events = ['mousedown', 'touchstart', 'keydown']
    events.forEach((e) => window.addEventListener(e, reset))
    reset()
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [reset])
}

// ─── PIN Pad ──────────────────────────────────────────────────────────────────

function PinPad({
  pin,
  onPress,
  onDelete,
  onCancel,
  onConfirm,
  loading,
  error,
  actionLabel,
}: {
  pin: string
  onPress: (d: string) => void
  onDelete: () => void
  onCancel: () => void
  onConfirm: () => void
  loading: boolean
  error: string
  actionLabel: string
}) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-sm mx-auto">
      {/* Label da ação */}
      <div className="text-center space-y-1">
        <p className="text-zinc-400 text-sm uppercase tracking-widest font-medium">
          {actionLabel}
        </p>
        <p className="text-white text-xl font-semibold">Digite seu PIN</p>
      </div>

      {/* Dots */}
      <div className="flex gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              i < pin.length
                ? 'bg-amber-400 border-amber-400 scale-110'
                : 'bg-transparent border-zinc-600'
            }`}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/40 border border-red-800/40 px-4 py-2.5 rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Grid numérico */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />
          if (d === 'del') {
            return (
              <button
                key={i}
                onClick={onDelete}
                disabled={loading}
                className="h-16 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 flex items-center justify-center text-zinc-300 transition-all disabled:opacity-40"
              >
                <Delete className="h-5 w-5" />
              </button>
            )
          }
          return (
            <button
              key={i}
              onClick={() => onPress(d)}
              disabled={loading || pin.length >= 6}
              className="h-16 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-white text-2xl font-semibold transition-all disabled:opacity-40"
            >
              {d}
            </button>
          )
        })}
      </div>

      {/* Botões de ação */}
      <div className="flex gap-3 w-full">
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 h-14 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition-all disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || pin.length === 0}
          className="flex-1 h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}

// ─── Totem Time Picker ───────────────────────────────────────────────────────
// Seletor de hora touch-friendly com botoes +/- grandes

function TotemTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value && value.includes(':') ? value.split(':').map(Number) : [8, 0]
  const h = isNaN(parts[0]) ? 8 : parts[0]
  const m = isNaN(parts[1]) ? 0 : parts[1]

  function adjustH(delta: number) {
    const next = ((h + delta) % 24 + 24) % 24
    onChange(`${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }

  function adjustM(delta: number) {
    const next = ((m + delta) % 60 + 60) % 60
    onChange(`${String(h).padStart(2, '0')}:${String(next).padStart(2, '0')}`)
  }

  const btnCls = 'flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-700 active:bg-zinc-600 hover:bg-zinc-600 transition select-none touch-manipulation'

  return (
    <div className="flex items-center justify-center gap-3 py-2">
      {/* Horas */}
      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={() => adjustH(1)} className={btnCls}>
          <ChevronUp className="h-6 w-6 text-white" />
        </button>
        <div className="w-20 h-16 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-600">
          <span className="text-4xl font-bold font-mono text-white tracking-tight">
            {String(h).padStart(2, '0')}
          </span>
        </div>
        <button type="button" onClick={() => adjustH(-1)} className={btnCls}>
          <ChevronDown className="h-6 w-6 text-white" />
        </button>
        <span className="text-xs text-zinc-500 uppercase tracking-wide">hora</span>
      </div>

      <span className="text-4xl font-bold text-zinc-400 mb-6">:</span>

      {/* Minutos — incremento de 5 */}
      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={() => adjustM(5)} className={btnCls}>
          <ChevronUp className="h-6 w-6 text-white" />
        </button>
        <div className="w-20 h-16 flex items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-600">
          <span className="text-4xl font-bold font-mono text-white tracking-tight">
            {String(m).padStart(2, '0')}
          </span>
        </div>
        <button type="button" onClick={() => adjustM(-5)} className={btnCls}>
          <ChevronDown className="h-6 w-6 text-white" />
        </button>
        <span className="text-xs text-zinc-500 uppercase tracking-wide">min</span>
      </div>
    </div>
  )
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionButton({
  label,
  icon: Icon,
  color,
  onClick,
}: {
  label: string
  icon: React.ElementType
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-center gap-4 py-6 rounded-2xl text-white text-2xl font-extrabold uppercase tracking-wider shadow-lg active:scale-[0.98] transition-transform ${color}`}
    >
      <Icon className="h-8 w-8 shrink-0" strokeWidth={2.5} />
      {label}
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TotemPage({ params }: { params: { codigo: string } }) {
  const { codigo } = params
  const [unitId, setUnitId] = useState<string | null>(null)
  const now = useClock()

  const [unit, setUnit] = useState<{ nome: string; codigo: string } | null>(null)
  const [unitError, setUnitError] = useState<string | null>(null)

  const [screen, setScreen] = useState<Screen>('home')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinLoading, setPinLoading] = useState(false)

  const [totemToken, setTotemToken] = useState<string | null>(null)
  const [totemUser, setTotemUser] = useState<TotemUser | null>(null)

  // Screens data
  const [checklists, setChecklists] = useState<ChecklistExecution[]>([])
  const [checklistsLoading, setChecklistsLoading] = useState(false)

  const [execDetail, setExecDetail] = useState<ChecklistExecutionDetail | null>(null)
  const [execLoading, setExecLoading] = useState(false)
  const [execResponses, setExecResponses] = useState<Record<string, ItemResponse>>({})
  const [execSaving, setExecSaving] = useState(false)
  const [execDone, setExecDone] = useState(false)
  const [execObs, setExecObs] = useState('')
  const [fotoUploading, setFotoUploading] = useState<Record<string, boolean>>({})
  const [fotoAnalisando, setFotoAnalisando] = useState<Record<string, boolean>>({})
  const [fotoAnalise, setFotoAnalise] = useState<Record<string, { conformidade: string; justificativa: string; confianca: string }>>({})

  const [utensilProducts, setUtensilProducts] = useState<UtensilProduct[]>([])
  const [utensilCounts, setUtensilCounts] = useState<Record<string, number>>({})
  const [utensilTurno, setUtensilTurno] = useState<'manha' | 'tarde'>('manha')
  const [utensilObs, setUtensilObs] = useState('')
  const [utensilSaving, setUtensilSaving] = useState(false)
  const [utensilDone, setUtensilDone] = useState(false)

  const [paesCruas, setPaesCruas] = useState(0)
  const [paesAssadas, setPaesAssadas] = useState(0)
  const [paesVendidosTodos, setPaesVendidosTodos] = useState(false)
  const [paesHoraFim, setPaesHoraFim] = useState('')
  const [paesObs, setPaesObs] = useState('')
  const [paesSaving, setPaesSaving] = useState(false)
  const [paesDone, setPaesDone] = useState(false)

  const [portalColab, setPortalColab] = useState<any>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  // Requisições
  type ReqSubScreen = 'tipo' | 'cycles' | 'product_search' | 'form' | 'carrinho' | 'done'
  type ReqCarrinhoItem = { productId: string; nome: string; unidadeMedida: string; quantidade: number; observacao: string }
  const [reqSubScreen, setReqSubScreen] = useState<ReqSubScreen>('tipo')
  const [reqCycles, setReqCycles] = useState<{ id: string; titulo: string; status: string; dataFechamento: string | null }[]>([])
  const [reqCyclesLoading, setReqCyclesLoading] = useState(false)
  const [reqSelectedCycle, setReqSelectedCycle] = useState<{ id: string; titulo: string } | null>(null)
  const [reqProducts, setReqProducts] = useState<{ id: string; nome: string; unidadeMedida: string; sku: string }[]>([])
  const [reqProductsLoading, setReqProductsLoading] = useState(false)
  const [reqSearch, setReqSearch] = useState('')
  const [reqSelectedProduct, setReqSelectedProduct] = useState<{ id: string; nome: string; unidadeMedida: string } | null>(null)
  const [reqQuantidade, setReqQuantidade] = useState('')
  const [reqObs, setReqObs] = useState('')
  const [reqSaving, setReqSaving] = useState(false)
  const [reqError, setReqError] = useState('')
  const [reqCarrinho, setReqCarrinho] = useState<ReqCarrinhoItem[]>([])
  const [reqScannerOpen, setReqScannerOpen] = useState(false)
  const [reqScanLoading, setReqScanLoading] = useState(false)

  const [descartesItems, setDescartesItems] = useState<DescartesItem[]>([])
  const [descartesObs, setDescartesObs] = useState('')
  const [descartesSaving, setDescartesSaving] = useState(false)
  const [descartesDone, setDescartesDone] = useState(false)
  const [descartesScannerOpen, setDescartesScannerOpen] = useState(false)
  const [descartesScanLoading, setDescartesScanLoading] = useState(false)

  const [transferenciaItems, setTransferenciaItems] = useState<DescartesItem[]>([])
  const [transferenciaObs, setTransferenciaObs] = useState('')
  const [transferenciaOrigemId, setTransferenciaOrigemId] = useState('')
  const [transferenciaDestinoId, setTransferenciaDestinoId] = useState('')
  const [transferenciaSaving, setTransferenciaSaving] = useState(false)
  const [transferenciaDone, setTransferenciaDone] = useState(false)
  const [transferenciaScannerOpen, setTransferenciaScannerOpen] = useState(false)
  const [transferenciaScanLoading, setTransferenciaScanLoading] = useState(false)
  const [transferenciaUnits, setTransferenciaUnits] = useState<{ id: string; nome: string; codigo: string }[]>([])

  // Encomendas
  type EncStep = 'cliente' | 'itens' | 'valores' | 'confirmacao' | 'sucesso'
  type EncItemForm = { descricao: string; quantidade: string; unidade: string; observacao: string }
  const [encStep, setEncStep] = useState<EncStep>('cliente')
  const [encClienteNome, setEncClienteNome] = useState('')
  const [encClienteTelefone, setEncClienteTelefone] = useState('')
  const [encDataRetirada, setEncDataRetirada] = useState('')
  const [encHoraRetirada, setEncHoraRetirada] = useState('08:00')
  const [encObservacoes, setEncObservacoes] = useState('')
  const [encValorCaucao, setEncValorCaucao] = useState('')
  const [encValorTotal, setEncValorTotal] = useState('')
  const [encItens, setEncItens] = useState<EncItemForm[]>([{ descricao: '', quantidade: '1', unidade: 'un', observacao: '' }])
  const [encSaving, setEncSaving] = useState(false)
  const [encResult, setEncResult] = useState<any>(null)
  const [encPendentes, setEncPendentes] = useState<any[]>([])
  const [encPendentesLoading, setEncPendentesLoading] = useState(false)
  const [encPendentesDetail, setEncPendentesDetail] = useState<any | null>(null)
  const [encFinalizando, setEncFinalizando] = useState(false)

  function encReset() {
    setEncStep('cliente')
    setEncClienteNome('')
    setEncClienteTelefone('')
    setEncDataRetirada('')
    setEncHoraRetirada('08:00')
    setEncObservacoes('')
    setEncValorCaucao('')
    setEncValorTotal('')
    setEncItens([{ descricao: '', quantidade: '1', unidade: 'un', observacao: '' }])
    setEncSaving(false)
    setEncResult(null)
  }

  function encAddItem() {
    setEncItens((p) => [...p, { descricao: '', quantidade: '1', unidade: 'un', observacao: '' }])
  }

  function encRemoveItem(i: number) {
    setEncItens((p) => p.filter((_, j) => j !== i))
  }

  function encSetItem(i: number, field: string, value: string) {
    setEncItens((p) => p.map((it, j) => j === i ? { ...it, [field]: value } : it))
  }

  async function encConfirm() {
    if (!totemToken) return
    setEncSaving(true)
    try {
      const result = await totemPost('/totem/encomendas', {
        clienteNome:     encClienteNome,
        clienteTelefone: encClienteTelefone || undefined,
        dataRetirada:    encDataRetirada,
        horaRetirada:    encHoraRetirada,
        observacoes:     encObservacoes || undefined,
        valorCaucao:     parseFloat(encValorCaucao || '0'),
        valorTotal:      parseFloat(encValorTotal || '0'),
        itens: encItens.map((it) => ({
          descricao:  it.descricao,
          quantidade: parseFloat(it.quantidade),
          unidade:    it.unidade,
          observacao: it.observacao || undefined,
        })),
      }, totemToken)
      setEncResult(result)
      setEncStep('sucesso')
      // Imprimir automaticamente
      setTimeout(() => encTriggerPrint(), 400)
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar encomenda')
    } finally {
      setEncSaving(false)
    }
  }

  async function encTriggerPrint(enc?: any) {
    const target = enc ?? encResult
    if (!target || !totemToken) return
    try {
      const data = await totemGet<{
        buffer: string
        impressora: { ip: string; porta: number; agentUrl: string | null } | null
      }>(`/totem/encomendas/${target.id}/receipt-buffer`, totemToken)

      if (data?.impressora) {
        const agentUrl = data.impressora.agentUrl || 'http://127.0.0.1:3456'
        const ctrl = new AbortController()
        const t = setTimeout(() => ctrl.abort(), 2000)
        const health = await fetch(`${agentUrl}/health`, { signal: ctrl.signal }).catch(() => null)
        clearTimeout(t)
        if (health?.ok) {
          const res = await fetch(`${agentUrl}/print`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ ip: data.impressora.ip, port: data.impressora.porta, buffer: data.buffer }),
          })
          if (res.ok) return
        }
      }
    } catch { /* */ }
    printEncomenda(target)
  }

  async function encLoadPendentes() {
    if (!totemToken) return
    setEncPendentesLoading(true)
    try {
      const list = await totemGet<any[]>('/totem/encomendas', totemToken)
      setEncPendentes(Array.isArray(list) ? list : [])
    } catch {
      setEncPendentes([])
    } finally {
      setEncPendentesLoading(false)
    }
  }

  async function encFinalizar(id: string) {
    if (!totemToken) return
    setEncFinalizando(true)
    try {
      const updated = await totemPatch(`/totem/encomendas/${id}/status`, { status: 'retirada' }, totemToken)
      setEncPendentes((prev) => prev.filter((e) => e.id !== id))
      setEncPendentesDetail(null)
      return updated
    } catch (err: any) {
      alert(err.message || 'Erro ao finalizar encomenda')
    } finally {
      setEncFinalizando(false)
    }
  }

  // Inactivity → volta ao início
  useInactivity(
    useCallback(() => {
      if (screen !== 'home') goHome()
    }, [screen]),
    90_000,
  )

  // Carregar dados da unidade pelo código amigável
  useEffect(() => {
    totemGet(`/totem/unit/by-code/${codigo.toUpperCase()}`)
      .then((data: any) => {
        setUnitId(data.id)
        setUnit(data)
      })
      .catch((err: any) => {
        if (err?.status === 404) {
          setUnitError(`Unidade "${codigo.toUpperCase()}" não encontrada. Verifique o link do totem.`)
        } else {
          setUnit({ nome: 'Carregando...', codigo: codigo.toUpperCase() })
        }
      })
  }, [codigo])

  // Formatação do relógio (null enquanto não hidratado)
  const hours = now ? String(now.getHours()).padStart(2, '0') : '--'
  const minutes = now ? String(now.getMinutes()).padStart(2, '0') : '--'
  const seconds = now ? String(now.getSeconds()).padStart(2, '0') : '--'
  const dateFormatted = now
    ? (() => {
        const s = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
        return s.charAt(0).toUpperCase() + s.slice(1)
      })()
    : ''

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function goHome() {
    setScreen('home')
    setPendingAction(null)
    setPin('')
    setPinError('')
    setTotemToken(null)
    setTotemUser(null)
    setChecklists([])
    setExecDetail(null)
    setExecResponses({})
    setExecDone(false)
    setExecObs('')
    setUtensilDone(false)
    setPaesDone(false)
    setPortalColab(null)
    setDescartesItems([])
    setDescartesObs('')
    setDescartesDone(false)
    setDescartesScannerOpen(false)
    setTransferenciaItems([])
    setTransferenciaObs('')
    setTransferenciaOrigemId('')
    setTransferenciaDestinoId('')
    setTransferenciaDone(false)
    setTransferenciaScannerOpen(false)
    encReset()
    setEncPendentes([])
    setEncPendentesDetail(null)
  }

  function openPin(action: PendingAction) {
    setPendingAction(action)
    setPin('')
    setPinError('')
    setScreen('pin')
  }

  function pressPin(d: string) {
    if (pin.length < 6) setPin((p) => p + d)
  }

  function deletePin() {
    setPin((p) => p.slice(0, -1))
    setPinError('')
  }

  async function verifyPin() {
    if (!pin || pin.length === 0 || !unitId) return
    setPinLoading(true)
    setPinError('')
    try {
      const result = await totemPost<{ token: string; user: TotemUser }>('/totem/verify-pin', {
        pin,
        unitId,
      })
      const user = { ...result.user, permissoes: result.user.permissoes ?? [] }
      setTotemToken(result.token)
      setTotemUser(user)
      // Navegar para a ação pendente
      await navigateAfterAuth(result.token, user)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg === 'PIN invalido' || msg.toLowerCase().includes('pin')) {
        setPinError('PIN inválido. Tente novamente.')
      } else if (err?.status === 404) {
        setPinError('Serviço indisponível. Reinicie o servidor.')
      } else {
        setPinError(msg || 'Erro ao verificar PIN. Tente novamente.')
      }
      setPin('')
    } finally {
      setPinLoading(false)
    }
  }

  function hasPermissao(user: TotemUser, modulo: TotemModulo | 'contagem'): boolean {
    const perms = user.permissoes ?? []
    if (modulo === 'contagem') {
      return perms.some((p) =>
        ['contagem_utensilios', 'contagem_paes', 'contagem_descartes', 'contagem_transferencias'].includes(p)
      )
    }
    return perms.includes(modulo)
  }

  async function navigateAfterAuth(token: string, user: TotemUser) {
    // Verificar permissão antes de navegar (portal não exige permissão)
    if (pendingAction !== 'portal' && pendingAction !== null) {
      const permMap: Record<string, TotemModulo | 'contagem'> = {
        checklists: 'checklists',
        contagem: 'contagem',
        requisicoes: 'requisicoes',
        // encomendas: sem modulo especifico, qualquer colaborador autenticado pode usar
      }
      const modulo = permMap[pendingAction]
      if (modulo && !hasPermissao(user, modulo)) {
        setPinError('Sem permissão para acessar este módulo nesta unidade.')
        setTotemToken(null)
        setTotemUser(null)
        setPin('')
        return
      }
    }

    if (pendingAction === 'checklists') {
      setScreen('checklists')
      setChecklistsLoading(true)
      try {
        const res = await totemGet<{ data: ChecklistExecution[] }>(
          `/checklist/executions?status=pendente&unitId=${unitId}`,
          token,
        )
        const mine = (res.data || []).filter(
          (e) =>
            e.atribuidoA?.id === user.id ||
            e.responsavel?.id === user.colaboradorId,
        )
        setChecklists(mine)
      } catch {
        setChecklists([])
      } finally {
        setChecklistsLoading(false)
      }
    } else if (pendingAction === 'contagem') {
      setScreen('contagem')
    } else if (pendingAction === 'portal') {
      setScreen('portal')
      setPortalLoading(true)
      try {
        const colab = await totemGet('/portal/me', token)
        setPortalColab(colab)
      } catch {
        setPortalColab(null)
      } finally {
        setPortalLoading(false)
      }
    } else if (pendingAction === 'encomendas') {
      encReset()
      setEncPendentes([])
      setEncPendentesDetail(null)
      setScreen('encomendas-menu')
    } else if (pendingAction === 'requisicoes') {
      setScreen('requisicoes')
      setReqSubScreen('tipo')
      setReqSelectedCycle(null)
      setReqSelectedProduct(null)
      setReqQuantidade('')
      setReqObs('')
      setReqError('')
      setReqCarrinho([])
    }
  }

  async function reqSearchProducts(search: string) {
    if (!totemToken) return
    setReqProductsLoading(true)
    try {
      const products = await totemGet<any[]>(`/totem/products?search=${encodeURIComponent(search)}`, totemToken)
      setReqProducts(products)
    } catch {
      setReqProducts([])
    } finally {
      setReqProductsLoading(false)
    }
  }

  async function handleReqBarcodeDetected(barcode: string) {
    setReqScannerOpen(false)
    setReqScanLoading(true)
    try {
      const products = await totemGet<any[]>(`/totem/products?search=${encodeURIComponent(barcode)}`, totemToken!)
      setReqProducts(products)
      setReqSearch(barcode)
      if (products.length === 1 && !reqCarrinho.some(i => i.productId === products[0].id)) {
        setReqSelectedProduct({ id: products[0].id, nome: products[0].nome, unidadeMedida: products[0].unidadeMedida })
        setReqQuantidade('')
        setReqObs('')
        setReqError('')
        setReqSubScreen('form')
      }
    } catch {
      setReqProducts([])
    } finally {
      setReqScanLoading(false)
    }
  }

  async function reqSubmit() {
    if (!totemToken || !reqSelectedCycle || reqCarrinho.length === 0) return
    setReqSaving(true)
    setReqError('')
    try {
      for (const item of reqCarrinho) {
        await totemPost(
          `/totem/purchase-cycles/${reqSelectedCycle.id}/requests`,
          { productId: item.productId, quantidade: item.quantidade, observacao: item.observacao || undefined },
          totemToken,
        )
      }
      setReqSubScreen('done')
    } catch (e: any) {
      setReqError(e?.message || 'Erro ao enviar requisição')
    } finally {
      setReqSaving(false)
    }
  }

  async function loadExecution(execId: string) {
    if (!totemToken) return
    setExecLoading(true)
    setExecDone(false)
    setExecObs('')
    try {
      const detail = await totemGet<ChecklistExecutionDetail>(`/checklist/executions/${execId}`, totemToken)
      setExecDetail(detail)
      // Inicializa respostas com o que já existe
      const initial: Record<string, ItemResponse> = {}
      for (const item of detail.template.items) {
        const existing = detail.responses.find((r) => r.itemId === item.id)
        initial[item.id] = {
          itemId: item.id,
          resposta: existing?.resposta ?? (item.tipo === 'checkbox' ? 'false' : null),
          conformidade: existing?.conformidade ?? null,
          fotoUrl: (existing as any)?.fotoUrl ?? null,
          naoAplicavel: existing?.naoAplicavel ?? false,
        }
      }
      setExecResponses(initial)
      setScreen('checklist_execution')
    } catch (e: any) {
      alert(e.message || 'Erro ao carregar checklist')
    } finally {
      setExecLoading(false)
    }
  }

  function setItemResponse(itemId: string, patch: Partial<ItemResponse>) {
    setExecResponses((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }))
  }

  async function uploadFoto(itemId: string, file: File, itemDescricao?: string) {
    if (!totemToken) return
    setFotoUploading((prev) => ({ ...prev, [itemId]: true }))
    setFotoAnalise((prev) => { const n = { ...prev }; delete n[itemId]; return n })
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${getApiBase()}/totem/upload-foto`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${totemToken}` },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro' }))
        throw new Error(err.error || 'Erro ao enviar foto')
      }
      const { url } = await res.json()
      setItemResponse(itemId, { fotoUrl: url, resposta: 'foto_ok' })

      // Análise automática por IA (fire-and-forget com feedback)
      if (itemDescricao) {
        setFotoAnalisando((prev) => ({ ...prev, [itemId]: true }))
        fetch(`${getApiBase()}/checklist/analyze-foto`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${totemToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fotoUrl: url, itemDescricao }),
        })
          .then((r) => r.ok ? r.json() : null)
          .then((analise) => {
            if (!analise || analise.code === 'AI_DISABLED') return
            setFotoAnalise((prev) => ({ ...prev, [itemId]: analise }))
            setItemResponse(itemId, { conformidade: analise.conformidade })
          })
          .catch(() => {})
          .finally(() => setFotoAnalisando((prev) => ({ ...prev, [itemId]: false })))
      }
    } catch (e: any) {
      alert(e.message || 'Erro ao enviar foto')
    } finally {
      setFotoUploading((prev) => ({ ...prev, [itemId]: false }))
    }
  }

  async function saveAndCompleteExecution() {
    if (!totemToken || !execDetail) return
    setExecSaving(true)
    try {
      const responses = Object.values(execResponses)
      await totemPut(`/checklist/executions/${execDetail.id}`, {
        responses,
        observacaoGeral: execObs || undefined,
      }, totemToken)
      await totemPatch(`/checklist/executions/${execDetail.id}/complete`, {}, totemToken)
      // Remove da lista de pendentes
      setChecklists((prev) => prev.filter((c) => c.id !== execDetail.id))
      setExecDone(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar checklist')
    } finally {
      setExecSaving(false)
    }
  }

  async function loadUtensilProducts() {
    if (!totemToken || utensilProducts.length > 0) return
    try {
      const res = await totemGet<{ data: UtensilProduct[] }>('/utensil-counts/products', totemToken)
      setUtensilProducts(res.data || [])
      const initial: Record<string, number> = {}
      ;(res.data || []).forEach((p) => { initial[p.id] = 0 })
      setUtensilCounts(initial)
    } catch {
      setUtensilProducts([])
    }
  }

  async function saveUtensilCount() {
    if (!totemToken || !totemUser) return
    const items = Object.entries(utensilCounts)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantidade]) => ({ productId, quantidade }))
    if (items.length === 0) return

    setUtensilSaving(true)
    try {
      await totemPost(
        `/utensil-counts?unitId=${unitId}`,
        { turno: utensilTurno, tipo: 'contagem', observacao: utensilObs || undefined, items },
        totemToken,
      )
      setUtensilDone(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar contagem')
    } finally {
      setUtensilSaving(false)
    }
  }

  async function savePaesCount() {
    if (!totemToken || !totemUser) return
    setUtensilSaving(true)
    setPaesSaving(true)
    try {
      await totemPost(
        `/telas?unitId=${unitId}`,
        {
          telasCruas: paesVendidosTodos ? 0 : paesCruas,
          telasAssadas: paesVendidosTodos ? 0 : paesAssadas,
          vendidosTodos: paesVendidosTodos,
          horaFim: paesVendidosTodos && paesHoraFim ? paesHoraFim : undefined,
          observacao: paesObs || undefined,
        },
        totemToken,
      )
      setPaesDone(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar contagem')
    } finally {
      setPaesSaving(false)
      setUtensilSaving(false)
    }
  }

  async function handleDescartesBarcodeDetected(barcode: string) {
    setDescartesScannerOpen(false)
    setDescartesScanLoading(true)

    const parsed = parseCodigoBalanca(barcode)
    if (!parsed) {
      alert('Codigo invalido. Use um codigo de balanca EAN-13 (13 digitos comecando com 2).')
      setDescartesScanLoading(false)
      return
    }

    const { codigoBalanca, pesoKg } = parsed
    try {
      const product = await totemGet(
        `/descarte-counts/products/by-balanca/${codigoBalanca}`,
        totemToken || undefined,
      )
      setDescartesItems((prev) => {
        const idx = prev.findIndex((i) => i.productId === product.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], peso: Math.round((next[idx].peso + pesoKg) * 1000) / 1000 }
          return next
        }
        return [...prev, { productId: product.id, nome: product.nome, peso: pesoKg, codigoBalanca }]
      })
    } catch (err: any) {
      if (err?.status === 404) {
        alert(`Produto nao encontrado para o codigo ${codigoBalanca}`)
      } else {
        alert('Erro ao buscar produto. Tente novamente.')
      }
    } finally {
      setDescartesScanLoading(false)
    }
  }

  async function saveDescartesCount() {
    if (!totemToken || !totemUser || descartesItems.length === 0) return
    setDescartesSaving(true)
    try {
      await totemPost(
        `/descarte-counts?unitId=${unitId}`,
        {
          observacao: descartesObs || undefined,
          items: descartesItems.map((i) => ({ productId: i.productId, peso: i.peso })),
        },
        totemToken,
      )
      setDescartesDone(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar contagem de descartes')
    } finally {
      setDescartesSaving(false)
    }
  }

  async function loadTransferenciaUnits() {
    if (transferenciaUnits.length > 0) return
    try {
      const res = await totemGet<{ data: { id: string; nome: string; codigo: string }[] }>(
        '/transferencia-counts/units',
        totemToken || undefined,
      )
      setTransferenciaUnits(res.data || [])
    } catch {
      setTransferenciaUnits([])
    }
  }

  async function handleTransferenciaBarcodeDetected(barcode: string) {
    setTransferenciaScannerOpen(false)
    setTransferenciaScanLoading(true)

    const parsed = parseCodigoBalanca(barcode)
    if (!parsed) {
      alert('Codigo invalido. Use um codigo de balanca EAN-13 (13 digitos comecando com 2).')
      setTransferenciaScanLoading(false)
      return
    }

    const { codigoBalanca, pesoKg } = parsed
    try {
      const product = await totemGet(
        `/transferencia-counts/products/by-balanca/${codigoBalanca}`,
        totemToken || undefined,
      )
      setTransferenciaItems((prev) => {
        const idx = prev.findIndex((i) => i.productId === product.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], peso: Math.round((next[idx].peso + pesoKg) * 1000) / 1000 }
          return next
        }
        return [...prev, { productId: product.id, nome: product.nome, peso: pesoKg, codigoBalanca }]
      })
    } catch (err: any) {
      alert(err?.status === 404
        ? `Produto nao encontrado para o codigo ${codigoBalanca}`
        : 'Erro ao buscar produto. Tente novamente.')
    } finally {
      setTransferenciaScanLoading(false)
    }
  }

  async function saveTransferenciaCount() {
    if (!totemToken || !transferenciaOrigemId || !transferenciaDestinoId || transferenciaItems.length === 0) return
    setTransferenciaSaving(true)
    try {
      await totemPost(
        `/transferencia-counts?unitId=${unitId}`,
        {
          origemUnitId: transferenciaOrigemId,
          destinoUnitId: transferenciaDestinoId,
          observacao: transferenciaObs || undefined,
          items: transferenciaItems.map((i) => ({ productId: i.productId, peso: i.peso })),
        },
        totemToken,
      )
      setTransferenciaDone(true)
    } catch (e: any) {
      alert(e.message || 'Erro ao salvar transferencia')
    } finally {
      setTransferenciaSaving(false)
    }
  }

  // Auto-confirmar ao completar 6 dígitos
  useEffect(() => {
    if (pin.length === 6 && screen === 'pin' && !pinLoading) {
      verifyPin()
    }
  }, [pin])

  // Carregar produtos de utensílios ao entrar na tela
  useEffect(() => {
    if (screen === 'contagem_utensilios') {
      loadUtensilProducts()
    }
    if (screen === 'contagem_transferencias') {
      loadTransferenciaUnits()
    }
  }, [screen])

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (unitError) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-3 px-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="text-white text-xl font-semibold">Unidade não encontrada</p>
          <p className="text-zinc-500 text-sm">{unitError}</p>
          <p className="text-zinc-700 text-xs font-mono break-all">Código: {codigo.toUpperCase()}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col select-none overflow-hidden">
      {/* ── Topo: empresa + relógio ── */}
      <div className="flex flex-col items-center pt-10 pb-6 gap-2">
        <p className="text-zinc-500 text-sm font-medium uppercase tracking-[0.2em]">
          {unit?.nome ?? '...'}
        </p>

        {/* Relógio */}
        <div className="flex items-center gap-1">
          <span className="text-white font-black leading-none" style={{ fontSize: 'clamp(64px, 12vw, 120px)' }}>
            {hours}
          </span>
          <div className="flex flex-col gap-2 px-2">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
          </div>
          <span className="text-white font-black leading-none" style={{ fontSize: 'clamp(64px, 12vw, 120px)' }}>
            {minutes}
          </span>
          <span
            className="text-zinc-500 font-bold self-end mb-3 ml-2"
            style={{ fontSize: 'clamp(28px, 5vw, 52px)' }}
          >
            {seconds}
          </span>
        </div>

        {/* Data */}
        <p className="text-amber-400 text-lg font-medium">{dateFormatted}</p>
      </div>

      {/* ── Conteúdo central ── */}
      <div className="flex-1 flex items-start justify-center px-6 pb-10 pt-4">
        <div className="w-full max-w-md space-y-4">

          {/* ── HOME ── */}
          {screen === 'home' && (
            <>
              <ActionButton
                label="Meus Checklists"
                icon={ClipboardCheck}
                color="bg-emerald-600 hover:bg-emerald-500"
                onClick={() => openPin('checklists')}
              />
              <ActionButton
                label="Contagem"
                icon={Hash}
                color="bg-blue-600 hover:bg-blue-500"
                onClick={() => openPin('contagem')}
              />
              <ActionButton
                label="Requisições"
                icon={ShoppingCart}
                color="bg-orange-600 hover:bg-orange-500"
                onClick={() => openPin('requisicoes')}
              />
              <ActionButton
                label="Encomendas"
                icon={ShoppingBag}
                color="bg-purple-600 hover:bg-purple-500"
                onClick={() => openPin('encomendas')}
              />
              <ActionButton
                label="Meu Portal"
                icon={User}
                color="bg-violet-600 hover:bg-violet-500"
                onClick={() => openPin('portal')}
              />
            </>
          )}

          {/* ── PIN — após autenticar, mostrar erro se sem permissão ── */}

          {/* ── PIN ── */}
          {screen === 'pin' && (
            <PinPad
              pin={pin}
              onPress={pressPin}
              onDelete={deletePin}
              onCancel={goHome}
              onConfirm={verifyPin}
              loading={pinLoading}
              error={pinError}
              actionLabel={
                pendingAction === 'checklists'
                  ? 'Meus Checklists'
                  : pendingAction === 'contagem'
                  ? 'Contagem'
                  : pendingAction === 'requisicoes'
                  ? 'Requisições'
                  : pendingAction === 'encomendas'
                  ? 'Encomendas'
                  : 'Meu Portal'
              }
            />
          )}

          {/* ── CHECKLISTS ── */}
          {screen === 'checklists' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Olá,</p>
                  <p className="text-white text-xl font-bold">{totemUser?.nome}</p>
                </div>
                <button onClick={goHome} className="text-zinc-500 hover:text-white flex items-center gap-1.5 text-sm transition">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>

              <h2 className="text-white font-bold text-lg">Meus Checklists de Hoje</h2>

              {checklistsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
                </div>
              ) : checklists.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                  <p className="text-white font-semibold">Tudo em dia!</p>
                  <p className="text-zinc-500 text-sm">Nenhum checklist pendente para hoje.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {checklists.map((cl) => (
                    <button
                      key={cl.id}
                      onClick={() => loadExecution(cl.id)}
                      disabled={execLoading}
                      className="w-full bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-800 rounded-2xl p-4 flex items-center justify-between transition disabled:opacity-50"
                    >
                      <div className="text-left">
                        <p className="text-white font-semibold">{cl.template.nome}</p>
                        <p className="text-zinc-500 text-xs mt-0.5 capitalize">{cl.turno}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {execLoading ? (
                          <Loader2 className="h-4 w-4 text-zinc-500 animate-spin" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-zinc-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={goHome}
                className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition flex items-center justify-center gap-2"
              >
                <ChevronLeft className="h-5 w-5" /> Voltar ao Início
              </button>
            </div>
          )}

          {/* ── EXECUÇÃO DO CHECKLIST ── */}
          {screen === 'checklist_execution' && execDetail && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setScreen('checklists')}
                  className="text-zinc-500 hover:text-white transition"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Checklist</p>
                  <p className="text-white text-lg font-bold truncate">{execDetail.template.nome}</p>
                </div>
              </div>

              {execDone ? (
                <div className="text-center py-12 space-y-3">
                  <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
                  <p className="text-white text-xl font-bold">Checklist Concluído!</p>
                  <p className="text-zinc-500 text-sm">Obrigado, {totemUser?.nome}.</p>
                  <button
                    onClick={() => setScreen('checklists')}
                    className="mt-4 px-8 py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl transition font-semibold"
                  >
                    Ver outros checklists
                  </button>
                  <button
                    onClick={goHome}
                    className="block w-full mt-2 px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition font-semibold"
                  >
                    Voltar ao Início
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {execDetail.template.items.map((item, idx) => {
                      const resp = execResponses[item.id] || { itemId: item.id, resposta: null, conformidade: null, naoAplicavel: false }
                      const isNA = resp.naoAplicavel

                      return (
                        <div
                          key={item.id}
                          className={`bg-zinc-900 border rounded-2xl p-4 space-y-3 transition ${
                            isNA ? 'border-zinc-700 opacity-60' : item.isCritico ? 'border-red-800/60' : 'border-zinc-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-zinc-600 text-xs font-mono">{idx + 1}</span>
                                {item.isCritico && (
                                  <span className="text-xs text-red-400 font-semibold">Crítico</span>
                                )}
                                {(item.tipo === 'foto' || item.exigeFoto) && (
                                  <Camera className={`h-3.5 w-3.5 ${item.obrigatorio ? 'text-amber-400' : 'text-zinc-500'}`} />
                                )}
                                {item.obrigatorio && !item.isCritico && item.tipo !== 'foto' && !item.exigeFoto && (
                                  <span className="text-xs text-amber-500">*</span>
                                )}
                              </div>
                              <p className="text-white text-sm font-medium leading-snug">{item.descricao}</p>
                              {item.responsavel && (
                                <p className="text-zinc-500 text-xs mt-0.5">Resp: {item.responsavel.nome}</p>
                              )}
                            </div>
                            {/* N/A toggle */}
                            <button
                              onClick={() => setItemResponse(item.id, { naoAplicavel: !isNA })}
                              className={`shrink-0 text-xs px-2 py-1 rounded-lg border transition ${
                                isNA ? 'bg-zinc-700 border-zinc-600 text-zinc-300' : 'border-zinc-700 text-zinc-600 hover:text-zinc-400'
                              }`}
                            >
                              N/A
                            </button>
                          </div>

                          {!isNA && (
                            <>
                              {/* CHECKBOX */}
                              {item.tipo === 'checkbox' && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setItemResponse(item.id, { resposta: 'true' })}
                                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition ${
                                      resp.resposta === 'true'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                    }`}
                                  >
                                    Sim / Conforme
                                  </button>
                                  <button
                                    onClick={() => setItemResponse(item.id, { resposta: 'false' })}
                                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition ${
                                      resp.resposta === 'false'
                                        ? 'bg-red-700 text-white'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                    }`}
                                  >
                                    Não / Não Conforme
                                  </button>
                                </div>
                              )}

                              {/* TEXTO */}
                              {item.tipo === 'texto' && (
                                <textarea
                                  value={resp.resposta ?? ''}
                                  onChange={(e) => setItemResponse(item.id, { resposta: e.target.value })}
                                  rows={2}
                                  placeholder="Digite a resposta..."
                                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                                />
                              )}

                              {/* NUMERO / ESTOQUE */}
                              {(item.tipo === 'numero' || item.tipo === 'estoque') && (
                                <div className="flex items-center gap-4">
                                  <button
                                    onClick={() => setItemResponse(item.id, { resposta: String(Math.max(0, Number(resp.resposta || 0) - 1)) })}
                                    className="w-12 h-12 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-xl font-bold transition"
                                  >−</button>
                                  <input
                                    type="number"
                                    value={resp.resposta ?? '0'}
                                    onChange={(e) => setItemResponse(item.id, { resposta: e.target.value })}
                                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xl font-bold text-center focus:outline-none focus:border-emerald-500/50"
                                  />
                                  <button
                                    onClick={() => setItemResponse(item.id, { resposta: String(Number(resp.resposta || 0) + 1) })}
                                    className="w-12 h-12 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-xl font-bold transition"
                                  >+</button>
                                </div>
                              )}

                              {/* ESTRELAS */}
                              {item.tipo === 'estrelas' && (
                                <div className="flex gap-2 justify-center">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      onClick={() => setItemResponse(item.id, { resposta: String(star) })}
                                      className="p-1"
                                    >
                                      <Star
                                        className={`h-8 w-8 transition ${
                                          Number(resp.resposta || 0) >= star
                                            ? 'text-amber-400 fill-amber-400'
                                            : 'text-zinc-600'
                                        }`}
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* FOTO ADICIONAL (exigeFoto em qualquer tipo) */}
                              {item.exigeFoto && item.tipo !== 'foto' && (
                                <div className="space-y-1">
                                  <p className={`text-xs font-semibold flex items-center gap-1 ${item.obrigatorio ? 'text-amber-400' : 'text-zinc-400'}`}>
                                    <Camera className="h-3.5 w-3.5" />
                                    {item.obrigatorio ? 'Foto obrigatória' : 'Foto (opcional)'}
                                  </p>
                                  {resp.fotoUrl ? (
                                    <div className="relative rounded-xl overflow-hidden border border-emerald-700/50">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={resp.fotoUrl} alt="Foto" className="w-full max-h-36 object-cover" />
                                      <label className="absolute bottom-0 left-0 right-0 bg-black/70 py-1.5 px-3 flex items-center justify-between cursor-pointer">
                                        <span className="text-emerald-400 text-xs flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" /> Capturada
                                        </span>
                                        <span className="text-zinc-300 text-xs flex items-center gap-1">
                                          <Camera className="h-3 w-3" /> Refazer
                                        </span>
                                        <input type="file" accept="image/*" capture="environment" className="hidden"
                                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFoto(item.id, f, item.descricao); e.target.value = '' }} />
                                      </label>
                                      {fotoAnalisando[item.id] && (
                                        <div className="flex items-center gap-2 px-2 py-1">
                                          <Loader2 className="h-3.5 w-3.5 text-violet-400 animate-spin" />
                                          <span className="text-violet-400 text-xs">Analisando com IA...</span>
                                        </div>
                                      )}
                                      {fotoAnalise[item.id] && !fotoAnalisando[item.id] && (
                                        <IaBadge analise={fotoAnalise[item.id]} />
                                      )}
                                    </div>
                                  ) : (
                                    <label className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl border-2 border-dashed transition cursor-pointer ${
                                      fotoUploading[item.id] ? 'border-zinc-600 opacity-60 cursor-not-allowed'
                                        : item.obrigatorio ? 'border-amber-600/60 bg-amber-950/20 hover:border-amber-500'
                                        : 'border-zinc-600 hover:border-emerald-500/50 hover:bg-zinc-800/40'
                                    }`}>
                                      {fotoUploading[item.id] ? (
                                        <><Loader2 className="h-5 w-5 text-zinc-500 animate-spin" /><span className="text-zinc-500 text-sm">Enviando...</span></>
                                      ) : (
                                        <>
                                          <Camera className={`h-6 w-6 ${item.obrigatorio ? 'text-amber-400' : 'text-zinc-400'}`} />
                                          <span className={`text-sm font-semibold ${item.obrigatorio ? 'text-amber-300' : 'text-zinc-300'}`}>Tirar Foto</span>
                                        </>
                                      )}
                                      <input type="file" accept="image/*" capture="environment" className="hidden"
                                        disabled={fotoUploading[item.id]}
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFoto(item.id, f, item.descricao); e.target.value = '' }} />
                                    </label>
                                  )}
                                </div>
                              )}

                              {/* FOTO */}
                              {item.tipo === 'foto' && (
                                <div className="space-y-2">
                                  {resp.fotoUrl ? (
                                    <div className="relative rounded-xl overflow-hidden border border-emerald-700/50">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={resp.fotoUrl}
                                        alt="Foto capturada"
                                        className="w-full max-h-48 object-cover"
                                      />
                                      <label className="absolute bottom-0 left-0 right-0 bg-black/70 py-2 px-3 flex items-center justify-between cursor-pointer">
                                        <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                                          <CheckCircle2 className="h-3.5 w-3.5" /> Foto capturada
                                        </span>
                                        <span className="text-zinc-300 text-xs flex items-center gap-1 hover:text-white">
                                          <Camera className="h-3.5 w-3.5" /> Refazer
                                        </span>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          capture="environment"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) uploadFoto(item.id, file, item.descricao)
                                            e.target.value = ''
                                          }}
                                        />
                                      </label>
                                      {fotoAnalisando[item.id] && (
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                          <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
                                          <span className="text-violet-400 text-sm">Analisando com IA...</span>
                                        </div>
                                      )}
                                      {fotoAnalise[item.id] && !fotoAnalisando[item.id] && (
                                        <IaBadge analise={fotoAnalise[item.id]} />
                                      )}
                                    </div>
                                  ) : (
                                    <label className={`w-full flex flex-col items-center justify-center gap-3 py-6 rounded-xl border-2 border-dashed transition cursor-pointer ${
                                      fotoUploading[item.id]
                                        ? 'border-zinc-600 opacity-60 cursor-not-allowed'
                                        : item.obrigatorio
                                        ? 'border-amber-600/60 bg-amber-950/20 hover:border-amber-500 hover:bg-amber-950/30'
                                        : 'border-zinc-600 hover:border-emerald-500/60 hover:bg-zinc-800/50'
                                    }`}>
                                      {fotoUploading[item.id] ? (
                                        <>
                                          <Loader2 className="h-8 w-8 text-zinc-500 animate-spin" />
                                          <span className="text-zinc-500 text-sm">Enviando foto...</span>
                                        </>
                                      ) : (
                                        <>
                                          <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
                                            item.obrigatorio ? 'bg-amber-900/40' : 'bg-zinc-800'
                                          }`}>
                                            <Camera className={`h-7 w-7 ${item.obrigatorio ? 'text-amber-400' : 'text-zinc-400'}`} />
                                          </div>
                                          <div className="text-center">
                                            <p className={`text-sm font-bold ${item.obrigatorio ? 'text-amber-300' : 'text-zinc-300'}`}>
                                              {item.obrigatorio ? 'Foto obrigatória' : 'Tirar Foto'}
                                            </p>
                                            <p className="text-zinc-500 text-xs mt-0.5">Toque para abrir a câmera</p>
                                          </div>
                                        </>
                                      )}
                                      <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        disabled={fotoUploading[item.id]}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) uploadFoto(item.id, file, item.descricao)
                                          e.target.value = ''
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Observação geral */}
                  <textarea
                    value={execObs}
                    onChange={(e) => setExecObs(e.target.value)}
                    placeholder="Observação geral (opcional)"
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                  />

                  {(() => {
                    const itensFotoObrigSemFoto = execDetail.template.items.filter(
                      (it) => (it.tipo === 'foto' || it.exigeFoto) && it.obrigatorio && !execResponses[it.id]?.naoAplicavel && !execResponses[it.id]?.fotoUrl
                    )
                    const bloqueado = execSaving || itensFotoObrigSemFoto.length > 0 || Object.values(fotoUploading).some(Boolean)
                    return (
                      <>
                        {itensFotoObrigSemFoto.length > 0 && (
                          <p className="text-center text-xs text-amber-500">
                            {itensFotoObrigSemFoto.length === 1
                              ? `O item "${itensFotoObrigSemFoto[0].descricao.slice(0, 40)}" exige foto.`
                              : `${itensFotoObrigSemFoto.length} itens obrigatórios aguardam foto.`}
                          </p>
                        )}
                        <button
                          onClick={saveAndCompleteExecution}
                          disabled={bloqueado}
                          className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {execSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                            <>
                              <CheckCircle2 className="h-5 w-5" />
                              Concluir Checklist
                            </>
                          )}
                        </button>
                      </>
                    )
                  })()}
                </>
              )}
            </div>
          )}

          {/* ── CONTAGEM MENU ── */}
          {screen === 'contagem' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Contagem</p>
                  <p className="text-white text-xl font-bold">{totemUser?.nome}</p>
                </div>
                <button onClick={goHome} className="text-zinc-500 hover:text-white flex items-center gap-1.5 text-sm transition">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>

              <p className="text-zinc-400 text-sm">Selecione o tipo de contagem:</p>

              {totemUser && hasPermissao(totemUser, 'contagem_utensilios') && (
                <button
                  onClick={() => setScreen('contagem_utensilios')}
                  className="w-full flex items-center gap-4 p-5 bg-zinc-900 border border-zinc-700 hover:border-blue-500/50 hover:bg-zinc-800 rounded-2xl transition"
                >
                  <div className="h-12 w-12 rounded-xl bg-blue-900/40 flex items-center justify-center shrink-0">
                    <Package className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold text-lg">Utensílios</p>
                    <p className="text-zinc-500 text-sm">Contagem de utensílios por turno</p>
                  </div>
                </button>
              )}

              {totemUser && hasPermissao(totemUser, 'contagem_paes') && (
                <button
                  onClick={() => setScreen('contagem_paes')}
                  className="w-full flex items-center gap-4 p-5 bg-zinc-900 border border-zinc-700 hover:border-amber-500/50 hover:bg-zinc-800 rounded-2xl transition"
                >
                  <div className="h-12 w-12 rounded-xl bg-amber-900/40 flex items-center justify-center shrink-0">
                    <Wheat className="h-6 w-6 text-amber-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold text-lg">Sobra de Pães</p>
                    <p className="text-zinc-500 text-sm">Telas cruas e assadas no final do dia</p>
                  </div>
                </button>
              )}

              {totemUser && hasPermissao(totemUser, 'contagem_transferencias') && (
                <button
                  onClick={() => { setTransferenciaItems([]); setTransferenciaObs(''); setTransferenciaOrigemId(''); setTransferenciaDestinoId(''); setTransferenciaDone(false); setScreen('contagem_transferencias') }}
                  className="w-full flex items-center gap-4 p-5 bg-zinc-900 border border-zinc-700 hover:border-blue-500/50 hover:bg-zinc-800 rounded-2xl transition"
                >
                  <div className="h-12 w-12 rounded-xl bg-blue-900/40 flex items-center justify-center shrink-0">
                    <ArrowRightLeft className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold text-lg">Transferencias</p>
                    <p className="text-zinc-500 text-sm">Registrar itens transferidos entre unidades</p>
                  </div>
                </button>
              )}

              {totemUser && hasPermissao(totemUser, 'contagem_descartes') && (
                <button
                  onClick={() => { setDescartesItems([]); setDescartesObs(''); setDescartesDone(false); setScreen('contagem_descartes') }}
                  className="w-full flex items-center gap-4 p-5 bg-zinc-900 border border-zinc-700 hover:border-red-500/50 hover:bg-zinc-800 rounded-2xl transition"
                >
                  <div className="h-12 w-12 rounded-xl bg-red-900/40 flex items-center justify-center shrink-0">
                    <PackageX className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-semibold text-lg">Descartes</p>
                    <p className="text-zinc-500 text-sm">Registrar produtos descartados por peso</p>
                  </div>
                </button>
              )}

              <button
                onClick={goHome}
                className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition flex items-center justify-center gap-2"
              >
                <ChevronLeft className="h-5 w-5" /> Voltar ao Início
              </button>
            </div>
          )}

          {/* ── CONTAGEM UTENSÍLIOS ── */}
          {screen === 'contagem_utensilios' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setScreen('contagem')}
                  className="text-zinc-500 hover:text-white transition"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Contagem</p>
                  <p className="text-white text-lg font-bold">Utensílios</p>
                </div>
              </div>

              {utensilDone ? (
                <div className="text-center py-12 space-y-3">
                  <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
                  <p className="text-white text-xl font-bold">Contagem Registrada!</p>
                  <p className="text-zinc-500 text-sm">Obrigado, {totemUser?.nome}.</p>
                  <button
                    onClick={goHome}
                    className="mt-4 px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition font-semibold"
                  >
                    Voltar ao Início
                  </button>
                </div>
              ) : (
                <>
                  {/* Turno */}
                  <div className="flex gap-2">
                    {(['manha', 'tarde'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setUtensilTurno(t)}
                        className={`flex-1 py-3 rounded-xl text-sm font-semibold transition capitalize ${
                          utensilTurno === t
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {t === 'manha' ? 'Manhã' : 'Tarde'}
                      </button>
                    ))}
                  </div>

                  {/* Produtos */}
                  {utensilProducts.length === 0 ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 text-zinc-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {utensilProducts.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
                        >
                          <span className="text-white text-sm font-medium">{p.nome}</span>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() =>
                                setUtensilCounts((c) => ({
                                  ...c,
                                  [p.id]: Math.max(0, (c[p.id] ?? 0) - 1),
                                }))
                              }
                              className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-bold transition flex items-center justify-center"
                            >
                              −
                            </button>
                            <span className="text-white font-bold w-8 text-center text-lg">
                              {utensilCounts[p.id] ?? 0}
                            </span>
                            <button
                              onClick={() =>
                                setUtensilCounts((c) => ({
                                  ...c,
                                  [p.id]: (c[p.id] ?? 0) + 1,
                                }))
                              }
                              className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white font-bold transition flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Observação */}
                  <textarea
                    value={utensilObs}
                    onChange={(e) => setUtensilObs(e.target.value)}
                    placeholder="Observação (opcional)"
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 resize-none"
                  />

                  <button
                    onClick={saveUtensilCount}
                    disabled={utensilSaving}
                    className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {utensilSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar Contagem'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── SOBRA DE PÃES ── */}
          {screen === 'contagem_paes' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setScreen('contagem')}
                  className="text-zinc-500 hover:text-white transition"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Contagem</p>
                  <p className="text-white text-lg font-bold">Sobra de Pães</p>
                </div>
              </div>

              {paesDone ? (
                <div className="text-center py-12 space-y-3">
                  <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
                  <p className="text-white text-xl font-bold">Contagem Registrada!</p>
                  <p className="text-zinc-500 text-sm">Obrigado, {totemUser?.nome}.</p>
                  <button
                    onClick={goHome}
                    className="mt-4 px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition font-semibold"
                  >
                    Voltar ao Início
                  </button>
                </div>
              ) : (
                <>
                  {/* Toggle: todos vendidos */}
                  <button
                    onClick={() => setPaesVendidosTodos((v) => !v)}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition ${
                      paesVendidosTodos
                        ? 'bg-emerald-900/40 border-emerald-500 text-emerald-400'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <span className="font-semibold text-sm">Todos os pães foram vendidos</span>
                    <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${paesVendidosTodos ? 'bg-emerald-500' : 'bg-zinc-600'}`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${paesVendidosTodos ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </button>

                  {/* Hora em que acabou — só aparece quando vendidosTodos */}
                  {paesVendidosTodos && (
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 space-y-2">
                      <p className="text-zinc-300 font-semibold text-sm">Que horas acabaram os pães?</p>
                      <input
                        type="time"
                        value={paesHoraFim}
                        onChange={(e) => setPaesHoraFim(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded-xl px-4 py-3 text-white text-xl font-mono text-center focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  )}

                  {/* Contadores — só aparecem quando não vendidosTodos */}
                  {!paesVendidosTodos && (
                    <>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                        <p className="text-zinc-300 font-semibold">Telas Cruas</p>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => setPaesCruas((v) => Math.max(0, v - 1))}
                            className="w-14 h-14 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-2xl font-bold transition"
                          >−</button>
                          <span className="text-white text-4xl font-black flex-1 text-center">{paesCruas}</span>
                          <button
                            onClick={() => setPaesCruas((v) => v + 1)}
                            className="w-14 h-14 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-2xl font-bold transition"
                          >+</button>
                        </div>
                      </div>

                      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                        <p className="text-zinc-300 font-semibold">Telas Assadas</p>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => setPaesAssadas((v) => Math.max(0, v - 1))}
                            className="w-14 h-14 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-2xl font-bold transition"
                          >−</button>
                          <span className="text-white text-4xl font-black flex-1 text-center">{paesAssadas}</span>
                          <button
                            onClick={() => setPaesAssadas((v) => v + 1)}
                            className="w-14 h-14 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-2xl font-bold transition"
                          >+</button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Observação */}
                  <textarea
                    value={paesObs}
                    onChange={(e) => setPaesObs(e.target.value)}
                    placeholder="Observação (opcional)"
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
                  />

                  <button
                    onClick={savePaesCount}
                    disabled={paesSaving || (paesVendidosTodos && !paesHoraFim)}
                    className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {paesSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar Contagem'}
                  </button>
                  {paesVendidosTodos && !paesHoraFim && (
                    <p className="text-center text-xs text-zinc-500">Informe o horário em que os pães acabaram</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── CONTAGEM TRANSFERENCIAS ── */}
          {screen === 'contagem_transferencias' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button onClick={() => setScreen('contagem')} className="text-zinc-500 hover:text-white transition">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Contagem</p>
                  <p className="text-white text-lg font-bold">Transferencias</p>
                </div>
              </div>

              {transferenciaDone ? (
                <div className="text-center py-12 space-y-3">
                  <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
                  <p className="text-white text-xl font-bold">Transferencia Registrada!</p>
                  <p className="text-zinc-500 text-sm">Obrigado, {totemUser?.nome}.</p>
                  <button onClick={goHome} className="mt-4 px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition font-semibold">
                    Voltar ao Início
                  </button>
                </div>
              ) : transferenciaScannerOpen ? (
                <div className="space-y-4">
                  <p className="text-zinc-400 text-sm text-center">Aponte a camera para o codigo de balanca</p>
                  <TotemBarcodeScanner
                    onDetected={handleTransferenciaBarcodeDetected}
                    onClose={() => setTransferenciaScannerOpen(false)}
                  />
                </div>
              ) : (
                <>
                  {/* Selecao de unidades */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-zinc-400 text-xs uppercase tracking-widest flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" /> Unidade de Origem
                      </p>
                      {transferenciaUnits.length === 0 ? (
                        <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 text-zinc-500 animate-spin" /></div>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                          {transferenciaUnits.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => setTransferenciaOrigemId(u.id)}
                              disabled={u.id === transferenciaDestinoId}
                              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                                transferenciaOrigemId === u.id
                                  ? 'bg-blue-700 text-white border border-blue-500'
                                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed'
                              }`}
                            >
                              {u.nome}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-center">
                      <ArrowRightLeft className="h-5 w-5 text-zinc-600" />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-zinc-400 text-xs uppercase tracking-widest flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" /> Unidade de Destino
                      </p>
                      {transferenciaUnits.length === 0 ? (
                        <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 text-zinc-500 animate-spin" /></div>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                          {transferenciaUnits.map((u) => (
                            <button
                              key={u.id}
                              onClick={() => setTransferenciaDestinoId(u.id)}
                              disabled={u.id === transferenciaOrigemId}
                              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                                transferenciaDestinoId === u.id
                                  ? 'bg-blue-700 text-white border border-blue-500'
                                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed'
                              }`}
                            >
                              {u.nome}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botao escanear */}
                  <button
                    onClick={() => setTransferenciaScannerOpen(true)}
                    disabled={transferenciaScanLoading || !transferenciaOrigemId || !transferenciaDestinoId}
                    className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl border-2 border-dashed border-blue-700/60 bg-blue-950/20 hover:border-blue-500 hover:bg-blue-950/30 text-blue-400 font-semibold text-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {transferenciaScanLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ScanLine className="h-6 w-6" />}
                    {transferenciaScanLoading ? 'Buscando produto...' : 'Escanear Codigo de Balanca'}
                  </button>
                  {(!transferenciaOrigemId || !transferenciaDestinoId) && (
                    <p className="text-center text-xs text-zinc-600">Selecione origem e destino para escanear</p>
                  )}

                  {/* Lista de itens */}
                  {transferenciaItems.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                        <span>{transferenciaItems.length} {transferenciaItems.length === 1 ? 'item' : 'itens'}</span>
                        <span>Total: {transferenciaItems.reduce((a, i) => a + i.peso, 0).toFixed(3)} kg</span>
                      </div>
                      {transferenciaItems.map((item) => (
                        <div key={item.productId} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Scale className="h-4 w-4 text-blue-400 shrink-0" />
                            <span className="text-white text-sm font-medium truncate">{item.nome}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-zinc-300 font-mono text-sm">{item.peso.toFixed(3)} kg</span>
                            <button
                              onClick={() => setTransferenciaItems((prev) => prev.filter((i) => i.productId !== item.productId))}
                              className="w-7 h-7 rounded-lg bg-zinc-700 hover:bg-red-900/60 text-zinc-400 hover:text-red-400 transition flex items-center justify-center"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-zinc-600 space-y-2">
                      <Scale className="h-8 w-8 opacity-30" />
                      <p className="text-sm">Nenhum item adicionado</p>
                    </div>
                  )}

                  {/* Observacao */}
                  <textarea
                    value={transferenciaObs}
                    onChange={(e) => setTransferenciaObs(e.target.value)}
                    placeholder="Observacao (opcional)"
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 resize-none"
                  />

                  <button
                    onClick={saveTransferenciaCount}
                    disabled={transferenciaSaving || transferenciaItems.length === 0 || !transferenciaOrigemId || !transferenciaDestinoId}
                    className="w-full py-4 rounded-2xl bg-blue-700 hover:bg-blue-600 text-white font-bold text-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {transferenciaSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar Transferencia'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── CONTAGEM DESCARTES ── */}
          {screen === 'contagem_descartes' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setScreen('contagem')}
                  className="text-zinc-500 hover:text-white transition"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Contagem</p>
                  <p className="text-white text-lg font-bold">Descartes</p>
                </div>
              </div>

              {descartesDone ? (
                <div className="text-center py-12 space-y-3">
                  <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
                  <p className="text-white text-xl font-bold">Descartes Registrados!</p>
                  <p className="text-zinc-500 text-sm">Obrigado, {totemUser?.nome}.</p>
                  <button
                    onClick={goHome}
                    className="mt-4 px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition font-semibold"
                  >
                    Voltar ao Início
                  </button>
                </div>
              ) : descartesScannerOpen ? (
                <div className="space-y-4">
                  <p className="text-zinc-400 text-sm text-center">
                    Aponte a camera para o codigo de barras da balanca
                  </p>
                  <TotemBarcodeScanner
                    onDetected={handleDescartesBarcodeDetected}
                    onClose={() => setDescartesScannerOpen(false)}
                  />
                </div>
              ) : (
                <>
                  {/* Botão escanear */}
                  <button
                    onClick={() => setDescartesScannerOpen(true)}
                    disabled={descartesScanLoading}
                    className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl border-2 border-dashed border-red-700/60 bg-red-950/20 hover:border-red-500 hover:bg-red-950/30 text-red-400 font-semibold text-lg transition disabled:opacity-50"
                  >
                    {descartesScanLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <ScanLine className="h-6 w-6" />
                    )}
                    {descartesScanLoading ? 'Buscando produto...' : 'Escanear Codigo de Balanca'}
                  </button>

                  {/* Lista de itens */}
                  {descartesItems.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                        <span>{descartesItems.length} {descartesItems.length === 1 ? 'item' : 'itens'}</span>
                        <span>
                          Total:{' '}
                          {descartesItems.reduce((a, i) => a + i.peso, 0).toFixed(3)} kg
                        </span>
                      </div>
                      {descartesItems.map((item) => (
                        <div
                          key={item.productId}
                          className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Scale className="h-4 w-4 text-red-400 shrink-0" />
                            <span className="text-white text-sm font-medium truncate">{item.nome}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-zinc-300 font-mono text-sm">
                              {item.peso.toFixed(3)} kg
                            </span>
                            <button
                              onClick={() =>
                                setDescartesItems((prev) =>
                                  prev.filter((i) => i.productId !== item.productId),
                                )
                              }
                              className="w-7 h-7 rounded-lg bg-zinc-700 hover:bg-red-900/60 text-zinc-400 hover:text-red-400 transition flex items-center justify-center"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-zinc-600 space-y-2">
                      <Scale className="h-10 w-10 opacity-30" />
                      <p className="text-sm">Nenhum item adicionado</p>
                    </div>
                  )}

                  {/* Observação */}
                  <textarea
                    value={descartesObs}
                    onChange={(e) => setDescartesObs(e.target.value)}
                    placeholder="Observação (opcional)"
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-red-500/50 resize-none"
                  />

                  <button
                    onClick={saveDescartesCount}
                    disabled={descartesSaving || descartesItems.length === 0}
                    className="w-full py-4 rounded-2xl bg-red-700 hover:bg-red-600 text-white font-bold text-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {descartesSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Salvar Descartes'}
                  </button>
                  {descartesItems.length === 0 && (
                    <p className="text-center text-xs text-zinc-600">Adicione pelo menos um item</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── PORTAL ── */}
          {screen === 'portal' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Meu Portal</p>
                  <p className="text-white text-xl font-bold">{totemUser?.nome}</p>
                </div>
                <button onClick={goHome} className="text-zinc-500 hover:text-white flex items-center gap-1.5 text-sm transition">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>

              {portalLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
                </div>
              ) : portalColab ? (
                <div className="space-y-3">
                  {/* Card principal */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-2xl font-black">
                        {portalColab.nome?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-bold text-lg">{portalColab.nomeSocial || portalColab.nome}</p>
                        <p className="text-zinc-400 text-sm">{portalColab.cargo?.nome ?? '—'}</p>
                        <p className="text-zinc-500 text-xs">{portalColab.unit?.nome ?? '—'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                      <div>
                        <p className="text-zinc-500 text-xs">Matrícula</p>
                        <p className="text-white text-sm font-semibold">{portalColab.matricula ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Contrato</p>
                        <p className="text-white text-sm font-semibold capitalize">{portalColab.tipoContrato ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Admissão</p>
                        <p className="text-white text-sm font-semibold">
                          {portalColab.dataAdmissao
                            ? new Date(portalColab.dataAdmissao).toLocaleDateString('pt-BR')
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-xs">Carga Horária</p>
                        <p className="text-white text-sm font-semibold">
                          {portalColab.cargaHorariaSemanal ? `${portalColab.cargaHorariaSemanal}h/sem` : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-zinc-600 text-xs text-center">
                    Para acessar holerites, férias e documentos, use o portal completo no computador.
                  </p>
                </div>
              ) : (
                <div className="text-center py-10 space-y-2">
                  <User className="h-12 w-12 text-zinc-600 mx-auto" />
                  <p className="text-zinc-400 font-semibold">Perfil de colaborador não encontrado</p>
                  <p className="text-zinc-600 text-sm">Entre em contato com o RH para vincular seu perfil.</p>
                </div>
              )}

              <button
                onClick={goHome}
                className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition flex items-center justify-center gap-2"
              >
                <ChevronLeft className="h-5 w-5" /> Voltar ao Início
              </button>
            </div>
          )}

          {/* ── REQUISIÇÕES ── */}
          {screen === 'requisicoes' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Requisições</p>
                  <p className="text-white text-xl font-bold">{totemUser?.nome}</p>
                </div>
                <button onClick={goHome} className="text-zinc-500 hover:text-white flex items-center gap-1.5 text-sm transition">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>

              {/* ── Sub: seleção de tipo ── */}
              {reqSubScreen === 'tipo' && (
                <>
                  <h2 className="text-white font-bold text-lg">Tipo de Requisição</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={async () => {
                        setReqSubScreen('cycles')
                        setReqCyclesLoading(true)
                        try {
                          const ciclos = await totemGet<any[]>('/totem/purchase-cycles/ativos', totemToken!)
                          setReqCycles(ciclos)
                        } catch {
                          setReqCycles([])
                        } finally {
                          setReqCyclesLoading(false)
                        }
                      }}
                      className="flex flex-col items-center justify-center gap-3 bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-800 rounded-2xl p-8 transition"
                    >
                      <ShoppingCart className="h-10 w-10 text-orange-400" />
                      <span className="text-white font-bold text-lg">Compras</span>
                    </button>
                    <button
                      onClick={() => {}}
                      disabled
                      className="flex flex-col items-center justify-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-8 opacity-40 cursor-not-allowed"
                    >
                      <Factory className="h-10 w-10 text-blue-400" />
                      <span className="text-white font-bold text-lg">Produção</span>
                      <span className="text-zinc-500 text-xs">Em breve</span>
                    </button>
                  </div>
                  <button
                    onClick={goHome}
                    className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="h-5 w-5" /> Voltar ao Início
                  </button>
                </>
              )}

              {/* ── Sub: seleção de ciclo ── */}
              {reqSubScreen === 'cycles' && (
                <>
                  <h2 className="text-white font-bold text-lg">Selecione o Ciclo de Compras</h2>

                  {reqCyclesLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
                    </div>
                  ) : reqCycles.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                      <ShoppingCart className="h-12 w-12 text-zinc-600 mx-auto" />
                      <p className="text-white font-semibold">Nenhum ciclo aberto</p>
                      <p className="text-zinc-500 text-sm">Não há ciclos de compras ativos no momento.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reqCycles.map((cycle) => (
                        <button
                          key={cycle.id}
                          onClick={() => {
                            setReqSelectedCycle({ id: cycle.id, titulo: cycle.titulo })
                            setReqSubScreen('product_search')
                            setReqSearch('')
                            setReqProducts([])
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-800 rounded-2xl p-4 flex items-center justify-between transition"
                        >
                          <div className="text-left">
                            <p className="text-white font-semibold">{cycle.titulo}</p>
                            {cycle.dataFechamento && (
                              <p className="text-zinc-500 text-xs mt-0.5">
                                Prazo: {new Date(cycle.dataFechamento).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium capitalize">
                              {cycle.status}
                            </span>
                            <ChevronRight className="h-5 w-5 text-zinc-600" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={goHome}
                    className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="h-5 w-5" /> Voltar ao Início
                  </button>
                </>
              )}

              {/* ── Sub: busca de produto ── */}
              {reqSubScreen === 'product_search' && (
                <>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
                    <p className="text-zinc-500 text-xs">Ciclo selecionado</p>
                    <p className="text-white font-semibold">{reqSelectedCycle?.titulo}</p>
                  </div>

                  {reqCarrinho.length > 0 && (
                    <button
                      onClick={() => setReqSubScreen('carrinho')}
                      className="w-full flex items-center justify-between bg-orange-600/20 border border-orange-500/40 hover:bg-orange-600/30 rounded-2xl px-4 py-3 transition"
                    >
                      <div className="flex items-center gap-3">
                        <ShoppingCart className="h-5 w-5 text-orange-400" />
                        <span className="text-orange-300 font-semibold">Ver Carrinho</span>
                      </div>
                      <span className="bg-orange-500 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
                        {reqCarrinho.length} {reqCarrinho.length === 1 ? 'item' : 'itens'}
                      </span>
                    </button>
                  )}

                  <h2 className="text-white font-bold text-lg">Buscar Produto</h2>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={reqSearch}
                      onChange={(e) => setReqSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && reqSearch.trim() && reqSearchProducts(reqSearch)}
                      placeholder="Nome ou código de barras..."
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/60"
                    />
                    <button
                      onClick={() => setReqScannerOpen(true)}
                      disabled={reqScanLoading}
                      className="px-4 py-3 rounded-2xl bg-zinc-700 hover:bg-zinc-600 text-white transition disabled:opacity-40 flex items-center"
                    >
                      {reqScanLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanLine className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => reqSearchProducts(reqSearch)}
                      disabled={reqProductsLoading || !reqSearch.trim()}
                      className="px-4 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white transition disabled:opacity-40 flex items-center"
                    >
                      {reqProductsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Package className="h-5 w-5" />}
                    </button>
                  </div>

                  {reqScannerOpen && (
                    <div className="space-y-3">
                      <p className="text-zinc-400 text-sm text-center">Aponte a câmera para o código de barras do produto</p>
                      <TotemBarcodeScanner
                        onDetected={handleReqBarcodeDetected}
                        onClose={() => setReqScannerOpen(false)}
                      />
                    </div>
                  )}

                  {reqProducts.filter(p => !reqCarrinho.some(i => i.productId === p.id)).length > 0 && (
                    <div className="space-y-2">
                      {reqProducts.filter(p => !reqCarrinho.some(i => i.productId === p.id)).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setReqSelectedProduct({ id: p.id, nome: p.nome, unidadeMedida: p.unidadeMedida })
                            setReqQuantidade('')
                            setReqObs('')
                            setReqError('')
                            setReqSubScreen('form')
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 hover:bg-zinc-800 rounded-2xl p-4 flex items-center justify-between transition"
                        >
                          <div className="text-left">
                            <p className="text-white font-semibold">{p.nome}</p>
                            <p className="text-zinc-500 text-xs">{p.sku} · {p.unidadeMedida}</p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-zinc-600" />
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setReqSubScreen('cycles')}
                    className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="h-5 w-5" /> Voltar
                  </button>
                </>
              )}

              {/* ── Sub: carrinho ── */}
              {reqSubScreen === 'carrinho' && (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-white font-bold text-lg">Carrinho</h2>
                    <span className="text-zinc-500 text-xs">{reqSelectedCycle?.titulo}</span>
                  </div>

                  <div className="space-y-2">
                    {reqCarrinho.map((item, idx) => (
                      <div key={item.productId} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm leading-snug break-words">{item.nome}</p>
                          {item.observacao && <p className="text-zinc-600 text-xs mt-0.5 break-words">{item.observacao}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                          <button
                            onClick={() => setReqCarrinho(prev => {
                              const updated = [...prev]
                              const next = updated[idx].quantidade - 1
                              if (next <= 0) return prev.filter((_, i) => i !== idx)
                              updated[idx] = { ...updated[idx], quantidade: next }
                              return updated
                            })}
                            className="w-9 h-9 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-xl font-bold flex items-center justify-center transition active:scale-95"
                          >
                            −
                          </button>
                          <span className="w-10 text-center text-white font-bold text-sm">
                            {item.quantidade}<span className="text-zinc-600 text-xs block leading-none">{item.unidadeMedida}</span>
                          </span>
                          <button
                            onClick={() => setReqCarrinho(prev => {
                              const updated = [...prev]
                              updated[idx] = { ...updated[idx], quantidade: updated[idx].quantidade + 1 }
                              return updated
                            })}
                            className="w-9 h-9 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xl font-bold flex items-center justify-center transition active:scale-95"
                          >
                            +
                          </button>
                          <button
                            onClick={() => setReqCarrinho(prev => prev.filter((_, i) => i !== idx))}
                            className="w-9 h-9 rounded-xl text-zinc-600 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition ml-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {reqError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                      <p className="text-red-400 text-sm">{reqError}</p>
                    </div>
                  )}

                  <button
                    onClick={reqSubmit}
                    disabled={reqSaving || reqCarrinho.length === 0}
                    className="w-full py-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xl font-extrabold uppercase tracking-wider transition disabled:opacity-40 flex items-center justify-center gap-3"
                  >
                    {reqSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <BadgeCheck className="h-6 w-6" />}
                    Enviar Requisição
                  </button>

                  <button
                    onClick={() => setReqSubScreen('product_search')}
                    className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="h-5 w-5" /> Adicionar mais itens
                  </button>
                </>
              )}

              {/* ── Sub: formulário de quantidade ── */}
              {reqSubScreen === 'form' && (
                <>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 space-y-1">
                    <p className="text-zinc-500 text-xs">Ciclo</p>
                    <p className="text-white font-semibold">{reqSelectedCycle?.titulo}</p>
                    <p className="text-zinc-400 text-xs mt-1">Produto</p>
                    <p className="text-white font-semibold">{reqSelectedProduct?.nome}</p>
                    <p className="text-zinc-600 text-xs">{reqSelectedProduct?.unidadeMedida}</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-zinc-400 text-sm mb-1.5">Quantidade ({reqSelectedProduct?.unidadeMedida})</p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setReqQuantidade(v => String(Math.max(0, Number(v) - 1)))}
                          className="w-16 h-16 rounded-2xl bg-zinc-700 hover:bg-zinc-600 text-white text-3xl font-bold flex items-center justify-center shrink-0 transition active:scale-95"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          value={reqQuantidade}
                          onChange={(e) => setReqQuantidade(e.target.value)}
                          placeholder="0"
                          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-4 text-white text-2xl font-bold text-center focus:outline-none focus:border-orange-500/60"
                        />
                        <button
                          onClick={() => setReqQuantidade(v => String(Number(v) + 1))}
                          className="w-16 h-16 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white text-3xl font-bold flex items-center justify-center shrink-0 transition active:scale-95"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-zinc-400 text-sm mb-1.5">Observação (opcional)</p>
                      <input
                        type="text"
                        value={reqObs}
                        onChange={(e) => setReqObs(e.target.value)}
                        placeholder="Ex: marca preferida, urgência..."
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/60"
                      />
                    </div>
                  </div>

                  {reqError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                      <p className="text-red-400 text-sm">{reqError}</p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (!reqSelectedProduct || !reqQuantidade || Number(reqQuantidade) <= 0) return
                      setReqCarrinho(prev => {
                        const existing = prev.findIndex(i => i.productId === reqSelectedProduct.id)
                        if (existing >= 0) {
                          const updated = [...prev]
                          updated[existing] = { ...updated[existing], quantidade: updated[existing].quantidade + Number(reqQuantidade), observacao: reqObs || updated[existing].observacao }
                          return updated
                        }
                        return [...prev, { productId: reqSelectedProduct.id, nome: reqSelectedProduct.nome, unidadeMedida: reqSelectedProduct.unidadeMedida, quantidade: Number(reqQuantidade), observacao: reqObs }]
                      })
                      setReqSelectedProduct(null)
                      setReqQuantidade('')
                      setReqObs('')
                      setReqError('')
                      setReqSubScreen('product_search')
                    }}
                    disabled={!reqQuantidade || Number(reqQuantidade) <= 0}
                    className="w-full py-5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white text-xl font-extrabold uppercase tracking-wider transition disabled:opacity-40 flex items-center justify-center gap-3"
                  >
                    <ShoppingCart className="h-6 w-6" />
                    Adicionar ao Carrinho
                  </button>

                  <button
                    onClick={() => setReqSubScreen('product_search')}
                    className="w-full py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition flex items-center justify-center gap-2"
                  >
                    <ChevronLeft className="h-5 w-5" /> Voltar
                  </button>
                </>
              )}

              {/* ── Sub: sucesso ── */}
              {reqSubScreen === 'done' && (
                <div className="text-center py-6 space-y-4">
                  <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
                  <p className="text-white text-2xl font-bold">Requisição Enviada!</p>
                  <p className="text-zinc-500 text-xs">Ciclo: {reqSelectedCycle?.titulo}</p>

                  <div className="space-y-2 text-left pt-2">
                    {reqCarrinho.map((item) => (
                      <div key={item.productId} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3">
                        <p className="text-white font-semibold">{item.nome}</p>
                        <p className="text-zinc-500 text-xs">{item.quantidade} {item.unidadeMedida}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      onClick={goHome}
                      className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="h-5 w-5" /> Concluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ENCOMENDAS ── */}
          {screen === 'encomendas' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Olá,</p>
                  <p className="text-white text-xl font-bold">{totemUser?.nome}</p>
                </div>
                <button onClick={goHome} className="text-zinc-500 hover:text-white flex items-center gap-1.5 text-sm transition">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>

              <div className="flex items-center gap-2 mb-1">
                <ShoppingBag className="h-5 w-5 text-purple-400" />
                <h2 className="text-white font-bold text-lg">Nova Encomenda</h2>
              </div>

              {/* Indicador de etapas */}
              {encStep !== 'sucesso' && (
                <div className="flex gap-1.5">
                  {(['cliente', 'itens', 'valores', 'confirmacao'] as const).map((s, i) => (
                    <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${
                      ['cliente','itens','valores','confirmacao'].indexOf(encStep) >= i ? 'bg-purple-400' : 'bg-zinc-700'
                    }`} />
                  ))}
                </div>
              )}

              {/* ─── ETAPA: Cliente ─── */}
              {encStep === 'cliente' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wide">Nome do cliente *</label>
                    <input
                      value={encClienteNome}
                      onChange={(e) => setEncClienteNome(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full px-4 py-3.5 rounded-2xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-base focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wide">Telefone</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={encClienteTelefone}
                      onChange={(e) => setEncClienteTelefone(e.target.value)}
                      placeholder="(81) 99999-9999"
                      className="w-full px-4 py-3.5 rounded-2xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-base focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wide">Data de retirada *</label>
                    <input
                      type="date"
                      value={encDataRetirada}
                      onChange={(e) => setEncDataRetirada(e.target.value)}
                      className="w-full px-3 py-3.5 rounded-2xl bg-zinc-800 border border-zinc-700 text-white text-base focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wide">Hora de retirada *</label>
                    <TotemTimePicker value={encHoraRetirada} onChange={setEncHoraRetirada} />
                  </div>
                  <button
                    onClick={() => setEncStep('itens')}
                    disabled={encClienteNome.trim().length < 2 || !encDataRetirada}
                    className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-base flex items-center justify-center gap-2 transition"
                  >
                    Próximo <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}

              {/* ─── ETAPA: Itens ─── */}
              {encStep === 'itens' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-sm">Itens do pedido</span>
                    <button
                      onClick={encAddItem}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm transition"
                    >
                      <Plus className="h-4 w-4" /> Adicionar
                    </button>
                  </div>
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {encItens.map((item, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-zinc-800 border border-zinc-700 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500">Item {idx + 1}</span>
                          {encItens.length > 1 && (
                            <button onClick={() => encRemoveItem(idx)} className="text-red-500 hover:text-red-400">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <input
                          value={item.descricao}
                          onChange={(e) => encSetItem(idx, 'descricao', e.target.value)}
                          placeholder="Ex: Bolo de chocolate"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={item.quantidade}
                            onChange={(e) => encSetItem(idx, 'quantidade', e.target.value)}
                            placeholder="Qtd"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                          />
                          <select
                            value={item.unidade}
                            onChange={(e) => encSetItem(idx, 'unidade', e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                          >
                            {['un', 'kg', 'g', 'cx', 'pc', 'dt', 'fd'].map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                        <input
                          value={item.observacao}
                          onChange={(e) => encSetItem(idx, 'observacao', e.target.value)}
                          placeholder="Observação (opcional)"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEncStep('cliente')}
                      className="px-4 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setEncStep('valores')}
                      disabled={encItens.length === 0 || encItens.some((it) => !it.descricao.trim() || parseFloat(it.quantidade) <= 0)}
                      className="flex-1 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-base flex items-center justify-center gap-2 transition"
                    >
                      Próximo <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ─── ETAPA: Valores ─── */}
              {encStep === 'valores' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wide">Caução pago (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={encValorCaucao}
                      onChange={(e) => setEncValorCaucao(e.target.value)}
                      placeholder="0,00"
                      className="w-full px-4 py-3.5 rounded-2xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-base focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wide">Total estimado (R$)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={encValorTotal}
                      onChange={(e) => setEncValorTotal(e.target.value)}
                      placeholder="0,00"
                      className="w-full px-4 py-3.5 rounded-2xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-base focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 uppercase tracking-wide">Observações gerais</label>
                    <textarea
                      value={encObservacoes}
                      onChange={(e) => setEncObservacoes(e.target.value)}
                      rows={2}
                      placeholder="Instruções adicionais..."
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-base focus:outline-none focus:ring-2 focus:ring-purple-500 transition resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEncStep('itens')}
                      className="px-4 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setEncStep('confirmacao')}
                      className="flex-1 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-base flex items-center justify-center gap-2 transition"
                    >
                      Revisar <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ─── ETAPA: Confirmação ─── */}
              {encStep === 'confirmacao' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-zinc-800 border border-zinc-700 space-y-2 text-sm">
                    <div><span className="text-zinc-400">Cliente:</span> <span className="text-white font-semibold">{encClienteNome}</span></div>
                    {encClienteTelefone && <div><span className="text-zinc-400">Telefone:</span> <span className="text-white">{encClienteTelefone}</span></div>}
                    <div>
                      <span className="text-zinc-400">Retirada:</span>{' '}
                      <span className="text-white">{new Date(encDataRetirada + 'T12:00:00').toLocaleDateString('pt-BR')} às {encHoraRetirada}</span>
                    </div>
                    {parseFloat(encValorCaucao || '0') > 0 && (
                      <div><span className="text-zinc-400">Caução:</span> <span className="text-white">{parseFloat(encValorCaucao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    )}
                    {parseFloat(encValorTotal || '0') > 0 && (
                      <div><span className="text-zinc-400">Total est.:</span> <span className="text-white">{parseFloat(encValorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    )}
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-800 border border-zinc-700">
                    <p className="text-zinc-400 text-xs uppercase tracking-wide mb-2">Itens ({encItens.length})</p>
                    {encItens.map((it, i) => (
                      <div key={i} className="flex justify-between text-sm py-1 border-b border-zinc-700 last:border-0">
                        <span className="text-white">{it.descricao}</span>
                        <span className="text-zinc-400">{it.quantidade} {it.unidade}</span>
                      </div>
                    ))}
                  </div>
                  {encObservacoes && (
                    <p className="text-sm text-zinc-300 px-1">Obs: {encObservacoes}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEncStep('valores')}
                      className="px-4 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm transition"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={encConfirm}
                      disabled={encSaving}
                      className="flex-1 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-base flex items-center justify-center gap-2 transition"
                    >
                      {encSaving ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <Printer className="h-5 w-5" />
                      )}
                      {encSaving ? 'Registrando...' : 'Confirmar e Imprimir'}
                    </button>
                  </div>
                </div>
              )}

              {/* ─── ETAPA: Sucesso ─── */}
              {encStep === 'sucesso' && encResult && (
                <div className="flex flex-col items-center text-center space-y-5 py-4">
                  <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-12 w-12 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Encomenda Registrada!</h2>
                    <p className="text-zinc-400 mt-1">
                      Nº <span className="font-mono font-bold text-white">#{String(encResult.numeroOrdem).padStart(4, '0')}</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-800 border border-zinc-700 w-full text-left text-sm space-y-1">
                    <div><span className="text-zinc-400">Cliente:</span> <span className="text-white">{encResult.clienteNome}</span></div>
                    <div><span className="text-zinc-400">Retirada:</span> <span className="text-white">{new Date(encResult.dataRetirada).toLocaleDateString('pt-BR')} às {encResult.horaRetirada}</span></div>
                  </div>
                  <p className="text-sm text-zinc-500">Comprovante enviado para impressão.</p>
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => encTriggerPrint()}
                      className="flex-1 py-3 rounded-2xl bg-zinc-700 hover:bg-zinc-600 text-white font-medium flex items-center justify-center gap-2 transition"
                    >
                      <Printer className="h-4 w-4" /> Reimprimir
                    </button>
                    <button
                      onClick={() => { encReset(); setScreen('encomendas-menu') }}
                      className="flex-1 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition"
                    >
                      Nova Encomenda
                    </button>
                  </div>
                  <button onClick={goHome} className="text-zinc-500 hover:text-white text-sm transition">
                    Voltar ao início
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── ENCOMENDAS — MENU ── */}
          {screen === 'encomendas-menu' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-widest">Olá,</p>
                  <p className="text-white text-xl font-bold">{totemUser?.nome}</p>
                </div>
                <button onClick={goHome} className="text-zinc-500 hover:text-white flex items-center gap-1.5 text-sm transition">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>

              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-purple-400" />
                <h2 className="text-white font-bold text-lg">Encomendas</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 pt-2">
                <button
                  onClick={() => { encReset(); setScreen('encomendas') }}
                  className="flex items-center gap-4 p-5 rounded-2xl bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white transition touch-manipulation"
                >
                  <Plus className="h-8 w-8 shrink-0" />
                  <div className="text-left">
                    <div className="font-bold text-lg">Nova Encomenda</div>
                    <div className="text-purple-200 text-sm mt-0.5">Registrar pedido de cliente</div>
                  </div>
                  <ChevronRight className="h-5 w-5 ml-auto shrink-0 text-purple-300" />
                </button>

                <button
                  onClick={() => { setScreen('encomendas-pendentes'); encLoadPendentes() }}
                  className="flex items-center gap-4 p-5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 border border-zinc-700 text-white transition touch-manipulation"
                >
                  <ListChecks className="h-8 w-8 shrink-0 text-amber-400" />
                  <div className="text-left">
                    <div className="font-bold text-lg">Consultar Pendentes</div>
                    <div className="text-zinc-400 text-sm mt-0.5">Ver encomendas aguardando retirada</div>
                  </div>
                  <ChevronRight className="h-5 w-5 ml-auto shrink-0 text-zinc-500" />
                </button>
              </div>
            </div>
          )}

          {/* ── ENCOMENDAS — PENDENTES ── */}
          {screen === 'encomendas-pendentes' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setEncPendentesDetail(null); setScreen('encomendas-menu') }}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition"
                >
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </button>
                <button onClick={goHome} className="text-zinc-500 hover:text-white flex items-center gap-1.5 text-sm transition">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-amber-400" />
                  <h2 className="text-white font-bold text-lg">Aguardando Retirada</h2>
                  {!encPendentesLoading && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                      {encPendentes.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={encLoadPendentes}
                  disabled={encPendentesLoading}
                  className="text-zinc-500 hover:text-white transition disabled:opacity-40"
                >
                  <RefreshCw className={`h-4 w-4 ${encPendentesLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {encPendentesLoading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-zinc-500">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Carregando...</span>
                </div>
              ) : encPendentes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-500">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500/40" />
                  <p className="text-sm font-medium text-zinc-400">Nenhuma encomenda pendente</p>
                  <p className="text-xs text-zinc-600">Todas as encomendas foram finalizadas!</p>
                </div>
              ) : encPendentesDetail ? (
                /* ── Detalhe de uma encomenda ── */
                <div className="space-y-4">
                  <button
                    onClick={() => setEncPendentesDetail(null)}
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition"
                  >
                    <ChevronLeft className="h-4 w-4" /> Lista
                  </button>

                  <div className="p-4 rounded-2xl bg-zinc-800 border border-zinc-700 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-zinc-400">
                        #{String(encPendentesDetail.numeroOrdem).padStart(4, '0')}
                      </span>
                      {encPendentesDetail.status === 'pendente' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                          <Clock className="h-3 w-3" /> Pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                          <PackageCheck className="h-3 w-3" /> Pronta
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm">
                      <div><span className="text-zinc-400">Cliente:</span> <span className="text-white font-medium">{encPendentesDetail.clienteNome}</span></div>
                      {encPendentesDetail.clienteTelefone && (
                        <div><span className="text-zinc-400">Telefone:</span> <span className="text-white">{encPendentesDetail.clienteTelefone}</span></div>
                      )}
                      <div><span className="text-zinc-400">Retirada:</span> <span className="text-white">{new Date(encPendentesDetail.dataRetirada).toLocaleDateString('pt-BR')} às {encPendentesDetail.horaRetirada}</span></div>
                      {Number(encPendentesDetail.valorCaucao) > 0 && (
                        <div><span className="text-zinc-400">Caução pago:</span> <span className="text-white">{Number(encPendentesDetail.valorCaucao).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                      )}
                      {Number(encPendentesDetail.valorTotal) > 0 && (
                        <div><span className="text-zinc-400">Total estimado:</span> <span className="text-white">{Number(encPendentesDetail.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                      )}
                      {encPendentesDetail.observacoes && (
                        <div><span className="text-zinc-400">Obs:</span> <span className="text-white">{encPendentesDetail.observacoes}</span></div>
                      )}
                    </div>

                    <div className="border-t border-zinc-700 pt-3">
                      <p className="text-xs text-zinc-400 uppercase tracking-wide mb-2 font-semibold">Itens</p>
                      <div className="space-y-1.5">
                        {encPendentesDetail.itens?.map((item: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-zinc-600 text-xs mt-0.5 w-4 shrink-0">{i + 1}.</span>
                            <div>
                              <span className="text-white">{item.descricao}</span>
                              <span className="text-zinc-400 text-xs ml-2">{Number(item.quantidade).toLocaleString('pt-BR')} {item.unidade}</span>
                              {item.observacao && <div className="text-xs text-zinc-500">{item.observacao}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => encTriggerPrint(encPendentesDetail)}
                      className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-zinc-700 hover:bg-zinc-600 text-white font-medium transition touch-manipulation"
                    >
                      <Printer className="h-4 w-4" /> Reimprimir
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('Marcar como retirada?')) return
                        await encFinalizar(encPendentesDetail.id)
                      }}
                      disabled={encFinalizando}
                      className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition touch-manipulation"
                    >
                      {encFinalizando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {encFinalizando ? 'Finalizando...' : 'Finalizar'}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Lista de pendentes ── */
                <div className="space-y-2">
                  {encPendentes.map((enc: any) => {
                    const isAtrasada = new Date(enc.dataRetirada) < new Date(new Date().toDateString())
                    return (
                      <button
                        key={enc.id}
                        onClick={() => setEncPendentesDetail(enc)}
                        className="w-full text-left p-4 rounded-2xl bg-zinc-800 border border-zinc-700 hover:border-amber-500/50 hover:bg-zinc-750 active:bg-zinc-900 transition touch-manipulation group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="font-mono text-xs font-bold text-zinc-500">
                                #{String(enc.numeroOrdem).padStart(4, '0')}
                              </span>
                              {enc.status === 'pendente' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-400">
                                  <Clock className="h-2.5 w-2.5" /> Pendente
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-400">
                                  <PackageCheck className="h-2.5 w-2.5" /> Pronta
                                </span>
                              )}
                              {isAtrasada && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-red-500/20 text-red-400">
                                  Atrasada
                                </span>
                              )}
                            </div>
                            <div className="text-white font-semibold truncate">{enc.clienteNome}</div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                              <span>{new Date(enc.dataRetirada).toLocaleDateString('pt-BR')} às {enc.horaRetirada}</span>
                              <span>{enc.itens?.length ?? 0} item(ns)</span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-amber-400 transition-colors shrink-0 mt-1" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Footer ── */}
      {screen === 'home' && (
        <div className="pb-6 text-center">
          <p className="text-zinc-700 text-xs">PAI · Pernambucana Administração Integrada</p>
        </div>
      )}
    </div>
  )
}
