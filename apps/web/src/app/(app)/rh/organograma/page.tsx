'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, ChevronDown, ChevronRight, Users, Building2, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColabNode {
  id: string
  nome: string
  nomeSocial?: string | null
  matricula: string
  fotoUrl?: string | null
  departamento?: string | null
  gestorDiretoId?: string | null
  status: string
  cargo?: { nome: string; nivel: string } | null
  unit?: { nome: string } | null
  subordinados: ColabNode[]
}

const NIVEL_COLORS: Record<string, string> = {
  diretor:      'border-violet-500/50 bg-violet-500/5',
  gerente:      'border-indigo-500/50 bg-indigo-500/5',
  coordenador:  'border-blue-500/50 bg-blue-500/5',
  especialista: 'border-cyan-500/50 bg-cyan-500/5',
  senior:       'border-teal-500/50 bg-teal-500/5',
  pleno:        'border-green-500/50 bg-green-500/5',
  junior:       'border-zinc-500/30 bg-transparent',
}

// ─── OrgNode Component ────────────────────────────────────────────────────────

function OrgNode({ node, depth = 0, search }: { node: ColabNode; depth?: number; search: string }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.subordinados.length > 0

  const displayName = node.nomeSocial || node.nome
  const matchSearch = search
    ? displayName.toLowerCase().includes(search.toLowerCase()) ||
      node.matricula.toLowerCase().includes(search.toLowerCase()) ||
      (node.cargo?.nome ?? '').toLowerCase().includes(search.toLowerCase())
    : true

  // Se há busca, expande automaticamente se algum descendente bate
  const hasMatchInTree = (n: ColabNode): boolean => {
    if (!search) return false
    const nameMatch = (n.nomeSocial || n.nome).toLowerCase().includes(search.toLowerCase()) ||
      n.matricula.toLowerCase().includes(search.toLowerCase())
    return nameMatch || n.subordinados.some(hasMatchInTree)
  }
  const shouldExpand = search ? hasMatchInTree(node) : expanded

  const borderColor = node.cargo?.nivel ? NIVEL_COLORS[node.cargo.nivel] ?? 'border-border' : 'border-border'

  if (search && !matchSearch && !hasMatchInTree(node)) return null

  return (
    <div className={cn('relative', depth > 0 && 'ml-6 border-l border-border/40 pl-4')}>
      {/* Connector line */}
      {depth > 0 && (
        <div className="absolute left-0 top-5 w-4 border-t border-border/40" />
      )}

      <div className={cn(
        'rounded-xl border p-3 mb-2 transition-all',
        borderColor,
        search && matchSearch && 'ring-2 ring-primary/40'
      )}>
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="h-9 w-9 shrink-0 rounded-full bg-muted/40 flex items-center justify-center overflow-hidden">
            {node.fotoUrl
              ? <img src={node.fotoUrl} alt={displayName} className="h-full w-full object-cover" />
              : <span className="text-sm font-semibold text-muted-foreground">
                  {displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{displayName}</span>
              <span className="text-xs text-muted-foreground shrink-0">{node.matricula}</span>
            </div>
            {node.cargo && (
              <p className="text-xs text-muted-foreground truncate">{node.cargo.nome}</p>
            )}
            {node.unit && (
              <p className="text-xs text-muted-foreground/60 truncate">{node.unit.nome}</p>
            )}
          </div>

          {/* Expand toggle */}
          {hasChildren && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="text-xs">{node.subordinados.length}</span>
              {(search ? shouldExpand : expanded)
                ? <ChevronDown className="h-3.5 w-3.5" />
                : <ChevronRight className="h-3.5 w-3.5" />
              }
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && (search ? shouldExpand : expanded) && (
        <div>
          {node.subordinados.map((child) => (
            <OrgNode key={child.id} node={child} depth={depth + 1} search={search} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrganogramaPage() {
  const { hasPermission, isFullAccess, isGerenteGeral } = useAuthStore()
  const canVis = isFullAccess || isGerenteGeral() || hasPermission('rh_organograma', 'visualizar')

  const [filterUnit, setFilterUnit] = useState('')
  const [search, setSearch] = useState('')

  const { data: units } = useQuery({
    queryKey: ['units'],
    queryFn: () => api.get('/units') as Promise<{ items: any[] }>,
    enabled: canVis,
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rh', 'organograma', filterUnit],
    queryFn: () => api.get('/rh/organograma', filterUnit ? { unitId: filterUnit } : {}) as Promise<{ tree: ColabNode[]; total: number }>,
    enabled: canVis,
  })

  const { data: stats } = useQuery({
    queryKey: ['rh', 'organograma', 'stats'],
    queryFn: () => api.get('/rh/organograma/stats/resumo') as Promise<any>,
    enabled: canVis,
  })

  if (!canVis) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Sem permissão para visualizar o organograma.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organograma</h1>
          <p className="text-muted-foreground text-sm mt-1">Estrutura hierárquica de colaboradores</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total de colaboradores</p>
            <p className="text-2xl font-bold">{data?.total ?? 0}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
            <GitBranch className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sem gestor direto</p>
            <p className="text-2xl font-bold">{stats?.semGestor ?? 0}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Colaboradores finais</p>
            <p className="text-2xl font-bold">{stats?.semSubordinados ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Buscar por nome, matrícula ou cargo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={filterUnit} onValueChange={setFilterUnit}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            {units?.items?.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Legenda de níveis */}
      <div className="flex gap-2 flex-wrap text-xs">
        {Object.entries(NIVEL_COLORS).map(([nivel, color]) => (
          <span key={nivel} className={cn('px-2 py-1 rounded-lg border capitalize', color)}>{nivel}</span>
        ))}
      </div>

      {/* Árvore */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.tree?.length ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border rounded-xl border-dashed">
          <Users className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum colaborador encontrado</p>
        </div>
      ) : (
        <div className="space-y-2 pb-8">
          {data.tree.map((node) => (
            <OrgNode key={node.id} node={node} depth={0} search={search} />
          ))}
        </div>
      )}
    </div>
  )
}
