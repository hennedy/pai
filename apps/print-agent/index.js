/**
 * PAI Print Agent — servidor HTTP local que faz a ponte entre o browser e a impressora térmica.
 *
 * Como usar:
 *   node index.js
 *
 * Variáveis de ambiente (opcionais):
 *   PORT=3456          Porta HTTP (padrão: 3456)
 *   ALLOWED_ORIGIN=*   Origin permitida para CORS (padrão: *, recomenda-se setar a URL do PAI)
 *
 * Endpoints:
 *   GET  /health  → { ok: true }
 *   POST /print   → { ip, port, buffer (base64) } → imprime via TCP
 */

const http = require('http')
const net  = require('net')

const PORT           = Number(process.env.PORT || 3456)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'

// ── TCP print ──────────────────────────────────────────────────

function sendToPrinter(ip, port, data, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    let settled = false

    function settle(err) {
      if (settled) return
      settled = true
      socket.destroy()
      if (err) reject(err)
      else resolve()
    }

    socket.setTimeout(timeoutMs)
    socket.on('close',   ()    => settle())
    socket.on('error',   (err) => settle(err))
    socket.on('timeout', ()    => settle(new Error(`Sem resposta em ${timeoutMs / 1000}s — IP: ${ip}:${port}`)))

    socket.connect(port, ip, () => {
      socket.write(data, (writeErr) => {
        if (writeErr) return settle(writeErr)
        socket.end()
      })
    })
  })
}

// ── HTTP server ────────────────────────────────────────────────

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // GET /health
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true, version: '1.0.0' })
  }

  // POST /print
  if (req.method === 'POST' && req.url === '/print') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', async () => {
      let payload
      try {
        payload = JSON.parse(body)
      } catch {
        return json(res, 400, { ok: false, error: 'JSON inválido' })
      }

      const { ip, port, buffer: bufferB64 } = payload

      if (!ip || !port || !bufferB64) {
        return json(res, 400, { ok: false, error: 'Campos obrigatórios: ip, port, buffer' })
      }

      const data = Buffer.from(bufferB64, 'base64')

      try {
        await sendToPrinter(ip, Number(port), data)
        console.log(`[OK] Impresso em ${ip}:${port} — ${data.length} bytes`)
        return json(res, 200, { ok: true })
      } catch (err) {
        console.error(`[ERRO] ${ip}:${port} — ${err.message}`)
        return json(res, 502, { ok: false, error: err.message })
      }
    })
    return
  }

  json(res, 404, { ok: false, error: 'Not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`PAI Print Agent rodando em http://127.0.0.1:${PORT}`)
  console.log(`CORS permitido para: ${ALLOWED_ORIGIN}`)
  console.log('Aguardando jobs de impressão...')
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Porta ${PORT} já está em uso. Use PORT=XXXX node index.js para mudar.`)
  } else {
    console.error('Erro no servidor:', err)
  }
  process.exit(1)
})
