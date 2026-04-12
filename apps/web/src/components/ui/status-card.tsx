'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Severity = 'critical' | 'warning' | 'healthy' | 'neutral'

interface StatusCardProps {
  title: string
  value: number | string
  subtitle?: string
  icon: LucideIcon
  severity: Severity
  trend?: { value: number; label: string }
  action?: { label: string; onClick: () => void }
  loading?: boolean
  className?: string
}

const severityConfig = {
  critical: {
    border: 'border-red-200 dark:border-red-900/40',
    bg: 'bg-red-50/50 dark:bg-red-950/20',
    hoverBg: 'hover:bg-red-50/80 dark:hover:bg-red-950/30',
    iconBg: 'bg-gradient-to-br from-red-500 to-red-600',
    iconColor: 'text-white',
    indicator: 'bg-red-500',
    valueColor: 'text-red-700 dark:text-red-400',
    glowColor: 'group-hover:shadow-[0_0_20px_rgb(239_68_68/0.12)]',
    pulse: true,
  },
  warning: {
    border: 'border-amber-200 dark:border-amber-900/40',
    bg: 'bg-amber-50/50 dark:bg-amber-950/20',
    hoverBg: 'hover:bg-amber-50/80 dark:hover:bg-amber-950/30',
    iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
    iconColor: 'text-white',
    indicator: 'bg-amber-500',
    valueColor: 'text-amber-700 dark:text-amber-400',
    glowColor: 'group-hover:shadow-[0_0_20px_rgb(245_158_11/0.12)]',
    pulse: false,
  },
  healthy: {
    border: 'border-emerald-200 dark:border-emerald-900/40',
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    hoverBg: 'hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    iconColor: 'text-white',
    indicator: 'bg-emerald-500',
    valueColor: 'text-emerald-700 dark:text-emerald-400',
    glowColor: 'group-hover:shadow-[0_0_20px_rgb(16_185_129/0.12)]',
    pulse: false,
  },
  neutral: {
    border: 'border-border/50',
    bg: 'bg-card',
    hoverBg: 'hover:bg-card/80',
    iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
    iconColor: 'text-white',
    indicator: 'bg-muted-foreground/30',
    valueColor: 'text-foreground',
    glowColor: 'group-hover:shadow-warm-md',
    pulse: false,
  },
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (value === 0) { setDisplay(0); return }
    const duration = 600
    const start = performance.now()
    const from = 0

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  return <span ref={ref} className={className}>{display}</span>
}

export function StatusCard({
  title,
  value,
  subtitle,
  icon: Icon,
  severity,
  trend,
  action,
  loading,
  className,
}: StatusCardProps) {
  const config = severityConfig[severity]

  return (
    <div
      className={cn(
        'relative rounded-2xl border p-4 sm:p-5 transition-all duration-300 group overflow-hidden cursor-default',
        'hover:-translate-y-1 hover:shadow-warm-lg',
        config.border,
        config.bg,
        config.hoverBg,
        config.glowColor,
        className
      )}
    >
      {/* Severity indicator line with gradient */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl transition-all duration-300',
        config.indicator,
        'group-hover:h-[4px]'
      )} />

      {/* Pulse dot for critical */}
      {config.pulse && typeof value === 'number' && value > 0 && (
        <div className="absolute top-3 right-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        </div>
      )}

      <div className="flex items-start gap-3.5">
        <div className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-warm-sm transition-all duration-300',
          'group-hover:scale-110 group-hover:shadow-warm-md group-hover:rotate-[-3deg]',
          config.iconBg
        )}>
          <Icon className={cn('h-5 w-5 transition-transform duration-300', config.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-[0.1em]">{title}</p>
          {loading ? (
            <div className="h-8 w-16 rounded-lg animate-shimmer mt-1" />
          ) : (
            <div className="animate-count-up">
              <p className={cn('font-display text-2xl sm:text-3xl font-semibold tracking-tightest mt-0.5', config.valueColor)}>
                {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
              </p>
            </div>
          )}
          {subtitle && (
            <p className="text-[11px] text-muted-foreground/45 mt-0.5 font-medium">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-1">
              <span className={cn(
                'text-[11px] font-semibold inline-flex items-center gap-0.5',
                trend.value > 0 ? 'text-red-500' : trend.value < 0 ? 'text-emerald-500' : 'text-muted-foreground/50'
              )}>
                <svg className={cn('h-3 w-3', trend.value < 0 && 'rotate-180')} viewBox="0 0 12 12" fill="none">
                  <path d="M6 2.5v7M6 2.5l2.5 2.5M6 2.5L3.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-[11px] text-muted-foreground/40">{trend.label}</span>
            </div>
          )}
        </div>
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 text-xs font-semibold text-primary hover:text-primary/80 transition-all duration-200 group/btn flex items-center gap-1"
        >
          {action.label}
          <span className="inline-block transition-transform duration-200 group-hover/btn:translate-x-0.5">→</span>
        </button>
      )}
    </div>
  )
}
