'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  icon: LucideIcon
  iconGradient?: string
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}

export function PageHeader({
  icon: Icon,
  iconGradient = 'from-amber-500 to-amber-600',
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-3">
        <div className={cn('h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-warm-sm', iconGradient)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-semibold tracking-tightest">{title}</h1>
          {description && (
            <p className="text-[13px] text-muted-foreground/50 font-medium mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
