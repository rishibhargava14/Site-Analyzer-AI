import { NextRequest, NextResponse } from 'next/server'
import { crawl, assertPublic } from '@/lib/crawler'
import { analyze, getPsi } from '@/lib/analyzer'
import { buildKnowledge } from '@/lib/rag'
import { saveAudit, findRecentAudit, dbRateLimited } from '@/lib/store'
import { getSession } from '@/lib/auth'

export const maxDuration = 45
const hits = new Map<string, number[]>() // fallback limiter if DB is unreachable

export async function POST(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Please sign in to run a scan.' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'local'
  const limited = await dbRateLimited(user.uid, 6, 'scan')
  if (limited === true) return NextResponse.json({ error: 'Too many scans, wait a minute.' }, { status: 429 })
  if (limited === null) {
    const recent = (hits.get(ip) || []).filter(t => Date.now() - t < 60_000)
    if (recent.length >= 6) return NextResponse.json({ error: 'Too many scans, wait a minute.' }, { status: 429 })
    hits.set(ip, [...recent, Date.now()])
  }

  let { url } = await req.json().catch(() => ({ url: '' }))
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  try {
    const u = new URL(url); await assertPublic(u)
    const saved = await findRecentAudit(u.href, user)
    if (saved) return NextResponse.json({ audit: saved.audit, knowledge: saved.knowledge, auditId: saved.auditId })
    const [site, psi] = await Promise.all([crawl(u.href, +(process.env.MAX_PAGES || 8)), getPsi(u.href)])
    const audit = analyze(site, psi)
    const knowledge = buildKnowledge(site, audit)
    const auditId = await saveAudit(audit, knowledge, site, user)
    return NextResponse.json({ audit, knowledge, auditId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Analysis failed' }, { status: 422 })
  }
}
