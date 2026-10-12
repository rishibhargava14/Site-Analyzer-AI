import { NextRequest } from 'next/server'
import { retrieve, Chunk } from '@/lib/rag'
import { llmStream } from '@/lib/llm'

export const maxDuration = 30
const SYSTEM = `You are an expert technical-SEO and web-performance consultant. Answer ONLY from the provided audit context (retrieved chunks). Be concise and concrete: short bullets, prioritised by impact, with the exact fix. Mention affected URLs when the context lists them. If the context doesn't contain the answer, say what is missing instead of guessing.`

export async function POST(req: NextRequest) {
  const { question, knowledge } = (await req.json()) as { question: string; knowledge: Chunk[] }
  if (!question || !Array.isArray(knowledge)) return new Response('Bad request', { status: 400 })
  const top = retrieve(knowledge.slice(0, 200), question, 7)
  const context = top.map((c, i) => `[${i + 1}] (${c.src}) ${c.text}`).join('\n')
  try {
    const stream = await llmStream(SYSTEM, `Audit context:\n${context}\n\nQuestion: ${question}`)
    if (stream) return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-mode': 'llm' } })
  } catch { /* fall through to offline mode */ }
  const text = `Here is what I found in your crawl:\n\n` + (top.length ? top.slice(0, 4).map(c => `• ${c.text.slice(0, 280)}`).join('\n') : 'No matching information in the crawled data.')
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-mode': 'offline' } })
}
