'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
          <div className="h-14 w-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <h2 className="text-lg font-display font-bold text-foreground">Algo deu errado</h2>
          <p className="text-sm text-muted-foreground/60 mt-1 max-w-sm">
            Ocorreu um erro inesperado. Tente recarregar a pagina.
          </p>
          {this.state.error && (
            <pre className="mt-3 p-3 rounded-xl bg-muted/30 border border-border/30 text-[11px] font-mono text-muted-foreground/50 max-w-md overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <Button
            variant="outline"
            className="mt-4 gap-2"
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
          >
            <RefreshCw className="h-4 w-4" /> Recarregar
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
