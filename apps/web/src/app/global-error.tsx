'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Algo deu errado</h2>
          <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1rem' }}>{error.message}</p>
          <button
            onClick={() => reset()}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #ddd', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
