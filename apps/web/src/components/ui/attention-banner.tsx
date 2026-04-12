'use client'

import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Info, XCircle, ChevronRight } from 'lucide-react'

type BannerVariant = 'critical' | 'warning' | 'success' | 'info'

interface AttentionBannerProps {
  variant: BannerVariant
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

const variantConfig = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40',
    gradientOverlay: 'from-red-500/5 to-transparent',
    icon: XCircle,
    iconColor: 'text-red-500',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    titleColor: 'text-red-800 dark:text-red-300',
    descColor: 'text-red-600/70 dark:text-red-400/60',
    accentLine: 'bg-red-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40',
    gradientOverlay: 'from-amber-500/5 to-transparent',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    titleColor: 'text-amber-800 dark:text-amber-300',
    descColor: 'text-amber-600/70 dark:text-amber-400/60',
    accentLine: 'bg-amber-500',
  },
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40',
    gradientOverlay: 'from-emerald-500/5 to-transparent',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    titleColor: 'text-emerald-800 dark:text-emerald-300',
    descColor: 'text-emerald-600/70 dark:text-emerald-400/60',
    accentLine: 'bg-emerald-500',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40',
    gradientOverlay: 'from-blue-500/5 to-transparent',
    icon: Info,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    titleColor: 'text-blue-800 dark:text-blue-300',
    descColor: 'text-blue-600/70 dark:text-blue-400/60',
    accentLine: 'bg-blue-500',
  },
}

export function AttentionBanner({ variant, title, description, action, className }: AttentionBannerProps) {
  const config = variantConfig[variant]
  const IconComp = config.icon

  return (
    <div className={cn(
      'relative flex items-center gap-3 rounded-xl border px-4 py-3 overflow-hidden animate-slide-in-down',
      config.bg,
      className
    )}>
      {/* Left accent line */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl', config.accentLine)} />

      {/* Subtle gradient overlay */}
      <div className={cn('absolute inset-0 bg-gradient-to-r pointer-events-none', config.gradientOverlay)} />

      {/* Icon with background */}
      <div className={cn('relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', config.iconBg)}>
        <IconComp className={cn(
          'h-[18px] w-[18px] shrink-0',
          config.iconColor,
          variant === 'critical' && 'animate-breathe'
        )} />
      </div>

      <div className="relative flex-1 min-w-0">
        <p className={cn('text-[14px] font-bold tracking-tight', config.titleColor)}>{title}</p>
        {description && <p className={cn('text-[13px] mt-0.5 font-medium', config.descColor)}>{description}</p>}
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            'relative flex items-center gap-0.5 text-xs font-semibold shrink-0 hover:opacity-80 transition-all duration-200 group/action',
            config.titleColor
          )}
        >
          {action.label}
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/action:translate-x-0.5" />
        </button>
      )}
    </div>
  )
}
