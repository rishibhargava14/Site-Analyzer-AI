import * as cheerio from 'cheerio'
import dns from 'node:dns/promises'
import net from 'node:net'

export type Heading = { level: number; text: string }
export type Sec = { hsts: boolean; csp: boolean; xfo: boolean; xcto: boolean; referrer: boolean; permissions: boolean }
export type Page = {
  url: string; status: number; ms: number; bytes: number; compressed: boolean
  title: string; desc: string; h1: string[]; h2: number; h3: number; words: number
  imgs: number; imgNoAlt: number; imgNoDim: number; imgLazy: number; imgModern: number
  canonical: string; noindex: boolean; nofollowMeta: boolean
  schema: string[]; lang: string; viewport: boolean; charset: boolean; doctype: boolean; favicon: boolean
  og: { title: boolean; desc: boolean; image: boolean; twitter: boolean }; hreflang: number
  scripts: number; blocking: number; inlineScripts: number; styles: number; iframes: number
  internal: string[]; extLinks: number; emptyAnchors: number; nofollowLinks: number; blankNoRel: number; mixed: number
  forms: number; unlabeled: number; nameless: number; landmarks: boolean; headingSkips: number
  outline: Heading[]; keywords: { w: string; n: number }[]; readability: number; textRatio: number
  titleH1Overlap: boolean; urlDepth: number; hasParams: boolean
  cache: string; server: string; sec: Sec
  assets: { scripts: string[]; styles: string[]; images: string[] }
  text: string
}
export type Site = {
  origin: string; https: boolean; httpRedirects: boolean | null
  robots: string | null; robotsBlocksAll: boolean; robotsHasSitemap: boolean
  sitemapUrls: number; sitemapList: string[]; soft404: boolean | null
  pages: Page[]; failed: { url: string; status: number }[]
}

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

const STOP = new Set(('the and for are but not you all can had her was one our out has have this that with from they will would there their what about which when your said each she how its into than them these some could other then more also been were because just like over only very even most make made many much such after before where while should being those through between during without again further once here both same does did doing own too any off above below under until against').split(' '))
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

function keywords(text: string) {
  const m = new Map<string, number>()
  for (const w of text.toLowerCase().match(/[a-z]{4,}/g) || []) if (!STOP.has(w)) m.set(w, (m.get(w) || 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w, n]) => ({ w, n }))
}
function flesch(text: string) {
  const ws = text.split(' ').filter(Boolean); if (ws.length < 30) return 0
  const sents = Math.max(1, (text.match(/[.!?]+(\s|$)/g) || []).length)
  const syl = ws.reduce((a, w) => a + Math.max(1, (w.toLowerCase().replace(/[^a-z]/g, '').replace(/e$/, '').match(/[aeiouy]+/g) || []).length), 0)
  return clamp(206.835 - 1.015 * (ws.length / sents) - 84.6 * (syl / ws.length))
}

async function parsePage(url: string): Promise<Page | { url: string; status: number }> {
  try {
    const { res, body, ms, url: finalUrl } = await get(url)
    const type = res.headers.get('content-type') || ''
    if (!res.ok || !type.includes('html')) return { url, status: res.status }
    const $ = cheerio.load(body)
    const fu = new URL(finalUrl); const origin = fu.origin; const isHttps = fu.protocol === 'https:'
    const abs = (v?: string) => { try { return v ? new URL(v, finalUrl).href : '' } catch { return '' } }

    // links
    const internal = new Set<string>(); let ext = 0, empty = 0, nofollow = 0, blankNoRel = 0
    $('a[href]').each((_, a) => {
      const el = $(a)
      try {
        const h = new URL(el.attr('href')!, finalUrl); h.hash = ''
        if (!/^https?:$/.test(h.protocol)) return
        if (h.origin === origin) { if (!/\.(png|jpe?g|gif|svg|webp|pdf|zip|css|js|ico|xml)$/i.test(h.pathname)) internal.add(h.href) } else ext++
      } catch {}
      if (!el.text().trim() && !el.attr('aria-label') && !el.attr('title') && !el.find('img[alt]:not([alt=""])').length) empty++
      if (/nofollow/i.test(el.attr('rel') || '')) nofollow++
      if (el.attr('target') === '_blank' && !/noopener|noreferrer/i.test(el.attr('rel') || '')) blankNoRel++
    })

    // images
    const imgEls = $('img'); let noAlt = 0, noDim = 0, lazy = 0, modern = 0
    imgEls.each((_, i) => {
      const e = $(i); const alt = e.attr('alt'); if (alt === undefined || alt.trim() === '') noAlt++
      if (!(e.attr('width') && e.attr('height')) && !/(aspect-ratio|width|height)/i.test(e.attr('style') || '')) noDim++
      if (e.attr('loading') === 'lazy') lazy++
      if (/\.(webp|avif|svg)(\?|$)/i.test(e.attr('src') || '')) modern++
    })

    // structured data, scripts, styles, mixed content
    const schema: string[] = []
    $('script[type="application/ld+json"]').each((_, s) => { try { const j = JSON.parse($(s).text()); [].concat(j['@graph'] || j).forEach((x: any) => x?.['@type'] && schema.push(String(x['@type']))) } catch {} })
    const scripts = $('script[src]').length, blocking = $('head script[src]:not([async]):not([defer])').length
    const inlineScripts = $('script:not([src]):not([type="application/ld+json"])').length
    const styles = $('link[rel="stylesheet"]').length, iframes = $('iframe').length
    let mixed = 0
    if (isHttps) $('img[src],script[src],link[rel="stylesheet"][href],iframe[src],source[src]').each((_, e) => { if (/^http:\/\//i.test($(e).attr('src') || $(e).attr('href') || '')) mixed++ })
    const assets = {
      scripts: [...new Set($('script[src]').map((_, e) => abs($(e).attr('src'))).get().filter(Boolean))].slice(0, 25),
      styles: [...new Set($('link[rel="stylesheet"]').map((_, e) => abs($(e).attr('href'))).get().filter(Boolean))].slice(0, 25),
      images: [...new Set(imgEls.map((_, e) => abs($(e).attr('src'))).get().filter(Boolean))].slice(0, 25),
    }

    // accessibility
    let unlabeled = 0
    $('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea').each((_, i) => {
      const e = $(i); const id = e.attr('id')
      const ok = e.attr('aria-label') || e.attr('aria-labelledby') || e.attr('title') || (id && $(`label[for="${id}"]`).length) || e.closest('label').length
      if (!ok) unlabeled++
    })
    let nameless = 0
    $('button').each((_, b) => { const e = $(b); if (!e.text().trim() && !e.attr('aria-label') && !e.attr('title') && !e.find('img[alt]:not([alt=""])').length) nameless++ })
    const landmarks = !!($('main,[role=main]').length && ($('nav,[role=navigation]').length || $('header,[role=banner]').length))

    // headings
    const outline: Heading[] = $('h1,h2,h3,h4,h5,h6').map((_, h) => ({ level: +h.tagName[1], text: $(h).text().replace(/\s+/g, ' ').trim().slice(0, 90) })).get().slice(0, 40)
    let skips = 0; for (let i = 1; i < outline.length; i++) if (outline[i].level > outline[i - 1].level + 1) skips++
    const h1 = $('h1').map((_, e) => $(e).text().trim()).get()
    const title = $('title').first().text().trim()

    $('script,style,noscript,svg,nav,footer').remove()
    $('p,div,h1,h2,h3,h4,h5,h6,li,td,th,br,section,article,header,main,button,label').after(' ') // keep words from sticking together across blocks
    const text = $('body').text().replace(/\s+/g, ' ').trim()
    const words = text ? text.split(' ').length : 0
    const bytes = Buffer.byteLength(body)
    const tt = new Set(title.toLowerCase().match(/[a-z0-9]{3,}/g) || [])
    const h = res.headers
    return {
      url: finalUrl, status: res.status, ms, bytes, compressed: !!h.get('content-encoding'),
      title, desc: $('meta[name="description"]').attr('content')?.trim() || '', h1, h2: outline.filter(o => o.level === 2).length, h3: outline.filter(o => o.level === 3).length,
      words, imgs: imgEls.length, imgNoAlt: noAlt, imgNoDim: noDim, imgLazy: lazy, imgModern: modern,
      canonical: $('link[rel="canonical"]').attr('href') || '', noindex: /noindex/i.test($('meta[name="robots"]').attr('content') || ''), nofollowMeta: /nofollow/i.test($('meta[name="robots"]').attr('content') || ''),
      schema, lang: $('html').attr('lang') || '', viewport: !!$('meta[name="viewport"]').length,
      charset: !!($('meta[charset]').length || $('meta[http-equiv="Content-Type" i]').length), doctype: /^\s*<!doctype html/i.test(body), favicon: !!$('link[rel~="icon"]').length,
      og: { title: !!$('meta[property="og:title"]').length, desc: !!$('meta[property="og:description"]').length, image: !!$('meta[property="og:image"]').length, twitter: !!$('meta[name="twitter:card"]').length },
      hreflang: $('link[rel="alternate"][hreflang]').length,
      scripts, blocking, inlineScripts, styles, iframes,
      internal: [...internal], extLinks: ext, emptyAnchors: empty, nofollowLinks: nofollow, blankNoRel, mixed,
      forms: $('form').length, unlabeled, nameless, landmarks, headingSkips: skips,
      outline, keywords: keywords(text), readability: flesch(text), textRatio: bytes ? Math.round((Buffer.byteLength(text) / bytes) * 100) : 0,
      titleH1Overlap: !h1.length || !tt.size || h1.some(x => (x.toLowerCase().match(/[a-z0-9]{3,}/g) || []).some(w => tt.has(w))),
      urlDepth: fu.pathname.split('/').filter(Boolean).length, hasParams: !!fu.search,
      cache: h.get('cache-control') || '', server: h.get('server') || '',
      sec: { hsts: !!h.get('strict-transport-security'), csp: !!h.get('content-security-policy'), xfo: !!(h.get('x-frame-options') || /frame-ancestors/i.test(h.get('content-security-policy') || '')), xcto: !!h.get('x-content-type-options'), referrer: !!h.get('referrer-policy'), permissions: !!(h.get('permissions-policy') || h.get('feature-policy')) },
      assets, text: text.slice(0, 8000),
    }
  } catch { return { url, status: 0 } }
}

function robotsInfo(txt: string | null) {
  if (!txt) return { blocksAll: false, hasSitemap: false }
  let star = false, blocks = false
  for (const raw of txt.split(/\r?\n/)) {
    const l = raw.split('#')[0].trim(); const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue
    const k = m[1].toLowerCase(), v = m[2].trim()
    if (k === 'user-agent') star = v === '*'
    else if (star && k === 'disallow' && v === '/') blocks = true
  }
  return { blocksAll: blocks, hasSitemap: /^\s*sitemap\s*:/im.test(txt) }
}

export async function crawl(start: string, max = 8): Promise<Site> {
  const u = new URL(start); const origin = u.origin
  const [robots, sm, httpTest, soft] = await Promise.all([
    get(origin + '/robots.txt').catch(() => null),
    get(origin + '/sitemap.xml').catch(() => null),
    u.protocol === 'https:' ? (async () => { // does plain http:// redirect to https?
      try { const h = new URL(origin.replace('https:', 'http:') + '/'); await assertPublic(h); const r = await fetch(h.href, { redirect: 'manual', signal: AbortSignal.timeout(6000) }); return r.status >= 300 && r.status < 400 && /^https:/i.test(r.headers.get('location') || '') } catch { return null }
    })() : Promise.resolve(null),
    get(origin + '/sa-404-check-' + Math.random().toString(36).slice(2, 8)).then(r => r.res.status === 404).catch(() => null),
  ])
  const robotsTxt = robots && robots.res.ok && !/<html/i.test(robots.body) ? robots.body : null
  const smOk = sm && sm.res.ok && /<loc>/i.test(sm.body)
  const sitemapList = smOk ? [...sm!.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]).slice(0, 300) : []
  const sitemapUrls = smOk ? (sm!.body.match(/<loc>/gi) || []).length : 0
  const seen = new Set([u.href]); const queue = [u.href]; const pages: Page[] = []; const failed: Site['failed'] = []
  while (queue.length && pages.length + failed.length < max) {
    const batch = queue.splice(0, Math.min(4, max - pages.length - failed.length))
    for (const r of await Promise.all(batch.map(parsePage))) {
      if ('title' in r) { pages.push(r); r.internal.forEach(l => { if (!seen.has(l) && seen.size < 80) { seen.add(l); queue.push(l) } }) } else failed.push(r)
    }
  }
  if (!pages.length) throw new Error('Could not fetch the page (blocked, not HTML, or unreachable)')
  const ri = robotsInfo(robotsTxt)
  return { origin, https: u.protocol === 'https:', httpRedirects: httpTest, robots: robotsTxt, robotsBlocksAll: ri.blocksAll, robotsHasSitemap: ri.hasSitemap, sitemapUrls, sitemapList, soft404: soft, pages, failed }
}
