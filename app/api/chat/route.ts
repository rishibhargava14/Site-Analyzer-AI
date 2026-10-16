import { NextRequest } from 'next/server'
import { retrieve, Chunk } from '@/lib/rag'
import { llmStream } from '@/lib/llm'
import { saveChat } from '@/lib/store'
import { getSession } from '@/lib/auth'

export const maxDuration = 30
const SYSTEM = `You are an expert technical-SEO and web-performance consultant. Answer ONLY from the provided audit context (retrieved chunks). Be concise and concrete: short bullets, prioritised by impact, with the exact fix. Mention affected URLs when the context lists them. If the context doesn't contain the answer, say what is missing instead of guessing.`

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return new Response('Unauthorized', { status: 401 })
  const { question, knowledge, auditId } = (await req.json()) as { question: string; knowledge: Chunk[]; auditId?: string }
  if (!question || !Array.isArray(knowledge)) return new Response('Bad request', { status: 400 })
  const top = retrieve(knowledge.slice(0, 260), question, 7)
  const context = top.map((c, i) => `[${i + 1}] (${c.src}) ${c.text}`).join('\n')
  try {
    const stream = await llmStream(SYSTEM, `Audit context:\n${context}\n\nQuestion: ${question}`)
    if (stream) {
      // tee the stream: one copy goes to the browser, the other is collected and saved to the DB
      if (auditId) {
        const [a, b] = stream.tee()
        ;(async () => { let t = ''; const d = new TextDecoder(); const r = b.getReader(); for (;;) { const { done, value } = await r.read(); if (done) break; t += d.decode(value, { stream: true }) } await saveChat(auditId, user.uid, question, t, 'llm') })().catch(() => {})
        return new Response(a, { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-mode': 'llm' } })
      }
      return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-mode': 'llm' } })
    }
  } catch { /* fall through to offline mode */ }
  const text = `Here is what I found in your crawl:\n\n` + (top.length ? top.slice(0, 4).map(c => `• ${c.text.slice(0, 280)}`).join('\n') : 'No matching information in the crawled data.')
  if (auditId) await saveChat(auditId, user.uid, question, text, 'offline')
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-mode': 'offline' } })
}
