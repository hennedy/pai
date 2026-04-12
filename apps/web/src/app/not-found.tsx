import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background font-sans">
      <h2 className="text-xl font-semibold mb-1">Pagina nao encontrada</h2>
      <p className="text-sm text-muted-foreground mb-4">A pagina que voce procura nao existe.</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-xl border border-border text-sm hover:bg-muted transition-colors"
      >
        Voltar ao inicio
      </Link>
    </div>
  )
}
