'use client'

import { cn } from '@/lib/utils'

interface ChartSkeletonProps {
  height?: number
  className?: string
}

export function ChartSkeleton({ height = 240, className }: ChartSkeletonProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)} style={{ height }}>
      {/* Grid lines */}
      <div className="absolute inset-0 flex flex-col justify-between py-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-px w-full bg-border/20" />
        ))}
      </div>

      {/* Bars skeleton */}
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around px-8 pb-6 gap-3">
        {[65, 45, 80, 55, 70, 40, 75].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-lg animate-shimmer"
            style={{
              height: `${h}%`,
              animationDelay: `${i * 100}ms`,
            }}
          />
        ))}
      </div>

      {/* X-axis labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-around px-8 pb-1">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-2 w-6 rounded animate-shimmer" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </div>
  )
}
