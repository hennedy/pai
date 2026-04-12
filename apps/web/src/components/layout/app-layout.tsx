'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { Wheat } from 'lucide-react'
import { ErrorBoundary } from '@/components/error-boundary'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, loadUser } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    loadUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Close sidebar on ESC
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  // Close sidebar on resize to desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  // Pagina de login nao usa o layout
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-5 animate-fade-up">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-gradient-amber flex items-center justify-center shadow-glow">
              <Wheat className="h-7 w-7 text-white" />
            </div>
            <div className="absolute inset-0 h-14 w-14 rounded-2xl bg-gradient-amber opacity-30 blur-xl" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="font-display text-lg font-semibold text-foreground">Carregando</p>
            <div className="flex gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Nao autenticado
  if (!user) {
    router.push('/login')
    return null
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 w-full lg:ml-[260px] min-w-0">
        <Header onMenuToggle={toggleSidebar} />
        <main className="p-3 sm:p-4 md:p-6 lg:p-8 animate-fade-in">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
