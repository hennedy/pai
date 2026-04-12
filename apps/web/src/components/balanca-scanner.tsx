'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2, ScanLine, Keyboard } from 'lucide-react'

/**
 * Parseia codigo de balanca EAN-13 (prefixo 2).
 * Formato: 2 PPPPP WWWWW C
 *   P = codigoBalanca do produto (5 digitos)
 *   W = peso em gramas (5 digitos, 3 casas decimais implicitas)
 */
export function parseCodigoBalanca(barcode: string): { codigoBalanca: string; pesoKg: number } | null {
  const clean = barcode.replace(/\s/g, '')
  if (clean.length !== 13 || !clean.startsWith('2')) return null
  const codigoBalanca = clean.substring(1, 6)
  const pesoGramas = parseInt(clean.substring(6, 11), 10)
  if (isNaN(pesoGramas)) return null
  return { codigoBalanca, pesoKg: pesoGramas / 1000 }
}

interface BalancaScannerProps {
  onDetected: (barcode: string) => void
  onClose?: () => void
}

export function BalancaScanner({ onDetected, onClose }: BalancaScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const detectedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [showManual, setShowManual] = useState(false)

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

    async function startScanner() {
      if (!videoRef.current) return

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera requer HTTPS. Inicie com "npm run dev" ou acesse via https://. Use o campo manual por enquanto.')
        setShowManual(true)
        return
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      } catch (e: any) {
        if (cancelled) return
        const name = e?.name ?? ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('Permissao de camera negada. Permita o acesso nas configuracoes do navegador ou use o campo manual.')
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError('Nenhuma camera encontrada neste dispositivo. Use o campo manual.')
        } else {
          setError(`Camera indisponivel (${name || e?.message || 'erro desconhecido'}). Use o campo manual.`)
        }
        setShowManual(true)
        return
      }

      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
      streamRef.current = stream
      videoRef.current.srcObject = stream
      try { await videoRef.current.play() } catch { /* nao critico */ }
      setScanning(true)

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
        setError(`Erro no leitor de codigos: ${e?.message ?? 'desconhecido'}. Use o campo manual.`)
        setShowManual(true)
      }
    }

    startScanner()
    return () => { cancelled = true; stopCamera() }
  }, [handleDetect, stopCamera])

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = manualInput.trim()
    if (!trimmed) return
    handleDetect(trimmed)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`relative rounded-lg overflow-hidden bg-black aspect-video ${showManual ? 'hidden' : ''}`}>
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        {scanning && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-28 border-2 border-emerald-400 rounded-lg opacity-80 animate-pulse" />
            </div>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <span className="text-xs text-white bg-black/60 px-2 py-1 rounded-full flex items-center gap-1">
                <ScanLine className="w-3 h-3" />
                Aponte para o codigo de barras da balanca
              </span>
            </div>
          </>
        )}
        {!scanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showManual ? (
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-2">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <Keyboard className="w-4 h-4" />
            Digitar codigo de barras manualmente
          </label>
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={13}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Ex: 2012340012345"
              className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            />
            <Button type="submit" disabled={manualInput.length < 8}>
              Confirmar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Codigo EAN-13 de balanca: 13 digitos comecando com 2
          </p>
        </form>
      ) : (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setShowManual(true)}>
          <Keyboard className="w-4 h-4 mr-2" />
          Digitar manualmente
        </Button>
      )}
    </div>
  )
}
