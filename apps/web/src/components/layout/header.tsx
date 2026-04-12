'use client'

import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'next/navigation'
import { Bell, LogOut, Moon, Sun, ChevronDown, Building2, Menu, Settings } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

interface HeaderProps {
  onMenuToggle: () => void
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, selectedUnitId, setSelectedUnit, isGerenteGeral, logout } = useAuthStore()
  const router = useRouter()
  const [darkMode, setDarkMode] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showUnitSelector, setShowUnitSelector] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const unitMenuRef = useRef<HTMLDivElement>(null)

  // Buscar contagem de notificacoes nao lidas
  const { data: notifData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => api.get('/notifications', { page: 1, limit: 1, lida: false }),
    refetchInterval: 30000,
    enabled: !!user,
  })
  const unreadCount = notifData?.total || 0

  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true'
    setDarkMode(isDark)
    if (isDark) document.documentElement.classList.add('dark')
  }, [])

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
      if (unitMenuRef.current && !unitMenuRef.current.contains(e.target as Node)) {
        setShowUnitSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleDarkMode() {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('darkMode', String(next))
    document.documentElement.classList.toggle('dark', next)
  }

  async function handleLogout() {
    setShowUserMenu(false)
    await logout()
    router.push('/login')
  }

  const selectedUnit = user?.roles.find((r) => r.unitId === selectedUnitId)

  return (
    <header className="sticky top-0 z-30 flex h-[60px] lg:h-16 items-center gap-1.5 sm:gap-2 border-b border-border/40 bg-background/85 glass px-3 sm:px-4 lg:px-6">
      {/* Hamburger - mobile/tablet only */}
      <button
        onClick={onMenuToggle}
        className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-accent active:bg-accent/80 transition-colors lg:hidden touch-manipulation"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5 text-foreground/70" />
      </button>

      {/* Mobile logo */}
      <span className="font-display font-semibold text-lg text-foreground tracking-tight lg:hidden">PAI</span>

      <div className="flex-1" />

      {/* Unit selector */}
      {isGerenteGeral() && (
        <div className="relative" ref={unitMenuRef}>
          <button
            onClick={() => setShowUnitSelector(!showUnitSelector)}
            className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-border/50 bg-card/80 px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm hover:shadow-warm hover:border-border/80 transition-all duration-200 touch-manipulation"
          >
            <Building2 className="h-3.5 w-3.5 text-primary/70 hidden sm:block" />
            <span className="font-medium max-w-[80px] sm:max-w-none truncate">
              {selectedUnit?.unitCode || 'Todas'}
            </span>
            <ChevronDown className={`h-3 w-3 text-muted-foreground/50 transition-transform duration-200 ${showUnitSelector ? 'rotate-180' : ''}`} />
          </button>

          {showUnitSelector && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border/50 bg-card shadow-warm-lg py-1.5 z-50 animate-fade-in">
              <button
                onClick={() => { setSelectedUnit(null as any); setShowUnitSelector(false) }}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent rounded-xl mx-1 w-[calc(100%-8px)] transition-colors font-medium touch-manipulation"
              >
                Todas as unidades
              </button>
              <div className="h-px bg-border/40 mx-3 my-1" />
              {user?.roles.map((r) => (
                <button
                  key={r.unitId}
                  onClick={() => { setSelectedUnit(r.unitId); setShowUnitSelector(false) }}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-accent rounded-xl mx-1 w-[calc(100%-8px)] transition-colors touch-manipulation ${
                    selectedUnitId === r.unitId ? 'text-primary font-semibold bg-primary/5' : ''
                  }`}
                >
                  {r.unitCode}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent active:bg-accent/80 transition-all duration-200 touch-manipulation"
        title={darkMode ? 'Modo claro' : 'Modo escuro'}
      >
        {darkMode ? (
          <Sun className="h-[17px] w-[17px] text-amber-400" />
        ) : (
          <Moon className="h-[17px] w-[17px] text-muted-foreground/60" />
        )}
      </button>

      {/* Notifications */}
      <button
        onClick={() => router.push('/notificacoes')}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent active:bg-accent/80 transition-all duration-200 touch-manipulation"
        title="Notificacoes"
      >
        <Bell className="h-[17px] w-[17px] text-muted-foreground/60" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Settings */}
      <button
        onClick={() => router.push('/configuracoes')}
        className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-accent active:bg-accent/80 transition-all duration-200 touch-manipulation"
        title="Configurações"
      >
        <Settings className="h-[17px] w-[17px] text-muted-foreground/60" />
      </button>

      {/* Divider */}
      <div className="h-7 w-px bg-border/40 mx-0.5 hidden sm:block" />

      {/* User menu */}
      <div className="relative" ref={userMenuRef}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2 sm:gap-2.5 rounded-xl px-1.5 sm:px-2 py-1.5 hover:bg-accent active:bg-accent/80 transition-all duration-200 touch-manipulation"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-amber text-white text-xs font-bold shadow-warm-sm shrink-0">
            {(user?.primeiroNome || user?.nome)?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="text-left hidden md:block">
            <p className="text-[13px] font-bold leading-tight tracking-tight">{user?.primeiroNome || user?.nome}</p>
            <p className="text-[11px] text-muted-foreground/50 leading-tight font-medium">{user?.email}</p>
          </div>
          <ChevronDown className={`h-3 w-3 text-muted-foreground/40 hidden md:block transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
        </button>

        {showUserMenu && (
          <div className="absolute right-0 top-full mt-2 w-56 sm:w-52 rounded-2xl border border-border/50 bg-card shadow-warm-lg py-1.5 z-50 animate-fade-in">
            <div className="px-4 py-3 border-b border-border/40 md:hidden">
              <p className="text-sm font-semibold">{user?.primeiroNome || user?.nome}</p>
              <p className="text-xs text-muted-foreground/60">{user?.email}</p>
            </div>
            <Link
              href="/configuracoes"
              onClick={() => setShowUserMenu(false)}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-accent rounded-xl mx-1 w-[calc(100%-8px)] transition-colors flex items-center gap-2.5 font-medium touch-manipulation"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              Configurações
            </Link>
            <div className="h-px bg-border/40 mx-3 my-1" />
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2.5 text-left text-sm text-destructive hover:bg-destructive/5 rounded-xl mx-1 w-[calc(100%-8px)] transition-colors flex items-center gap-2.5 font-medium touch-manipulation"
            >
              <LogOut className="h-4 w-4" />
              Sair do sistema
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
