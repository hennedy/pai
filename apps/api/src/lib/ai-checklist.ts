import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@pai/database'

export interface FotoAnalise {
  conformidade: 'Conforme' | 'Não Conforme' | 'Parcial'
  justificativa: string
  confianca: 'alta' | 'media' | 'baixa'
  provider: 'claude' | 'gemini'
}

const PROMPT = (itemDescricao: string, contexto?: string) => `Você é um auditor de qualidade analisando fotos de checklist operacional de uma padaria/restaurante.

Item do checklist: "${itemDescricao}"
${contexto ? `Contexto adicional: ${contexto}` : ''}

Analise a foto e determine se o item está em conformidade com o que foi solicitado.

Responda APENAS com um JSON válido neste formato exato:
{
  "conformidade": "Conforme" | "Não Conforme" | "Parcial",
  "justificativa": "explicação objetiva em até 2 frases do que foi observado na foto",
  "confianca": "alta" | "media" | "baixa"
}

Critérios:
- "Conforme": o item atende completamente ao que foi solicitado
- "Parcial": o item atende parcialmente ou há ressalvas
- "Não Conforme": o item não atende ao que foi solicitado ou há problema evidente
- "baixa" confiança: foto borrada, escura ou não mostra claramente o item`

function parseResposta(text: string): Omit<FotoAnalise, 'provider'> {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Resposta inválida da IA')
  return JSON.parse(match[0])
}

async function analisarComClaude(fotoUrl: string, itemDescricao: string, contexto?: string): Promise<FotoAnalise> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'url', url: fotoUrl } },
        { type: 'text', text: PROMPT(itemDescricao, contexto) },
      ],
    }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return { ...parseResposta(text), provider: 'claude' }
}

async function analisarComGemini(fotoUrl: string, itemDescricao: string, contexto?: string): Promise<FotoAnalise> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  // Baixar a imagem para passar como base64
  const imgRes = await fetch(fotoUrl)
  if (!imgRes.ok) throw new Error('Não foi possível baixar a imagem')
  const buffer = await imgRes.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mimeType = (imgRes.headers.get('content-type') || 'image/jpeg') as any

  const result = await model.generateContent([
    { inlineData: { data: base64, mimeType } },
    PROMPT(itemDescricao, contexto),
  ])
  const text = result.response.text()
  return { ...parseResposta(text), provider: 'gemini' }
}

export async function analisarFotoChecklist(
  fotoUrl: string,
  itemDescricao: string,
  contextoAdicional?: string,
): Promise<FotoAnalise> {
  // Ler provider configurado no banco
  const config = await prisma.systemConfig.findUnique({ where: { chave: 'ia_provider' } })
  const provider = config?.valor ?? 'claude'

  if (provider === 'gemini') {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada')
    return analisarComGemini(fotoUrl, itemDescricao, contextoAdicional)
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY não configurada')
  return analisarComClaude(fotoUrl, itemDescricao, contextoAdicional)
}
