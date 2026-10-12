import { NextRequest, NextResponse } from 'next/server'
import { crawl, assertPublic } from '@/lib/crawler'
import { analyze, getPsi } from '@/lib/analyzer'
import { buildKnowledge } from '@/lib/rag'

export const maxDuration = 45
const cache = new Map<string, { t: number; data: any }>() // 10-min cache => repeat scans are instant
const hits = new Map<string, number[]>()                  // naive per-IP rate limit (use Upstash/Redis in prod)

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'local'
  const recent = (hits.get(ip) || []).filter(t => Date.now() - t < 60_000)
  if (recent.length >= 6) return NextResponse.json({ error: 'Too many scans, wait a minute.' }, { status: 429 })
  hits.set(ip, [...recent, Date.now()])

  let { url } = await req.json().catch(() => ({ url: '' }))
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  try {
    const u = new URL(url); await assertPublic(u)
    const hit = cache.get(u.href); if (hit && Date.now() - hit.t < 600_000) return NextResponse.json(hit.data)
    const [site, psi] = await Promise.all([crawl(u.href, +(process.env.MAX_PAGES || 8)), getPsi(u.href)])
    const audit = analyze(site, psi)
    const data = { audit, knowledge: buildKnowledge(site, audit) }
    cache.set(u.href, { t: Date.now(), data })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Analysis failed' }, { status: 422 })
  }
}
