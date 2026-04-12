'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface OperationalScoreProps {
  score: number // 0-100
  label?: string
  subtitle?: string
  loading?: boolean
  className?: string
}

function getScoreConfig(score: number) {
  if (score >= 80) return {
    color: 'text-emerald-500',
    stroke: '#10b981',
    bgStroke: 'rgb(16 185 129 / 0.1)',
    label: 'Excelente',
    glow: '0 0 20px rgb(16 185 129 / 0.2)',
  }
  if (score >= 60) return {
    color: 'text-amber-500',
    stroke: '#f59e0b',
    bgStroke: 'rgb(245 158 11 / 0.1)',
    label: 'Atencao',
    glow: '0 0 20px rgb(245 158 11 / 0.2)',
  }
  return {
    color: 'text-red-500',
    stroke: '#ef4444',
    bgStroke: 'rgb(239 68 68 / 0.1)',
    label: 'Critico',
    glow: '0 0 20px rgb(239 68 68 / 0.2)',
  }
}

export function OperationalScore({ score, label, subtitle, loading, className }: OperationalScoreProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const config = getScoreConfig(score)

  const size = 140
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (animatedScore / 100) * circumference

  useEffect(() => {
    if (loading) return
    const duration = 1200
    const start = performance.now()

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedScore(Math.round(score * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [score, loading])

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={config.bgStroke}
            strokeWidth={strokeWidth}
          />
          {/* Score arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={config.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: `drop-shadow(${config.glow})`,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {loading ? (
            <div className="h-8 w-12 rounded-lg animate-shimmer" />
          ) : (
            <>
              <span className={cn('font-display text-4xl font-semibold tabular-nums tracking-tightest', config.color)}>
                {animatedScore}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.12em]">
                {config.label}
              </span>
            </>
          )}
        </div>
      </div>

      {label && (
        <div className="text-center">
          <p className="text-[14px] font-bold text-foreground tracking-tight">{label}</p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground/45 mt-0.5 font-medium">{subtitle}</p>
          )}
        </div>
      )}
    </div>
  )
}
