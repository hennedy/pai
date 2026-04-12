/**
 * Gera e imprime o recibo de encomenda em 3 vias
 * via nova janela — evita conflito com o CSS global de impressão (etiquetas 60x60mm).
 *
 * Compatível com impressora térmica Elgin i8 (80mm / ~72mm imprimível).
 */

export interface EncomendaParaImpressao {
  numeroOrdem: number
  clienteNome: string
  clienteTelefone?: string | null
  dataRetirada: string
  horaRetirada: string
  observacoes?: string | null
  valorCaucao: number | string
  valorTotal: number | string
  itens: { descricao: string; quantidade: number | string; unidade: string; observacao?: string | null }[]
  criadoPor?: { nome: string } | null
  criadoPorNome?: string | null
  unit: { nome: string; endereco?: string | null; telefone?: string | null }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function fmtCurrency(v: number | string) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function gerarVia(enc: EncomendaParaImpressao, via: string, isUltima: boolean): string {
  const atendente = enc.criadoPor?.nome ?? enc.criadoPorNome ?? '—'
  const agora = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const itensHtml = enc.itens.map((item, i) => `
    <div style="margin-bottom:1mm">
      &nbsp;&nbsp;${String(i + 1).padStart(2, '\u00a0')}. ${item.descricao}<br>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Qtd: ${Number(item.quantidade).toLocaleString('pt-BR')} ${item.unidade}
      ${item.observacao ? `<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Obs: ${item.observacao}` : ''}
    </div>
  `).join('')

  const caucao = Number(enc.valorCaucao)
  const total  = Number(enc.valorTotal)

  return `
    <div style="
      width:72mm;
      padding:3mm 2mm;
      box-sizing:border-box;
      font-family:'Courier New',Courier,monospace;
      font-size:8.5pt;
      line-height:1.35;
      color:#000;
      background:#fff;
      ${isUltima ? '' : 'page-break-after:always;'}
    ">
      <div style="text-align:center;font-weight:900;font-size:10pt;margin-bottom:1mm">${enc.unit.nome.toUpperCase()}</div>
      ${enc.unit.endereco ? `<div style="text-align:center;font-size:7.5pt;margin-bottom:0.5mm">${enc.unit.endereco}</div>` : ''}
      ${enc.unit.telefone ? `<div style="text-align:center;font-size:7.5pt;margin-bottom:1mm">Tel: ${enc.unit.telefone}</div>` : ''}

      <div style="text-align:center;font-weight:700;font-size:9pt;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:1mm 0;margin-bottom:2mm">
        ENCOMENDA #${String(enc.numeroOrdem).padStart(4, '0')}
      </div>

      <div style="text-align:center;font-size:7.5pt;font-weight:700;margin-bottom:2mm">${via}</div>

      <div style="margin-bottom:1mm"><strong>CLIENTE:</strong> ${enc.clienteNome.toUpperCase()}</div>
      ${enc.clienteTelefone ? `<div style="margin-bottom:1mm"><strong>TELEFONE:</strong> ${enc.clienteTelefone}</div>` : ''}
      <div style="margin-bottom:1mm"><strong>RETIRADA:</strong> ${fmtDate(enc.dataRetirada)} às ${enc.horaRetirada}</div>

      <div style="border-top:1px dashed #000;margin:2mm 0 1mm"></div>
      <div style="font-weight:700;margin-bottom:1mm">ITENS:</div>
      ${itensHtml}

      <div style="border-top:1px dashed #000;margin:2mm 0 1mm"></div>
      ${caucao > 0 ? `<div style="display:flex;justify-content:space-between"><strong>CAUÇÃO PAGO:</strong><span>${fmtCurrency(caucao)}</span></div>` : ''}
      ${total > 0 ? `<div style="display:flex;justify-content:space-between"><strong>TOTAL ESTIMADO:</strong><span>${fmtCurrency(total)}</span></div>` : ''}

      ${enc.observacoes ? `
        <div style="border-top:1px dashed #000;margin:2mm 0 1mm"></div>
        <div style="font-weight:700;margin-bottom:0.5mm">OBS:</div>
        <div style="font-size:7.5pt">${enc.observacoes}</div>
      ` : ''}

      <div style="border-top:1px dashed #000;margin:2mm 0 1mm"></div>
      <div style="text-align:center;font-size:7pt">Emitido em ${agora}</div>
      <div style="text-align:center;font-size:7pt">Atendente: ${atendente}</div>

      ${via === '1ª VIA — CLIENTE' ? `
        <div style="margin-top:8mm;border-top:1px solid #000;text-align:center;font-size:7pt;padding-top:1mm">
          Assinatura do cliente
        </div>
      ` : ''}
    </div>
  `
}

export function printEncomenda(enc: EncomendaParaImpressao) {
  const vias = ['1ª VIA — CLIENTE', '2ª VIA — PRODUÇÃO', '3ª VIA — CAIXA']

  const corpo = vias
    .map((via, idx) => gerarVia(enc, via, idx === vias.length - 1))
    .join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Encomenda #${String(enc.numeroOrdem).padStart(4, '0')}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  </style>
</head>
<body>${corpo}</body>
</html>`

  const win = window.open('', '_blank', 'width=350,height=500,toolbar=0,menubar=0,scrollbars=1')
  if (!win) {
    alert('Permita popups para imprimir o recibo.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  // Aguarda o conteúdo carregar antes de imprimir
  setTimeout(() => {
    win.print()
    // Fecha a janela após o diálogo de impressão
    win.addEventListener('afterprint', () => win.close())
    // Fallback: fecha após 10s se afterprint não disparar
    setTimeout(() => { try { win.close() } catch { /* ignorar */ } }, 10000)
  }, 350)
}
