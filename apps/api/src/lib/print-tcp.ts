/**
 * Envia um buffer ESC/POS para uma impressora termica via TCP/IP (porta 9100).
 */

import net from 'net'

const DEFAULT_TIMEOUT_MS = 10000

export async function sendToPrinter(
  ip: string,
  port: number,
  data: Buffer,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    let settled = false

    function settle(err?: Error) {
      if (settled) return
      settled = true
      socket.destroy()
      if (err) reject(err)
      else resolve()
    }

    socket.setTimeout(timeoutMs)

    // Resolve apenas quando a conexão fechar completamente
    // (garante que todos os dados chegaram à impressora)
    socket.on('close', () => settle())
    socket.on('error', (err) => settle(err))
    socket.on('timeout', () =>
      settle(new Error(`Timeout ao conectar na impressora ${ip}:${port} — verifique o IP e a rede`)),
    )

    socket.connect(port, ip, () => {
      socket.write(data, (writeErr) => {
        if (writeErr) return settle(writeErr)
        // Sinaliza fim de transmissão; aguarda 'close' para resolver
        socket.end()
      })
    })
  })
}
