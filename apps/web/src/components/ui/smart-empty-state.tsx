'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from 'lucide-react'

interface SmartEmptyStateProps {
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export function SmartEmptyState({
  icon: Icon,
  iconColor = 'text-amber-500/40',
  iconBg = 'bg-amber-50 dark:bg-amber-900/20',
  title,
  description,
  action,
  className,
}: SmartEmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center animate-fade-in', className)}>
      <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center mb-4', iconBg)}>
        <Icon className={cn('h-6 w-6', iconColor)} />
      </div>
      <p className="text-sm font-semibold text-muted-foreground/60">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground/40 mt-1 max-w-[240px]">{description}</p>
      )}
      {action && (
        <Button size="sm" variant="outline" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
