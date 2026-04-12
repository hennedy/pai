/**
 * Gerador ESC/POS para impressora termica 80mm (Elgin i8 / similar).
 * Linha: 48 caracteres no fonte padrao.
 *
 * Caracteres acentuados sao normalizados para ASCII via NFD
 * (evita problemas de codepage sem dependencias extras).
 */

const ESC = 0x1b
const GS  = 0x1d
const LF  = 0x0a
const W   = 48 // largura da linha em caracteres

// ── Helpers ───────────────────────────────────────────────────

function toAscii(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7f]/g, '?')
}

function buf(...bytes: number[]): Buffer {
  return Buffer.from(bytes)
}

function textBuf(s: string): Buffer {
  return Buffer.from(toAscii(s))
}

function lineBuf(s: string): Buffer {
  return Buffer.concat([textBuf(s), buf(LF)])
}

function dashes(): Buffer {
  return lineBuf('-'.repeat(W))
}

function twoColLine(left: string, right: string): Buffer {
  const r = toAscii(right).slice(0, W - 1)
  const l = toAscii(left).slice(0, W - r.length - 1).padEnd(W - r.length - 1)
  return lineBuf(l + ' ' + r)
}

function wrapLines(text: string): Buffer[] {
  const parts: Buffer[] = []
  let remaining = toAscii(text)
  while (remaining.length > W) {
    let cut = W
    const lastSpace = remaining.lastIndexOf(' ', W)
    if (lastSpace > W / 2) cut = lastSpace
    parts.push(lineBuf(remaining.slice(0, cut).trimEnd()))
    remaining = remaining.slice(cut).trimStart()
  }
  if (remaining) parts.push(lineBuf(remaining))
  return parts
}

function fmtDate(d: Date | string): string {
  const date = new Date(d)
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`
}

function fmtCurrency(v: number): string {
  return 'R$ ' + v.toFixed(2).replace('.', ',')
}

function nowStr(): string {
  const d = new Date()
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('/') + ' ' + [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
  ].join(':')
}

// ── Tipos ─────────────────────────────────────────────────────

export interface PrintData {
  numeroOrdem: number
  clienteNome: string
  clienteTelefone?: string | null
  dataRetirada: Date | string
  horaRetirada: string
  observacoes?: string | null
  valorCaucao: number | string
  valorTotal: number | string
  itens: {
    descricao: string
    quantidade: number | string
    unidade: string
    observacao?: string | null
  }[]
  criadoPor?: { nome: string } | null
  criadoPorNome?: string | null
  criadoEm?: Date | string | null
  unit: {
    nome: string
    razaoSocial?: string | null
    cnpj?: string | null
    endereco?: string | null
    telefone?: string | null
  }
}

// ── Builder de uma via (sem init — o init é feito uma só vez) ──

function buildVia(data: PrintData, viaLabel: string, isLast: boolean): Buffer {
  const parts: Buffer[] = []
  const p = (...b: number[]) => parts.push(buf(...b))
  const l = (s: string)       => parts.push(lineBuf(s))
  const t = (b: Buffer)       => parts.push(b)

  const atendente   = data.criadoPor?.nome ?? data.criadoPorNome ?? '-'
  const caucao      = Number(data.valorCaucao)
  const total       = Number(data.valorTotal)
  const isProducao  = viaLabel.includes('PRODUCAO')
  const isCaixa     = viaLabel.includes('CAIXA')

  // ── Cabecalho ──
  p(ESC, 0x61, 0x01)  // centro
  p(ESC, 0x45, 0x01)  // bold on
  p(ESC, 0x21, 0x10)  // altura dupla
  if (data.unit.razaoSocial) l(data.unit.razaoSocial.toUpperCase())
  l(data.unit.nome.toUpperCase())
  p(ESC, 0x21, 0x00)  // normal
  p(ESC, 0x45, 0x00)  // bold off
  if (data.unit.cnpj) l('CNPJ: ' + data.unit.cnpj)
  if (data.unit.endereco) l(data.unit.endereco)
  if (data.unit.telefone) l('Tel: ' + data.unit.telefone)
  p(LF)

  // ── Titulo ──
  p(ESC, 0x61, 0x00)  // esquerda
  t(dashes())
  p(ESC, 0x61, 0x01)
  p(ESC, 0x45, 0x01)
  l(`ENCOMENDA #${String(data.numeroOrdem).padStart(4, '0')}`)
  p(ESC, 0x45, 0x00)
  l(viaLabel)
  p(ESC, 0x61, 0x00)
  t(dashes())

  // ── Cliente ──
  l(`CLIENTE: ${data.clienteNome.toUpperCase()}`)
  if (data.clienteTelefone) l(`TELEFONE: ${data.clienteTelefone}`)
  l(`RETIRADA: ${fmtDate(data.dataRetirada)} as ${data.horaRetirada}`)

  // ── Itens ──
  t(dashes())
  p(ESC, 0x45, 0x01)
  l('ITENS:')
  p(ESC, 0x45, 0x00)
  data.itens.forEach((item, i) => {
    l(` ${String(i + 1).padStart(2)}. ${item.descricao}`)
    l(`     Qtd: ${Number(item.quantidade).toLocaleString('pt-BR')} ${item.unidade}`)
    if (item.observacao) l(`     Obs: ${item.observacao}`)
  })

  // ── Valores ──
  t(dashes())
  if (!isProducao) {
    if (caucao > 0) t(twoColLine('CAUCAO PAGO:', fmtCurrency(caucao)))
    if (total  > 0) t(twoColLine('TOTAL ESTIMADO:', fmtCurrency(total)))
  }

  // ── Observacoes ──
  if (data.observacoes) {
    t(dashes())
    p(ESC, 0x45, 0x01)
    l('OBS:')
    p(ESC, 0x45, 0x00)
    wrapLines(data.observacoes).forEach((b) => parts.push(b))
  }

  // ── Rodape ──
  t(dashes())
  p(ESC, 0x61, 0x01)
  if (data.criadoEm) {
    const pedidoDate = new Date(data.criadoEm)
    const pedidoStr  = [
      String(pedidoDate.getDate()).padStart(2, '0'),
      String(pedidoDate.getMonth() + 1).padStart(2, '0'),
      pedidoDate.getFullYear(),
    ].join('/') + ' ' + [
      String(pedidoDate.getHours()).padStart(2, '0'),
      String(pedidoDate.getMinutes()).padStart(2, '0'),
    ].join(':')
    l(`Pedido em ${pedidoStr}`)
  }
  l(`Atendente: ${atendente}`)
  l(`Impresso em ${nowStr()}`)
  p(ESC, 0x61, 0x00)

  // ── Assinatura (via caixa) ──
  if (isCaixa) {
    p(ESC, 0x64, 0x04)  // avanca 4 linhas
    l('_'.repeat(W))
    p(ESC, 0x61, 0x01)
    l('Assinatura do cliente')
    p(ESC, 0x61, 0x00)
  }

  // ── Corte ──
  p(ESC, 0x64, 0x03)  // avanca 3 linhas
  if (isLast) {
    p(GS, 0x56, 0x41, 0x00)  // corte total
  } else {
    p(GS, 0x56, 0x42, 0x00)  // corte parcial
  }

  return Buffer.concat(parts)
}

// ── API publica ────────────────────────────────────────────────

/**
 * Buffer completo com 3 vias para uma encomenda.
 * O ESC @ (init) é enviado UMA ÚNICA VEZ no início.
 */
export function buildReceiptBuffer(data: PrintData): Buffer {
  const init = Buffer.concat([
    buf(ESC, 0x40),       // ESC @ — inicializar (uma vez)
    buf(ESC, 0x74, 0x02), // ESC t 2 — codepage CP850
  ])

  const vias = ['1a VIA - CLIENTE', '2a VIA - PRODUCAO', '3a VIA - CAIXA']
  const viasBuffer = Buffer.concat(
    vias.map((via, idx) => buildVia(data, via, idx === vias.length - 1)),
  )

  return Buffer.concat([init, viasBuffer])
}

/**
 * Buffer minimo para teste de conectividade e impressao.
 * Imprime apenas uma pagina simples com corte.
 */
export function buildTestBuffer(unitNome: string): Buffer {
  const parts: Buffer[] = []
  const p = (...b: number[]) => parts.push(buf(...b))
  const l = (s: string)       => parts.push(lineBuf(s))

  p(ESC, 0x40)       // init
  p(ESC, 0x74, 0x02) // CP850

  p(ESC, 0x61, 0x01) // centro
  p(ESC, 0x45, 0x01) // bold
  p(ESC, 0x21, 0x10) // altura dupla
  l(toAscii(unitNome.toUpperCase()))
  p(ESC, 0x21, 0x00)
  p(ESC, 0x45, 0x00)

  l('-'.repeat(W))
  p(ESC, 0x61, 0x01)
  p(ESC, 0x45, 0x01)
  l('TESTE DE IMPRESSAO')
  p(ESC, 0x45, 0x00)
  l(nowStr())
  l('')
  l('Impressora configurada com sucesso!')
  l('-'.repeat(W))

  p(ESC, 0x61, 0x00)
  p(ESC, 0x64, 0x05)      // avanca 5 linhas
  p(GS, 0x56, 0x41, 0x00) // corte total

  return Buffer.concat(parts)
}
