const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function getApiUrl() {
  return API_BASE_URL
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
  skipAuthRedirect?: boolean
}

class ApiClient {
  private accessToken: string | null = null

  private get baseUrl(): string {
    return getApiUrl()
  }

  setToken(token: string | null) {
    this.accessToken = token
  }

  getToken() {
    return this.accessToken
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value))
        }
      })
    }
    return url.toString()
  }

  async fetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
    const { params, skipAuthRedirect, ...fetchOptions } = options
    const url = this.buildUrl(path, params)

    const hasBody = fetchOptions.body != null
    const headers: Record<string, string> = {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string>),
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    })

    if (response.status === 401) {
      // Pular interceptor para rotas de auth ou quando explicitamente indicado
      const shouldIntercept = !path.startsWith('/auth/') && !skipAuthRedirect

      if (shouldIntercept) {
        // Tentar renovar token
        const refreshed = await this.refreshToken()
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.accessToken}`
          const retryResponse = await fetch(url, {
            ...fetchOptions,
            headers,
            credentials: 'include',
          })
          if (!retryResponse.ok) {
            const error = await retryResponse.json().catch(() => ({ error: 'Erro desconhecido' }))
            throw new ApiError(error.error || 'Erro na requisicao', retryResponse.status, error.code)
          }
          return retryResponse.json()
        }
        // Redirecionar para login
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        throw new ApiError('Sessao expirada', 401, 'UNAUTHORIZED')
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
      throw new ApiError(error.error || 'Erro na requisicao', response.status, error.code)
    }

    // Verificar se a resposta tem conteudo
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('text/csv')) {
      return response.text() as any
    }

    return response.json()
  }

  async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        this.accessToken = data.accessToken
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', data.accessToken)
        }
        return true
      }
      return false
    } catch {
      return false
    }
  }

  // Metodos de conveniencia
  get<T = any>(path: string, params?: Record<string, string | number | boolean | undefined>, options?: { skipAuthRedirect?: boolean }) {
    return this.fetch<T>(path, { method: 'GET', params, skipAuthRedirect: options?.skipAuthRedirect })
  }

  post<T = any>(path: string, body?: any) {
    return this.fetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
  }

  put<T = any>(path: string, body?: any) {
    return this.fetch<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined })
  }

  patch<T = any>(path: string, body?: any) {
    return this.fetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined })
  }

  delete<T = any>(path: string) {
    return this.fetch<T>(path, { method: 'DELETE' })
  }
}

export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string = 'UNKNOWN') {
    super(message)
    this.status = status
    this.code = code
  }
}

export const api = new ApiClient()
