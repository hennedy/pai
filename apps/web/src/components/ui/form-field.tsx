'use client'

import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}

export function FormField({ label, required, error, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-[11px] text-destructive font-medium animate-fade-in">{error}</p>
      )}
      {hint && !error && (
        <p className="text-[11px] text-muted-foreground/40">{hint}</p>
      )}
    </div>
  )
}
