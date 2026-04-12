'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  Camera, MapPin, Send, CheckCircle2, ChevronLeft, AlertCircle,
  FileText, Hash, Package, Star, Loader2, ShieldAlert, Navigation,
  WifiOff, LocateFixed,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Haversine: distancia em metros entre dois pontos GPS
// ---------------------------------------------------------------------------
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type GpsStatus = 'loading' | 'ok' | 'denied' | 'error'
type LocationStatus = 'checking' | 'inside' | 'outside' | 'no-unit-location'

export default function ExecucaoChecklistPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = params

  const [responses, setResponses] = useState<Record<string, any>>({})
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('loading')
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('checking')
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null)
  const watchIdRef = useRef<number | null>(null)

  // Buscar execucao
  const { data: exec, isLoading, isError } = useQuery({
    queryKey: ['checklist-execution', id],
    queryFn: () => api.get(`/checklist/executions/${id}`),
    retry: 1,
  })

  // Populate initial responses
  useEffect(() => {
    if (exec?.responses && exec.responses.length > 0) {
      const init: any = {}
      exec.responses.forEach((r: any) => {
        init[r.itemId] = {
          resposta: r.resposta || '',
          fotoUrl: r.fotoUrl || '',
          naoAplicavel: r.naoAplicavel || false,
        }
      })
      setResponses(init)
    }
  }, [exec])

  // Geolocation + geofencing
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('denied')
      setLocationStatus('no-unit-location')
      return
    }

    const onSuccess = (pos: GeolocationPosition) => {
      const userLat = pos.coords.latitude
      const userLng = pos.coords.longitude
      setGps({ lat: userLat, lng: userLng })
      setGpsStatus('ok')

      // Validate against unit location once exec data arrives
      if (exec?.unit) {
        const { latitude, longitude, raioValidacaoMetros } = exec.unit
        if (latitude == null || longitude == null) {
          setLocationStatus('no-unit-location')
        } else {
          const radius = raioValidacaoMetros ?? 300
          const dist = haversineMeters(userLat, userLng, latitude, longitude)
          setDistanceMeters(Math.round(dist))
          setLocationStatus(dist <= radius ? 'inside' : 'outside')
        }
      }
    }

    const onError = (err: GeolocationPositionError) => {
      if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
        setGpsStatus('denied')
      } else {
        setGpsStatus('error')
      }
      setLocationStatus('no-unit-location')
    }

    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    })

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exec?.unit])

  const completeMutation = useMutation({
    mutationFn: async () => {
      const payload: any[] = []
      Object.entries(responses).forEach(([itemId, val]) => {
        payload.push({
          itemId,
          resposta: val.resposta || null,
          fotoUrl: val.fotoUrl || null,
          naoAplicavel: val.naoAplicavel || false,
        })
      })

      if (payload.length > 0) {
        await api.put(`/checklist/executions/${id}`, {
          responses: payload,
          latitude: gps?.lat,
          longitude: gps?.lng,
        })
      }

      return api.patch(`/checklist/executions/${id}/complete`, {})
    },
    onSuccess: (data) => {
      toast.success(`Checklist Concluido! Score: ${data?.score?.toFixed(1) || 100}%`)
      queryClient.invalidateQueries({ queryKey: ['checklist-executions'] })
      router.push('/checklist')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Existem itens pendentes ou erro ao enviar.')
    },
  })

  const handleChange = (itemId: string, field: string, value: any) => {
    setResponses((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { resposta: '', fotoUrl: '', naoAplicavel: false }),
        [field]: value,
      },
    }))
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-amber-600 animate-pulse font-medium flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando formulario...
      </div>
    )
  }

  if (isError || !exec) {
    return (
      <div className="p-8 text-center text-red-500 font-medium">
        Erro ao carregar execucao. Pode nao existir ou ja estar concluida.
      </div>
    )
  }

  const template = exec.template
  const itens = template?.items || []
  const unit = exec.unit
  const unitHasLocation = unit?.latitude != null && unit?.longitude != null

  // -----------------------------------------------------------------------
  // BLOQUEIO: GPS negado E unidade tem coordenadas cadastradas
  // -----------------------------------------------------------------------
  if (gpsStatus === 'denied' && unitHasLocation) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-6 px-4">
        <div className="h-20 w-20 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <ShieldAlert className="h-10 w-10 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">Acesso ao GPS negado</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Este checklist pertence à unidade <strong>{unit?.nome || unit?.codigo}</strong> e só pode ser executado
            no local físico da unidade. Precisamos da sua localização para validar sua presença.
          </p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          Ative a permissão de localização nas configurações do seu navegador e recarregue a página.
        </div>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
        >
          <LocateFixed className="h-4 w-4" /> Tentar novamente
        </button>
        <button onClick={() => router.back()} className="block mx-auto text-sm text-muted-foreground hover:text-foreground transition">
          Voltar
        </button>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // BLOQUEIO: fora do raio
  // -----------------------------------------------------------------------
  if (locationStatus === 'outside') {
    const radius = unit?.raioValidacaoMetros ?? 300
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-6 px-4">
        <div className="h-20 w-20 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <Navigation className="h-10 w-10 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">Você está fora da unidade</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Este checklist só pode ser executado dentro da unidade{' '}
            <strong>{unit?.nome || unit?.codigo}</strong>.
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sua distância da unidade</span>
            <span className="font-bold text-red-600 dark:text-red-400">{distanceMeters}m</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Raio permitido</span>
            <span className="font-medium">{radius}m</span>
          </div>
          <div className="w-full bg-red-200 dark:bg-red-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-red-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, (radius / (distanceMeters || 1)) * 100)}%` }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Dirija-se ao local físico da unidade para executar este checklist.</p>
        <button onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground transition">
          Voltar
        </button>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Checando GPS (ainda buscando posicao)
  // -----------------------------------------------------------------------
  if (gpsStatus === 'loading' && unitHasLocation) {
    return (
      <div className="p-8 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto" />
        <p className="text-sm text-muted-foreground">Verificando sua localização...</p>
        <p className="text-xs text-muted-foreground/60">Autorize o acesso ao GPS quando solicitado pelo navegador.</p>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Icones por tipo de item
  // -----------------------------------------------------------------------
  const getTypeIcon = (tipo: string) => {
    switch (tipo) {
      case 'texto': return <FileText className="w-4 h-4 text-blue-500" />
      case 'numero': return <Hash className="w-4 h-4 text-purple-500" />
      case 'estoque': return <Package className="w-4 h-4 text-orange-500" />
      case 'estrelas': return <Star className="w-4 h-4 text-yellow-500" />
      case 'foto': return <Camera className="w-4 h-4 text-rose-500" />
      default: return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-fade-in pb-24">
      {/* Header Fixo */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border py-4 sm:py-5 px-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-accent text-foreground transition">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-bold leading-tight">{template.nome}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs sm:text-sm font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full capitalize">
                  {exec.turno}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(exec.data).toLocaleDateString()}</span>
                {locationStatus === 'inside' && distanceMeters != null && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {distanceMeters}m da unidade
                  </span>
                )}
                {locationStatus === 'no-unit-location' && gpsStatus === 'ok' && (
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> GPS ativo
                  </span>
                )}
                {!unitHasLocation && (
                  <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                    <WifiOff className="h-3 w-3" /> Sem validação de local
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => completeMutation.mutate()}
            disabled={completeMutation.isPending}
            className="hidden sm:flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium shadow-warm-md hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            {completeMutation.isPending ? 'Enviando...' : 'Finalizar'}
            <Send className="h-4 w-4" />
          </button>
        </div>

        {/* Aviso se unidade sem coordenadas */}
        {!unitHasLocation && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            A unidade ainda não possui coordenadas cadastradas. Qualquer pessoa pode executar este checklist remotamente.
            Configure as coordenadas em Configurações → Unidades.
          </div>
        )}
      </div>

      {/* Lista de Itens */}
      <div className="space-y-4 px-1">
        {itens.map((item: any, idx: number) => {
          const respState = responses[item.id] || {}
          const isDone = respState.resposta !== '' || respState.fotoUrl !== ''
          const isRequiredAndMissing = item.obrigatorio && !isDone && !respState.naoAplicavel

          return (
            <div
              key={item.id}
              className={`p-5 sm:p-6 rounded-2xl border ${
                isRequiredAndMissing
                  ? 'border-amber-300 dark:border-amber-700/50 bg-amber-50/30 dark:bg-amber-900/10'
                  : 'border-border/60 bg-card'
              } shadow-sm transition-colors relative overflow-hidden`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`mt-0.5 flex items-center justify-center w-8 h-8 rounded-full ${
                    isDone
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                      : 'bg-accent text-muted-foreground'
                  } transition-colors font-bold text-sm shrink-0`}
                >
                  {idx + 1}
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex gap-2 items-center mb-1">
                      {getTypeIcon(item.tipo)}
                      {item.isCritico && (
                        <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />Critico
                        </span>
                      )}
                    </div>
                    <p className="text-base sm:text-lg font-medium text-foreground">{item.descricao}</p>
                    {item.obrigatorio && <span className="text-xs font-semibold text-amber-500">* Obrigatorio</span>}
                    {item.exigeFoto && <span className="text-xs font-semibold text-rose-500 ml-2">* Foto Exigida</span>}
                  </div>

                  {!respState.naoAplicavel && (
                    <div className="pt-2">
                      {item.tipo === 'checkbox' && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleChange(item.id, 'resposta', 'true')}
                            className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${
                              respState.resposta === 'true'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'
                                : 'border-border/60 hover:border-emerald-500/50 text-muted-foreground'
                            }`}
                          >
                            Conforme / Sim
                          </button>
                          <button
                            onClick={() => handleChange(item.id, 'resposta', 'false')}
                            className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${
                              respState.resposta === 'false'
                                ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20'
                                : 'border-border/60 hover:border-red-500/50 text-muted-foreground'
                            }`}
                          >
                            Inconforme / Nao
                          </button>
                        </div>
                      )}

                      {(item.tipo === 'texto' || item.tipo === 'numero' || item.tipo === 'estoque') && (
                        <input
                          type={item.tipo === 'texto' ? 'text' : 'number'}
                          value={respState.resposta || ''}
                          onChange={(e) => handleChange(item.id, 'resposta', e.target.value)}
                          placeholder={item.tipo === 'texto' ? 'Escreva os detalhes aqui...' : 'Digite o valor numerico...'}
                          className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 ring-amber-500/50 focus:border-amber-500 transition-all text-base"
                        />
                      )}

                      {item.tipo === 'estrelas' && (
                        <div className="flex gap-2 items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => handleChange(item.id, 'resposta', star.toString())}
                              className={`p-2 transition-transform hover:scale-110 ${
                                Number(respState.resposta) >= star ? 'text-yellow-400' : 'text-muted-foreground/30'
                              }`}
                            >
                              <Star className={`w-8 h-8 ${Number(respState.resposta) >= star ? 'fill-current' : ''}`} />
                            </button>
                          ))}
                        </div>
                      )}

                      {(item.tipo === 'foto' || item.exigeFoto) && (
                        <div className="mt-4">
                          {respState.fotoUrl ? (
                            <div className="relative rounded-xl overflow-hidden border border-border/50 group h-32 w-32">
                              <img src={respState.fotoUrl} alt="Evidencia" className="object-cover w-full h-full" />
                              <button
                                onClick={() => handleChange(item.id, 'fotoUrl', '')}
                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold"
                              >
                                Tentar Novamente
                              </button>
                            </div>
                          ) : (
                            <label className="cursor-pointer flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-border/80 hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 text-muted-foreground rounded-xl transition">
                              <Camera className="w-5 h-5 text-amber-500" />
                              <span className="font-medium text-sm">Tirar Foto de Evidencia</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) {
                                    handleChange(item.id, 'fotoUrl', URL.createObjectURL(file))
                                    toast.success('Foto anexada (Local)')
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* N/A Toggle */}
                  <div className="pt-2 flex justify-end">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={respState.naoAplicavel}
                        onChange={(e) => handleChange(item.id, 'naoAplicavel', e.target.checked)}
                        className="rounded border-border"
                      />
                      Item N/A (Nao se Aplica)
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Floating Mobile Action Button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm z-30 sm:hidden">
        <button
          onClick={() => completeMutation.mutate()}
          disabled={completeMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 active:scale-95 text-white font-bold text-lg shadow-[0_8px_30px_rgb(16,185,129,0.3)] transition-all disabled:opacity-50"
        >
          {completeMutation.isPending ? 'Enviando...' : 'Finalizar Checklist'}
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
