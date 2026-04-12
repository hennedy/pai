'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  header: string
  cell?: (row: T) => React.ReactNode
  className?: string
  sortable?: boolean
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  onPageChange: (page: number) => void
  loading?: boolean
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  actions?: React.ReactNode
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  total,
  page,
  limit,
  totalPages,
  onPageChange,
  loading,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  actions,
}: DataTableProps<T>) {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {(onSearchChange || actions) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {onSearchChange && (
            <div className="relative flex-1 sm:max-w-sm group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary/70 transition-colors" />
              <input
                type="text"
                placeholder={searchPlaceholder || 'Buscar...'}
                value={searchValue || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 sm:py-2 rounded-xl border border-border/70 bg-card text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 outline-none transition-all duration-200 shadow-warm-sm hover:border-border placeholder:text-muted-foreground/40"
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-2 self-end sm:self-auto">{actions}</div>}
        </div>
      )}

      {/* Table Card */}
      <div className="rounded-2xl border border-border/50 overflow-hidden shadow-warm bg-card table-scroll-container">
        <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 sm:px-5 py-3.5 text-left text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-[0.08em] whitespace-nowrap first:pl-5 last:pr-5',
                      col.hideOnMobile && 'hidden md:table-cell',
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0">
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 sm:px-5 py-4 first:pl-5 last:pr-5',
                          col.hideOnMobile && 'hidden md:table-cell'
                        )}
                      >
                        <div className="h-4 w-3/4 rounded-lg animate-shimmer" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center">
                        <Inbox className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground/70">Nenhum registro encontrado</p>
                        <p className="text-xs text-muted-foreground/40 mt-0.5">Tente ajustar os filtros de busca</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row, i) => (
                  <tr
                    key={(row as any).id || i}
                    className="border-b border-border/30 last:border-0 hover:bg-accent/30 transition-colors duration-100 group"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 sm:px-5 py-3.5 first:pl-5 last:pr-5',
                          col.hideOnMobile && 'hidden md:table-cell',
                          col.className
                        )}
                      >
                        {col.cell ? col.cell(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
        <p className="text-xs text-muted-foreground/60 order-2 sm:order-1 tabular-nums">
          {total > 0
            ? `Mostrando ${(page - 1) * limit + 1}-${Math.min(page * limit, total)} de ${total} registro${total !== 1 ? 's' : ''}`
            : 'Nenhum resultado'}
        </p>
        <div className="flex items-center gap-1 order-1 sm:order-2">
          <PaginationButton onClick={() => onPageChange(1)} disabled={page <= 1} aria-label="Primeira pagina">
            <ChevronsLeft className="h-3.5 w-3.5" />
          </PaginationButton>
          <PaginationButton onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Pagina anterior">
            <ChevronLeft className="h-3.5 w-3.5" />
          </PaginationButton>
          <span className="px-3 py-1.5 text-sm font-medium tabular-nums min-w-[60px] text-center rounded-lg bg-muted/40">
            {page} <span className="text-muted-foreground/40">/</span> {totalPages || 1}
          </span>
          <PaginationButton onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} aria-label="Proxima pagina">
            <ChevronRight className="h-3.5 w-3.5" />
          </PaginationButton>
          <PaginationButton onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} aria-label="Ultima pagina">
            <ChevronsRight className="h-3.5 w-3.5" />
          </PaginationButton>
        </div>
      </div>
    </div>
  )
}

function PaginationButton({ children, onClick, disabled, ...props }: { children: React.ReactNode; onClick: () => void; disabled: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-9 w-9 sm:h-8 sm:w-8 flex items-center justify-center rounded-lg border border-border/50 bg-card hover:bg-accent hover:border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-card disabled:hover:text-muted-foreground transition-all duration-150 shadow-warm-sm touch-manipulation"
      {...props}
    >
      {children}
    </button>
  )
}
