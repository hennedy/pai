import Redis from 'ioredis'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL
    if (!url) {
      throw new Error('REDIS_URL nao configurada')
    }
    redis = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    })
    redis.on('error', () => {
      // Silenciar erros de conexao quando Redis nao disponivel
    })
  }
  return redis
}

export function isRedisAvailable(): boolean {
  return !!process.env.REDIS_URL
}
