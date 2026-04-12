'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Eye, EyeOff, Wheat } from 'lucide-react'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [senha, setSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const login = useAuthStore((s) => s.login)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      await login(identifier, senha)
      router.push('/')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Left side - decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-amber-800 via-amber-900 to-warm-950 items-center justify-center p-12">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-amber-300" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Floating decorative elements */}
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-amber-500/10 blur-3xl animate-float" />
        <div className="absolute bottom-32 right-16 w-48 h-48 rounded-full bg-amber-400/10 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/3 w-24 h-24 rounded-full bg-orange-400/10 blur-2xl animate-float" style={{ animationDelay: '4s' }} />

        {/* Content */}
        <div className="relative z-10 text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-500/20 backdrop-blur-sm border border-amber-400/20 mb-8 animate-fade-up">
            <Wheat className="w-10 h-10 text-amber-300" />
          </div>
          <h1 className="font-display text-5xl font-semibold text-amber-50 mb-4 tracking-tightest animate-fade-up stagger-1">
            Pernambucana<br />Administração<br />Integrada
          </h1>
          <div className="w-16 h-0.5 bg-amber-500/40 mx-auto mb-6 animate-fade-up stagger-2" />
          <p className="text-amber-200/60 text-lg leading-relaxed font-medium animate-fade-up stagger-3">
            Gestao completa para sua rede de padarias.
            Controle producao, estoque e qualidade em um so lugar.
          </p>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gradient-to-br from-warm-50 to-amber-50/50 dark:from-neutral-950 dark:to-neutral-900">
        <div className="w-full max-w-[420px] animate-fade-up">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-amber text-white mb-3">
              <Wheat className="w-7 h-7" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-foreground tracking-tight">PAI</h1>
            <p className="text-[13px] text-muted-foreground font-medium mt-1">Pernambucana Administração Integrada</p>
          </div>

          {/* Form header */}
          <div className="mb-8">
            <h2 className="font-display text-3xl font-semibold text-foreground mb-2 tracking-tightest">
              Bem-vindo
            </h2>
            <p className="text-[15px] text-muted-foreground/70 font-medium">
              Entre com suas credenciais para acessar o sistema
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="block text-[13px] font-semibold text-foreground">
                Email ou nome de usuario
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 shadow-warm-sm"
                placeholder="seu@email.com ou usuario"
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="senha" className="block text-[13px] font-semibold text-foreground">
                Senha
              </label>
              <div className="relative">
                <input
                  id="senha"
                  type={showPassword ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all duration-200 shadow-warm-sm"
                  placeholder="Digite sua senha"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-amber text-white font-bold tracking-tight transition-all duration-200 hover:shadow-glow hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-10 text-center text-xs text-muted-foreground/60">
            PAI - Pernambucana Administração Integrada
          </p>
        </div>
      </div>
    </div>
  )
}
