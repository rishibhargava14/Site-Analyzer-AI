import { Site } from './crawler'
import { Audit } from './analyzer'

export type Chunk = { id: number; src: string; text: string }
const STOP = new Set('the a an and or of to in is are for on with this that it as be at by from my me i how what why which do does can should'.split(' '))
const tok = (s: string) => (s.toLowerCase().match(/[a-z0-9]{2,}/g) || []).filter(t => !STOP.has(t))

// Knowledge base = page content chunks + structured audit facts. Built once per audit, then reused for every question.
export function buildKnowledge(site: Site, audit: Audit): Chunk[] {
  const out: Chunk[] = []; const push = (src: string, text: string) => out.push({ id: out.length, src, text })
  push('audit:summary', `Overall score ${audit.score}/100 (grade ${audit.grade}) for ${audit.domain}. Pillars: performance ${audit.pillars.performance}, content ${audit.pillars.content}, indexing ${audit.pillars.indexing}, structure ${audit.pillars.structure}. Crawled ${audit.metrics.pagesCrawled} pages, avg ${audit.metrics.avgWords} words, server response ${audit.metrics.ttfbMs} ms, alt coverage ${audit.metrics.altCoverage}%.${audit.metrics.psi ? ` PageSpeed mobile ${audit.metrics.psi.mobile}, LCP ${audit.metrics.psi.lcp}s, CLS ${audit.metrics.psi.cls}.` : ''}`)
  audit.issues.forEach(i => push('audit:issue', `[${i.severity.toUpperCase()} · ${i.pillar}] ${i.title}. Fix: ${i.fix} Expected gain: ${i.impact}.${i.pages?.length ? ` Affected: ${i.pages.slice(0, 4).join(', ')}` : ''}`))
  audit.checklist.forEach(c => push('audit:check', `Check "${c.label}" (${c.category}) is ${c.status}.`))
  site.pages.forEach(p => {
    push(p.url, `Page ${p.url} — title: "${p.title}"; meta description: "${p.desc || 'MISSING'}"; H1: ${p.h1.join(' | ') || 'MISSING'}; ${p.words} words; schema: ${p.schema.join(', ') || 'none'}; canonical: ${p.canonical || 'none'}.`)
    for (let i = 0; i < p.text.length; i += 450) push(p.url, p.text.slice(i, i + 600))
  })
  return out.slice(0, 160)
}

// BM25 retrieval (no embedding API call = no extra latency/cost; swap in embeddings later if you need semantic recall).
export function retrieve(chunks: Chunk[], q: string, k = 6): Chunk[] {
  const docs = chunks.map(c => tok(c.text)); const N = chunks.length || 1
  const avg = docs.reduce((a, d) => a + d.length, 0) / N || 1
  const df = new Map<string, number>(); docs.forEach(d => new Set(d).forEach(t => df.set(t, (df.get(t) || 0) + 1)))
  const qt = [...new Set(tok(q))]
  const scored = chunks.map((c, i) => {
    const d = docs[i]; const tf = new Map<string, number>(); d.forEach(t => tf.set(t, (tf.get(t) || 0) + 1))
    let s = 0
    for (const t of qt) { const f = tf.get(t) || 0; if (!f) continue; const idf = Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5)); s += idf * (f * 2.5) / (f + 1.5 * (0.25 + 0.75 * d.length / avg)) }
    if (c.src === 'audit:summary') s += 0.3 // always keep the headline facts in reach
    return { c, s }
  })
  return scored.sort((a, b) => b.s - a.s).slice(0, k).filter(x => x.s > 0).map(x => x.c)
}
