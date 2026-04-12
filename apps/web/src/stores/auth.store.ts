import { create } from 'zustand'
import { api } from '@/lib/api'

interface UserRole {
  unitId: string
  unitCode: string
  role: string
}

interface Permission {
  modulo: string
  acao: string
}

interface AuthUser {
  userId: string
  email: string
  nome: string
  primeiroNome: string | null
  roles: UserRole[]
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  selectedUnitId: string | null
  permissions: Permission[]
  isFullAccess: boolean

  login: (identifier: string, senha: string) => Promise<void>
  logout: () => Promise<void>
  loadUser: () => Promise<void>
  setSelectedUnit: (unitId: string | null) => void
  isGerenteGeral: () => boolean
  getAllowedUnitIds: () => string[]
  loadPermissions: () => Promise<void>
  hasPermission: (modulo: string, acao?: string) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  selectedUnitId: null,
  permissions: [],
  isFullAccess: false,

  login: async (identifier: string, senha: string) => {
    const data = await api.post('/auth/login', { identifier, senha })
    api.setToken(data.accessToken)
    localStorage.setItem('accessToken', data.accessToken)

    set({
      user: {
        userId: data.user.id,
        email: data.user.email,
        nome: data.user.nome,
        primeiroNome: data.user.primeiroNome ?? null,
        roles: data.user.roles,
      },
      isLoading: false,
      selectedUnitId: null,
    })

    // Carregar permissoes apos login (nao bloqueia o login se falhar)
    get().loadPermissions().catch(() => {})
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignorar erro no logout
    }
    api.setToken(null)
    localStorage.removeItem('accessToken')
    set({ user: null, selectedUnitId: null, permissions: [], isFullAccess: false })
  },

  loadUser: async () => {
    // Se ja tem user carregado, nao recarregar
    if (get().user) {
      set({ isLoading: false })
      return
    }

    const token = localStorage.getItem('accessToken')
    if (!token) {
      set({ isLoading: false })
      return
    }

    api.setToken(token)

    try {
      // Tentar usar o token para buscar dados do usuario
      const data = await api.get('/users/me')
      set({
        user: {
          userId: data.id,
          email: data.email,
          nome: data.nome,
          primeiroNome: data.primeiroNome ?? null,
          roles: data.roles,
        },
        isLoading: false,
        selectedUnitId: null,
      })
      await get().loadPermissions()
    } catch {
      // Token invalido, tentar refresh
      const refreshed = await api.refreshToken()
      if (!refreshed) {
        localStorage.removeItem('accessToken')
        set({ isLoading: false })
      } else {
        // Tentar novamente com novo token
        try {
          const data = await api.get('/users/me')
          set({
            user: {
              userId: data.id,
              email: data.email,
              nome: data.nome,
              primeiroNome: data.primeiroNome ?? null,
              roles: data.roles,
            },
            isLoading: false,
            selectedUnitId: null,
          })
          await get().loadPermissions()
        } catch {
          set({ isLoading: false })
        }
      }
    }
  },

  setSelectedUnit: (unitId) => set({ selectedUnitId: unitId }),

  isGerenteGeral: () => {
    const user = get().user
    return user?.roles.some((r) => r.role === 'gerente_geral') || false
  },

  getAllowedUnitIds: () => {
    const user = get().user
    return user?.roles.map((r) => r.unitId) || []
  },

  loadPermissions: async () => {
    try {
      const data = await api.get('/permissions/my-permissions', undefined, { skipAuthRedirect: true })
      set({ permissions: data.permissions || [], isFullAccess: data.isFullAccess || false })
    } catch {
      set({ permissions: [], isFullAccess: false })
    }
  },

  hasPermission: (modulo: string, acao?: string) => {
    const { isFullAccess, permissions } = get()
    if (isFullAccess) return true
    if (!acao) {
      return permissions.some((p) => p.modulo === modulo)
    }
    return permissions.some((p) => p.modulo === modulo && p.acao === acao)
  },
}))
