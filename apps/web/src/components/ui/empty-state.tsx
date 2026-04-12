'use client'

import { cn } from '@/lib/utils'
import { Button } from './button'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  severity?: 'info' | 'success' | 'warning'
  className?: string
}

const severityStyles = {
  info: {
    iconBg: 'bg-blue-50 dark:bg-blue-900/20',
    iconColor: 'text-blue-500 dark:text-blue-400',
  },
  success: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
  },
  warning: {
    iconBg: 'bg-amber-50 dark:bg-amber-900/20',
    iconColor: 'text-amber-500 dark:text-amber-400',
  },
}

export function EmptyState({ icon: Icon, title, description, action, severity = 'info', className }: EmptyStateProps) {
  const styles = severityStyles[severity]

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 sm:py-16 px-4', className)}>
      <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center mb-4', styles.iconBg)}>
        <Icon className={cn('h-6 w-6', styles.iconColor)} />
      </div>
      <p className="text-sm font-semibold text-foreground/80 text-center">{title}</p>
      <p className="text-xs text-muted-foreground/50 text-center mt-1 max-w-[280px]">{description}</p>
      {action && (
        <Button onClick={action.onClick} size="sm" className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  )
}
