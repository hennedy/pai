'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Users, Package, Building2, KeyRound, Plug, Shield, Loader2, LayoutList, Settings2, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'

type TabId = 'usuarios' | 'produtos' | 'unidades' | 'perfis' | 'integracoes' | 'auditoria' | 'setores' | 'sistema' | 'impressoras'

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'usuarios',    label: 'Usuários',    icon: Users },
  { id: 'produtos',    label: 'Produtos',    icon: Package },
  { id: 'unidades',    label: 'Unidades',    icon: Building2 },
  { id: 'perfis',      label: 'Perfis',      icon: KeyRound },
  { id: 'setores',     label: 'Setores',     icon: LayoutList },
  { id: 'impressoras', label: 'Impressoras', icon: Printer },
  { id: 'integracoes', label: 'Integrações', icon: Plug },
  { id: 'auditoria',   label: 'Auditoria',   icon: Shield },
  { id: 'sistema',     label: 'Sistema',     icon: Settings2 },
]

function TabLoader() {
  return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

const UsuariosTab    = dynamic(() => import('../usuarios/page'),    { ssr: false, loading: TabLoader })
const ProdutosTab    = dynamic(() => import('../produtos/page'),    { ssr: false, loading: TabLoader })
const UnidadesTab    = dynamic(() => import('../unidades/page'),    { ssr: false, loading: TabLoader })
const PerfisTab      = dynamic(() => import('../perfis/page'),      { ssr: false, loading: TabLoader })
const IntegracoesTab = dynamic(() => import('../integracoes/page'), { ssr: false, loading: TabLoader })
const AuditoriaTab   = dynamic(() => import('../auditoria/page'),   { ssr: false, loading: TabLoader })
const SetoresTab     = dynamic(() => import('../setores/page'),     { ssr: false, loading: TabLoader })
const SistemaTab     = dynamic(() => import('./sistema/page'),      { ssr: false, loading: TabLoader })
const ImpressorasTab = dynamic(() => import('../impressoras/page'), { ssr: false, loading: TabLoader })

const tabContent: Record<TabId, React.ComponentType> = {
  usuarios:    UsuariosTab,
  produtos:    ProdutosTab,
  unidades:    UnidadesTab,
  perfis:      PerfisTab,
  setores:     SetoresTab,
  impressoras: ImpressorasTab,
  integracoes: IntegracoesTab,
  auditoria:   AuditoriaTab,
  sistema:     SistemaTab,
}

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('usuarios')
  const Content = tabContent[activeTab]

  return (
    <div className="animate-fade-up space-y-0">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie usuários, produtos, unidades e configurações do sistema
        </p>
      </div>

      {/* Tabs container */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        {/* Tab nav */}
        <div className="border-b border-border/50 bg-muted/30 px-2">
          <nav className="flex overflow-x-auto no-scrollbar -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-all duration-150 touch-manipulation',
                    isActive
                      ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-background/60'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-background/40'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab content */}
        <div className="p-4 sm:p-6">
          <Content />
        </div>
      </div>
    </div>
  )
}
