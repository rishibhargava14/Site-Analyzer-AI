import * as cheerio from 'cheerio'
import dns from 'node:dns/promises'
import net from 'node:net'

export type Page = {
  url: string; status: number; ms: number; bytes: number; compressed: boolean
  title: string; desc: string; h1: string[]; h2: number; words: number
  imgs: number; imgNoAlt: number; canonical: string; noindex: boolean
  schema: string[]; lang: string; viewport: boolean; og: boolean
  scripts: number; blocking: number; internal: string[]; extLinks: number; text: string
}
export type Site = { origin: string; https: boolean; robots: string | null; sitemapUrls: number; pages: Page[]; failed: { url: string; status: number }[] }

function isPrivate(ip: string) {
  if (net.isIPv6(ip)) return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip)
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
}
// SSRF guard: this server fetches user-supplied URLs, so never let it reach private networks.
export async function assertPublic(u: URL) {
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) URLs are allowed')
  if (process.env.ALLOW_LOCAL === '1') return
  const { address } = await dns.lookup(u.hostname)
  if (isPrivate(address)) throw new Error('Private/internal addresses are blocked')
}

async function get(url: string, timeout = 8000) {
  let cur = url
  for (let i = 0; i < 4; i++) {
    await assertPublic(new URL(cur))
    const t0 = Date.now()
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), timeout)
    try {
      const res = await fetch(cur, { redirect: 'manual', signal: ctl.signal, headers: { 'user-agent': 'SiteAnalyzerAI/1.0 (+audit bot)', accept: 'text/html,*/*' } })
      const ttfb = Date.now() - t0
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { cur = new URL(res.headers.get('location')!, cur).href; continue }
      const body = await res.text()
      return { res, body: body.slice(0, 1_500_000), ms: ttfb, url: cur }
    } finally { clearTimeout(to) }
  }
  throw new Error('Too many redirects')
}

async function parsePage(url: string): Promise<Page | { url: string; status: number }> {
  try {
    const { res, body, ms, url: finalUrl } = await get(url)
    const type = res.headers.get('content-type') || ''
    if (!res.ok || !type.includes('html')) return { url, status: res.status }
    const $ = cheerio.load(body)
    const origin = new URL(finalUrl).origin
    const internal = new Set<string>(); let ext = 0
    $('a[href]').each((_, a) => {
      try {
        const h = new URL($(a).attr('href')!, finalUrl); h.hash = ''
        if (!/^https?:$/.test(h.protocol)) return
        if (h.origin === origin) { if (!/\.(png|jpe?g|gif|svg|webp|pdf|zip|css|js|ico|xml)$/i.test(h.pathname)) internal.add(h.href) } else ext++
      } catch {}
    })
    const imgs = $('img'); let noAlt = 0
    imgs.each((_, i) => { const alt = $(i).attr('alt'); if (alt === undefined || alt.trim() === '') noAlt++ })
    const schema: string[] = []
    $('script[type="application/ld+json"]').each((_, s) => { try { const j = JSON.parse($(s).text()); [].concat(j['@graph'] || j).forEach((x: any) => x?.['@type'] && schema.push(String(x['@type']))) } catch {} })
    const scripts = $('script[src]').length, blocking = $('head script[src]:not([async]):not([defer])').length
    $('script,style,noscript,svg,nav,footer').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim()
    return {
      url: finalUrl, status: res.status, ms, bytes: Buffer.byteLength(body), compressed: !!res.headers.get('content-encoding'),
      title: $('title').first().text().trim(), desc: $('meta[name="description"]').attr('content')?.trim() || '',
      h1: $('h1').map((_, e) => $(e).text().trim()).get(), h2: $('h2').length,
      words: text ? text.split(' ').length : 0, imgs: imgs.length, imgNoAlt: noAlt,
      canonical: $('link[rel="canonical"]').attr('href') || '', noindex: /noindex/i.test($('meta[name="robots"]').attr('content') || ''),
      schema, lang: $('html').attr('lang') || '', viewport: !!$('meta[name="viewport"]').length, og: !!$('meta[property="og:title"]').length,
      scripts, blocking,
      internal: [...internal], extLinks: ext, text: text.slice(0, 8000),
    }
  } catch { return { url, status: 0 } }
}

export async function crawl(start: string, max = 8): Promise<Site> {
  const u = new URL(start); const origin = u.origin
  const [robots, sm] = await Promise.all([get(origin + '/robots.txt').catch(() => null), get(origin + '/sitemap.xml').catch(() => null)])
  const robotsTxt = robots && robots.res.ok && !/<html/i.test(robots.body) ? robots.body : null
  const sitemapUrls = sm && sm.res.ok && /<loc>/i.test(sm.body) ? (sm.body.match(/<loc>/gi) || []).length : 0
  const seen = new Set([u.href]); const queue = [u.href]; const pages: Page[] = []; const failed: Site['failed'] = []
  while (queue.length && pages.length + failed.length < max) {
    const batch = queue.splice(0, Math.min(4, max - pages.length - failed.length))
    for (const r of await Promise.all(batch.map(parsePage))) {
      if ('title' in r) { pages.push(r); r.internal.forEach(l => { if (!seen.has(l) && seen.size < 80) { seen.add(l); queue.push(l) } }) } else failed.push(r)
    }
  }
  if (!pages.length) throw new Error('Could not fetch the page (blocked, not HTML, or unreachable)')
  return { origin, https: u.protocol === 'https:', robots: robotsTxt, sitemapUrls, pages, failed }
}
