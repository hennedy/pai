'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ChefHat,
  Tag,
  Wrench,
  ClipboardCheck,
  AlertTriangle,
  Bell,
  BarChart3,
  Wheat,
  X,
  Grid2X2,
  Briefcase,
  UserCircle,
  UserPlus,
  UserMinus,
  UmbrellaOff,
  FileText,
  ReceiptText,
  Gift,
  Stethoscope,
  Clock,
  TrendingUp,
  Megaphone,
  GitBranch,
  LayoutList,
  BarChart2,
  PackageX,
  ArrowRightLeft,
  ShoppingBag,
} from 'lucide-react'

interface MenuItem {
  href: string
  label: string
  icon: React.ElementType
  badgeKey?: string
  module?: string // modulo do sistema para controle de permissao
}

interface MenuSection {
  label: string | null
  items: MenuItem[]
}

const menuSections: MenuSection[] = [
  {
    label: null,
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
    ],
  },
  {
    label: 'Operacoes',
    items: [
      { href: '/producao', label: 'Producao', icon: ChefHat, module: 'producao' },
      { href: '/estoque', label: 'Estoque', icon: Package, badgeKey: 'alertasEstoque', module: 'estoque' },
      { href: '/compras', label: 'Compras', icon: ShoppingCart, module: 'compras' },
      { href: '/etiquetas', label: 'Etiquetas', icon: Tag, module: 'etiquetas' },
      { href: '/utensilios', label: 'Utensilios', icon: Wrench, module: 'utensilios' },
      { href: '/descartes', label: 'Descartes', icon: PackageX, module: 'descartes' },
      { href: '/transferencias', label: 'Transferencias', icon: ArrowRightLeft, module: 'transferencias' },
      { href: '/telas', label: 'Telas Pao Frances', icon: Grid2X2, module: 'telas' },
      { href: '/encomendas', label: 'Encomendas', icon: ShoppingBag, module: 'encomendas' },
    ],
  },
  {
    label: 'Qualidade',
    items: [
      { href: '/checklist', label: 'Checklist', icon: ClipboardCheck, badgeKey: 'checklistsPendentesHoje', module: 'checklist' },
      { href: '/ocorrencias', label: 'Ocorrencias', icon: AlertTriangle, badgeKey: 'ocorrenciasAbertas', module: 'ocorrencias' },
    ],
  },
  {
    label: 'Recursos Humanos',
    items: [
      { href: '/rh/colaboradores', label: 'Colaboradores',      icon: UserCircle, module: 'rh_colaboradores' },
      { href: '/rh/cargos',        label: 'Cargos e Salarios',  icon: Briefcase,  module: 'rh_cargos' },
      { href: '/rh/admissao',      label: 'Admissao Digital',   icon: UserPlus,     module: 'rh_admissao' },
      { href: '/rh/desligamento',  label: 'Desligamento',       icon: UserMinus,    module: 'rh_desligamento' },
      { href: '/rh/ferias',        label: 'Ferias',             icon: UmbrellaOff,  module: 'rh_ferias' },
      { href: '/rh/documentos',    label: 'Documentos',         icon: FileText,     module: 'rh_documentos' },
      { href: '/rh/holerites',     label: 'Holerites',          icon: ReceiptText,  module: 'rh_holerites' },
      { href: '/rh/beneficios',    label: 'Beneficios',         icon: Gift,         module: 'rh_beneficios' },
      { href: '/rh/aso',           label: 'Exames (ASO)',        icon: Stethoscope,  module: 'rh_aso' },
      { href: '/rh/ponto',         label: 'Controle de Ponto',  icon: Clock,        module: 'rh_ponto' },
      { href: '/rh/desempenho',    label: 'Desempenho',         icon: TrendingUp,   module: 'rh_desempenho' },
      { href: '/rh/comunicados',   label: 'Comunicados',        icon: Megaphone,    module: 'rh_comunicados' },
      { href: '/rh/organograma',   label: 'Organograma',        icon: GitBranch,    module: 'rh_organograma' },
      { href: '/rh/relatorios',    label: 'Relatórios RH',      icon: BarChart2,    module: 'rh_relatorios' },
    ],
  },
  {
    label: 'Meu Espaço',
    items: [
      { href: '/portal', label: 'Portal do Colaborador', icon: LayoutList },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/notificacoes', label: 'Notificacoes', icon: Bell, badgeKey: 'notificacoes', module: 'notificacoes' },
      { href: '/relatorios', label: 'Relatorios', icon: BarChart3, module: 'relatorios' },
    ],
  },
]

interface SidebarBadges {
  ocorrenciasAbertas?: number
  checklistsPendentesHoje?: number
  alertasEstoque?: number
  notificacoes?: number
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()

  // Fetch badge counts for sidebar items
  const { data: badges } = useQuery<SidebarBadges>({
    queryKey: ['sidebar', 'badges'],
    queryFn: async () => {
      try {
        const [summary, notif] = await Promise.all([
          api.get('/dashboard/summary').catch(() => null),
          api.get('/notifications', { page: 1, limit: 1, lida: false }).catch(() => null),
        ])
        return {
          ocorrenciasAbertas: summary?.ocorrenciasAbertas || 0,
          checklistsPendentesHoje: summary?.checklistsPendentesHoje || 0,
          alertasEstoque: summary?.alertasEstoque || 0,
          notificacoes: (notif as any)?.total || 0,
        }
      } catch {
        return {}
      }
    },
    refetchInterval: 60000,
    staleTime: 30000,
  })

  function getBadgeCount(badgeKey?: string): number {
    if (!badgeKey || !badges) return 0
    return (badges as Record<string, number>)[badgeKey] || 0
  }

  return (
    <>
      {/* Overlay - mobile only */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen w-[272px] bg-gradient-sidebar dark:bg-gradient-sidebar-dark flex flex-col overflow-hidden transition-transform duration-300 ease-smooth',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:z-40'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 backdrop-blur-sm border border-amber-400/10">
              <Wheat className="h-[18px] w-[18px] text-amber-400" />
            </div>
            <div>
              <p className="font-display font-semibold text-[16px] text-amber-50 tracking-tight leading-none">PAI</p>
              <p className="text-[9px] text-sidebar-foreground/40 font-bold tracking-[0.18em] uppercase mt-1">Pernambucana Adm. Integrada</p>
            </div>
          </div>

          {/* Close button - mobile only */}
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-sidebar-muted/60 transition-colors lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4 text-sidebar-foreground/50" />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-sidebar-border/60" />

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll overscroll-contain px-3 py-4 space-y-5">
          {menuSections.map((section, idx) => {
            // Filtrar itens por permissao
            const visibleItems = section.items.filter((item) => {
              if (!item.module) return true
              if (isFullAccess || isGerenteGeral()) return true
              return hasPermission(item.module)
            })
            if (visibleItems.length === 0) return null

            return (
            <div key={idx}>
              {section.label && (
                <p className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/25">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href)
                  const Icon = item.icon
                  const badgeCount = getBadgeCount(item.badgeKey)

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-150 touch-manipulation',
                          isActive
                            ? 'bg-amber-500/12 text-amber-400 shadow-sm shadow-amber-500/5'
                            : 'text-sidebar-foreground/55 hover:bg-sidebar-muted/50 hover:text-sidebar-foreground/85 active:bg-sidebar-muted/70'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-[17px] w-[17px] shrink-0 transition-colors duration-150',
                            isActive ? 'text-amber-400' : 'text-sidebar-foreground/35 group-hover:text-sidebar-foreground/55'
                          )}
                        />
                        <span className="flex-1">{item.label}</span>

                        {/* Badge count */}
                        {badgeCount > 0 && (
                          <span className={cn(
                            'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                            badgeCount > 5
                              ? 'bg-red-500/90 text-white'
                              : 'bg-amber-500/20 text-amber-400'
                          )}>
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}

                        {isActive && !badgeCount && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shadow-glow" />
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="shrink-0 mx-5 mb-4">
          <div className="h-px bg-sidebar-border/40 mb-3" />
          <p className="text-[10px] text-sidebar-foreground/20 text-center tracking-wider">
            v1.0.0
          </p>
        </div>
      </aside>
    </>
  )
}
