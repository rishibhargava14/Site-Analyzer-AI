import { Site } from './crawler'

export type Issue = { severity: 'high' | 'medium' | 'low'; title: string; fix: string; impact: string; pillar: string; pages?: string[] }
export type Check = { label: string; status: 'pass' | 'warn' | 'fail'; category: string }
export type Audit = {
  url: string; domain: string; score: number; grade: string
  pillars: { performance: number; content: number; indexing: number; structure: number }
  metrics: { pagesCrawled: number; avgWords: number; thinPages: number; ttfbMs: number; htmlKb: number; altCoverage: number; internalLinksAvg: number; sitemapUrls: number; psi?: { mobile: number; lcp: number; cls: number; tbt: number } }
  pages: { url: string; status: number; title: string; words: number; h1: number; ms: number; issues: number }[]
  issues: Issue[]; checklist: Check[]
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const grade = (s: number) => (s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F')
const pct = (n: number, d: number) => (d ? n / d : 1)

export async function getPsi(url: string) {
  const key = process.env.PSI_API_KEY; if (!key) return undefined
  try {
    const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&key=${key}`, { signal: AbortSignal.timeout(20000) })
    const j = await r.json(); const a = j.lighthouseResult?.audits
    return { mobile: Math.round(j.lighthouseResult.categories.performance.score * 100), lcp: +(a['largest-contentful-paint'].numericValue / 1000).toFixed(2), cls: +a['cumulative-layout-shift'].numericValue.toFixed(3), tbt: Math.round(a['total-blocking-time'].numericValue) }
  } catch { return undefined }
}

export function analyze(site: Site, psi?: Audit['metrics']['psi']): Audit {
  const P = site.pages, n = P.length
  const issues: Issue[] = []
  const add = (i: Issue) => issues.push(i)
  const list = (f: (p: typeof P[0]) => boolean) => P.filter(f).map(p => p.url)

  // ---- Structure
  const noH1 = list(p => p.h1.length === 0), multiH1 = list(p => p.h1.length > 1)
  const badTitle = list(p => !p.title || p.title.length < 20 || p.title.length > 65)
  const badDesc = list(p => !p.desc || p.desc.length < 70 || p.desc.length > 165)
  const dupTitles = P.length - new Set(P.map(p => p.title)).size
  const imgs = P.reduce((a, p) => a + p.imgs, 0), noAlt = P.reduce((a, p) => a + p.imgNoAlt, 0)
  const altCov = Math.round(pct(imgs - noAlt, imgs) * 100)
  const hasSchema = P.some(p => p.schema.length), noViewport = list(p => !p.viewport), noLang = list(p => !p.lang)
  const avgLinks = Math.round(P.reduce((a, p) => a + p.internal.length, 0) / n)
  if (noH1.length) add({ severity: 'high', pillar: 'Structure', title: `${noH1.length} page(s) have no H1`, fix: 'Add exactly one descriptive H1 per page that contains the primary keyword.', impact: '+8 Structure', pages: noH1 })
  if (multiH1.length) add({ severity: 'medium', pillar: 'Structure', title: `${multiH1.length} page(s) have multiple H1s`, fix: 'Keep one H1; demote the others to H2/H3.', impact: '+4 Structure', pages: multiH1 })
  if (badTitle.length) add({ severity: 'high', pillar: 'Structure', title: `${badTitle.length} page(s) with missing or badly sized <title>`, fix: 'Write unique titles of ~30–60 characters with the main keyword near the start.', impact: '+7 Structure', pages: badTitle })
  if (badDesc.length) add({ severity: 'medium', pillar: 'Structure', title: `${badDesc.length} page(s) with missing or off-length meta description`, fix: 'Write a 70–160 character description that sells the click.', impact: '+5 Structure', pages: badDesc })
  if (dupTitles) add({ severity: 'medium', pillar: 'Content', title: `${dupTitles} duplicate title(s) across crawled pages`, fix: 'Give every page a unique title; duplicates confuse ranking and click-through.', impact: '+4 Content' })
  if (noAlt) add({ severity: altCov < 80 ? 'high' : 'medium', pillar: 'Structure', title: `${noAlt} of ${imgs} images have no alt text (${altCov}% coverage)`, fix: 'Add descriptive alt text; use alt="" only for purely decorative images.', impact: '+5 Structure' })
  if (!hasSchema) add({ severity: 'medium', pillar: 'Structure', title: 'No JSON-LD structured data found', fix: 'Add Organization/WebSite (and Article/Product/FAQ where relevant) JSON-LD to qualify for rich results.', impact: '+6 Structure' })
  if (noViewport.length) add({ severity: 'high', pillar: 'Structure', title: 'Missing mobile viewport meta tag', fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.', impact: '+6 Structure', pages: noViewport })
  if (noLang.length) add({ severity: 'low', pillar: 'Structure', title: 'Missing <html lang> attribute', fix: 'Set the page language, e.g. <html lang="en">.', impact: '+2 Structure', pages: noLang })

  // ---- Indexing
  const noCanon = list(p => !p.canonical), noindex = list(p => p.noindex)
  if (!site.https) add({ severity: 'high', pillar: 'Indexing', title: 'Site is not served over HTTPS', fix: 'Install a TLS certificate and 301-redirect HTTP to HTTPS.', impact: '+10 Indexing' })
  if (!site.robots) add({ severity: 'medium', pillar: 'Indexing', title: 'robots.txt not found', fix: 'Create /robots.txt and reference your sitemap in it.', impact: '+5 Indexing' })
  if (!site.sitemapUrls) add({ severity: 'high', pillar: 'Indexing', title: 'sitemap.xml missing or empty', fix: 'Generate /sitemap.xml (next-sitemap for Next.js) and submit it in Search Console.', impact: '+8 Indexing' })
  if (noCanon.length) add({ severity: 'medium', pillar: 'Indexing', title: `${noCanon.length} page(s) without canonical URL`, fix: 'Add <link rel="canonical"> to prevent duplicate-URL dilution.', impact: '+4 Indexing', pages: noCanon })
  if (noindex.length) add({ severity: 'high', pillar: 'Indexing', title: `${noindex.length} page(s) set to noindex`, fix: 'Remove noindex on pages that should rank.', impact: '+8 Indexing', pages: noindex })
  if (site.failed.length) add({ severity: 'medium', pillar: 'Indexing', title: `${site.failed.length} internal link(s) failed or returned non-HTML`, fix: 'Fix broken internal links (404/5xx) or redirect them.', impact: '+4 Indexing', pages: site.failed.map(f => `${f.url} (${f.status || 'unreachable'})`) })

  // ---- Content
  const avgWords = Math.round(P.reduce((a, p) => a + p.words, 0) / n)
  const thin = list(p => p.words < 300)
  if (thin.length) add({ severity: thin.length > n / 2 ? 'high' : 'medium', pillar: 'Content', title: `${thin.length} thin page(s) under 300 words`, fix: 'Expand with unique, expert content (aim 800+ words where intent needs it), FAQs and original examples.', impact: '+8 Content', pages: thin })

  // ---- Performance (measured from the server's fetch; PSI blended in when available)
  const ttfb = Math.round(P.reduce((a, p) => a + p.ms, 0) / n), htmlKb = Math.round(P.reduce((a, p) => a + p.bytes, 0) / n / 1024)
  const blocking = P.reduce((a, p) => a + p.blocking, 0), uncompressed = list(p => !p.compressed && p.bytes > 10_000)
  if (ttfb > 600) add({ severity: 'high', pillar: 'Performance', title: `Slow server response (avg ${ttfb} ms)`, fix: 'Add caching/CDN, optimise DB queries, and use edge/ISR rendering.', impact: '+10 Performance' })
  if (uncompressed.length) add({ severity: 'medium', pillar: 'Performance', title: `${uncompressed.length} page(s) served without gzip/brotli`, fix: 'Enable brotli/gzip on your server or CDN.', impact: '+6 Performance', pages: uncompressed })
  if (blocking) add({ severity: 'medium', pillar: 'Performance', title: `${blocking} render-blocking script(s) in <head>`, fix: 'Add defer/async or move scripts to the end of <body>.', impact: '+6 Performance' })
  if (htmlKb > 200) add({ severity: 'medium', pillar: 'Performance', title: `Heavy HTML (avg ${htmlKb} KB)`, fix: 'Trim inline JSON/CSS and paginate long lists.', impact: '+4 Performance' })
  if (psi && psi.lcp > 2.5) add({ severity: 'high', pillar: 'Performance', title: `LCP ${psi.lcp}s on mobile (target < 2.5s)`, fix: 'Preload the hero image, use next/image priority, serve WebP/AVIF.', impact: '+12 Performance' })

  const perfHeur = clamp(100 - Math.max(0, ttfb - 200) / 8 - (uncompressed.length ? 10 : 0) - blocking * 4 - Math.max(0, htmlKb - 100) / 6)
  const performance = psi ? clamp(perfHeur * 0.4 + psi.mobile * 0.6) : perfHeur
  const structure = clamp(100 - noH1.length / n * 25 - multiH1.length / n * 8 - badTitle.length / n * 18 - badDesc.length / n * 12 - (100 - altCov) * 0.15 - (hasSchema ? 0 : 10) - noViewport.length / n * 15 - noLang.length / n * 4)
  const indexing = clamp(100 - (site.https ? 0 : 25) - (site.robots ? 0 : 10) - (site.sitemapUrls ? 0 : 20) - noCanon.length / n * 12 - noindex.length / n * 30 - site.failed.length * 5)
  const content = clamp(40 + Math.min(40, avgWords / 20) - thin.length / n * 30 - (dupTitles / n) * 20 + 20 * Math.min(1, P.reduce((a, p) => a + p.h2, 0) / n / 3))
  const score = clamp(performance * 0.25 + content * 0.25 + indexing * 0.25 + structure * 0.25)

  const ck = (label: string, category: string, ok: boolean, warn = false): Check => ({ label, category, status: ok ? 'pass' : warn ? 'warn' : 'fail' })
  const sev = { high: 0, medium: 1, low: 2 }
  return {
    url: P[0].url, domain: new URL(P[0].url).hostname, score, grade: grade(score), pillars: { performance, content, indexing, structure },
    metrics: { pagesCrawled: n, avgWords, thinPages: thin.length, ttfbMs: ttfb, htmlKb, altCoverage: altCov, internalLinksAvg: avgLinks, sitemapUrls: site.sitemapUrls, psi },
    pages: P.map(p => ({ url: p.url, status: p.status, title: p.title, words: p.words, h1: p.h1.length, ms: p.ms, issues: issues.filter(i => i.pages?.includes(p.url)).length })),
    issues: issues.sort((a, b) => sev[a.severity] - sev[b.severity]),
    checklist: [
      ck('HTTPS', 'Indexing', site.https), ck('robots.txt found', 'Indexing', !!site.robots), ck('sitemap.xml found', 'Indexing', !!site.sitemapUrls),
      ck('Canonical tags', 'Indexing', !noCanon.length, true), ck('Single H1 per page', 'Structure', !noH1.length && !multiH1.length, !noH1.length),
      ck('Title length 20–65', 'Structure', !badTitle.length, true), ck('Meta description', 'Structure', !badDesc.length, true), ck('Image alt coverage ≥ 90%', 'Structure', altCov >= 90, altCov >= 70),
      ck('Structured data (JSON-LD)', 'Structure', hasSchema, true), ck('Mobile viewport', 'Structure', !noViewport.length), ck('Compression enabled', 'Performance', !uncompressed.length, true),
      ck('Server response < 600 ms', 'Performance', ttfb <= 600, ttfb <= 1200), ck('No thin content', 'Content', !thin.length, thin.length < n / 2), ck('Unique titles', 'Content', !dupTitles, true),
    ],
  }
}
