import { Site, Page } from './crawler'

export type Issue = { severity: 'high' | 'medium' | 'low'; title: string; fix: string; impact: string; pillar: string; pages?: string[] }
export type Check = { label: string; status: 'pass' | 'warn' | 'fail'; category: string }
export type Pillars = { performance: number; content: number; indexing: number; structure: number; security: number; accessibility: number }
export type Audit = {
  url: string; domain: string; score: number; grade: string
  pillars: Pillars
  metrics: {
    pagesCrawled: number; avgWords: number; thinPages: number; ttfbMs: number; htmlKb: number; altCoverage: number; internalLinksAvg: number; sitemapUrls: number
    readability: number; textRatio: number; securityHeaders: number; imagesTotal: number; scriptsAvg: number; extLinksAvg: number; mixedContent: number
    keywords: { w: string; n: number }[]
    psi?: { mobile: number; lcp: number; cls: number; tbt: number }
  }
  pages: { url: string; status: number; title: string; words: number; h1: number; ms: number; issues: number }[]
  issues: Issue[]; checklist: Check[]
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const grade = (s: number) => (s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 60 ? 'D' : 'F')
const pct = (n: number, d: number) => (d ? n / d : 1)
const norm = (u: string) => u.replace(/#.*$/, '').replace(/\/$/, '').toLowerCase()

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
  const list = (f: (p: Page) => boolean) => P.filter(f).map(p => p.url)
  const sum = (f: (p: Page) => number) => P.reduce((a, p) => a + f(p), 0)
  const first = P[0]

  // ================= STRUCTURE (titles, headings, meta, social, markup hygiene)
  const noH1 = list(p => p.h1.length === 0), multiH1 = list(p => p.h1.length > 1)
  const badTitle = list(p => !p.title || p.title.length < 20 || p.title.length > 65)
  const badDesc = list(p => !p.desc || p.desc.length < 70 || p.desc.length > 165)
  const dupTitles = n - new Set(P.map(p => p.title)).size
  const descs = P.filter(p => p.desc).map(p => p.desc); const dupDescs = descs.length - new Set(descs).size
  const imgs = sum(p => p.imgs), noAlt = sum(p => p.imgNoAlt)
  const altCov = Math.round(pct(imgs - noAlt, imgs) * 100)
  const hasSchema = P.some(p => p.schema.length), noViewport = list(p => !p.viewport), noLang = list(p => !p.lang)
  const noOg = list(p => !(p.og.title && p.og.desc && p.og.image)), noTwitter = list(p => !p.og.twitter)
  const noFavicon = list(p => !p.favicon), noCharset = list(p => !p.charset), noDoctype = list(p => !p.doctype)
  const titleMismatch = list(p => !p.titleH1Overlap)
  const deepUrls = list(p => p.urlDepth > 4 || p.url.length > 115 || p.hasParams)
  const avgLinks = Math.round(sum(p => p.internal.length) / n)
  if (noH1.length) add({ severity: 'high', pillar: 'Structure', title: `${noH1.length} page(s) have no H1`, fix: 'Add exactly one descriptive H1 per page that contains the primary keyword.', impact: '+8 Structure', pages: noH1 })
  if (multiH1.length) add({ severity: 'medium', pillar: 'Structure', title: `${multiH1.length} page(s) have multiple H1s`, fix: 'Keep one H1; demote the others to H2/H3.', impact: '+4 Structure', pages: multiH1 })
  if (badTitle.length) add({ severity: 'high', pillar: 'Structure', title: `${badTitle.length} page(s) with missing or badly sized <title>`, fix: 'Write unique titles of ~30–60 characters with the main keyword near the start.', impact: '+7 Structure', pages: badTitle })
  if (badDesc.length) add({ severity: 'medium', pillar: 'Structure', title: `${badDesc.length} page(s) with missing or off-length meta description`, fix: 'Write a 70–160 character description that sells the click.', impact: '+5 Structure', pages: badDesc })
  if (titleMismatch.length) add({ severity: 'low', pillar: 'Structure', title: `${titleMismatch.length} page(s) where the H1 shares no words with the title`, fix: 'Align the H1 and <title> around the same primary topic.', impact: '+2 Structure', pages: titleMismatch })
  if (noOg.length) add({ severity: 'medium', pillar: 'Structure', title: `${noOg.length} page(s) missing full Open Graph tags (og:title, og:description, og:image)`, fix: 'Add Open Graph tags so links look good on WhatsApp, LinkedIn, Facebook and Slack.', impact: '+4 Structure', pages: noOg })
  if (noTwitter.length === n) add({ severity: 'low', pillar: 'Structure', title: 'No Twitter/X card tags', fix: 'Add <meta name="twitter:card" content="summary_large_image">.', impact: '+2 Structure' })
  if (noFavicon.length) add({ severity: 'low', pillar: 'Structure', title: `${noFavicon.length} page(s) without a favicon link`, fix: 'Add <link rel="icon" href="/favicon.ico"> (and an apple-touch-icon).', impact: '+2 Structure', pages: noFavicon })
  if (noCharset.length) add({ severity: 'low', pillar: 'Structure', title: `${noCharset.length} page(s) without a charset declaration`, fix: 'Add <meta charset="utf-8"> as the first tag in <head>.', impact: '+2 Structure', pages: noCharset })
  if (noDoctype.length) add({ severity: 'low', pillar: 'Structure', title: `${noDoctype.length} page(s) missing <!DOCTYPE html>`, fix: 'Start every document with <!DOCTYPE html> to avoid quirks mode.', impact: '+2 Structure', pages: noDoctype })
  if (deepUrls.length) add({ severity: 'low', pillar: 'Structure', title: `${deepUrls.length} URL(s) are long, deep (>4 levels) or use query parameters`, fix: 'Prefer short, readable, lowercase slugs; avoid parameters for indexable pages.', impact: '+2 Structure', pages: deepUrls })
  if (noAlt) add({ severity: altCov < 80 ? 'high' : 'medium', pillar: 'Structure', title: `${noAlt} of ${imgs} images have no alt text (${altCov}% coverage)`, fix: 'Add descriptive alt text; use alt="" only for purely decorative images.', impact: '+5 Structure' })
  if (!hasSchema) add({ severity: 'medium', pillar: 'Structure', title: 'No JSON-LD structured data found', fix: 'Add Organization/WebSite (and Article/Product/FAQ where relevant) JSON-LD to qualify for rich results.', impact: '+6 Structure' })
  if (noViewport.length) add({ severity: 'high', pillar: 'Structure', title: 'Missing mobile viewport meta tag', fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.', impact: '+6 Structure', pages: noViewport })
  if (noLang.length) add({ severity: 'low', pillar: 'Structure', title: 'Missing <html lang> attribute', fix: 'Set the page language, e.g. <html lang="en">.', impact: '+2 Structure', pages: noLang })

  // ================= INDEXING (crawlability, canonical, sitemap, robots)
  const noCanon = list(p => !p.canonical), noindex = list(p => p.noindex), nofollowPages = list(p => p.nofollowMeta)
  const canonMismatch = P.filter(p => { if (!p.canonical) return false; try { return norm(new URL(p.canonical, p.url).href) !== norm(p.url) } catch { return false } }).map(p => p.url)
  if (!site.https) add({ severity: 'high', pillar: 'Indexing', title: 'Site is not served over HTTPS', fix: 'Install a TLS certificate and 301-redirect HTTP to HTTPS.', impact: '+10 Indexing' })
  if (!site.robots) add({ severity: 'medium', pillar: 'Indexing', title: 'robots.txt not found', fix: 'Create /robots.txt and reference your sitemap in it.', impact: '+5 Indexing' })
  if (site.robotsBlocksAll) add({ severity: 'high', pillar: 'Indexing', title: 'robots.txt blocks the entire site (Disallow: / for all bots)', fix: 'Remove "Disallow: /" under "User-agent: *" unless the site is meant to be private.', impact: '+20 Indexing' })
  if (site.robots && !site.robotsHasSitemap) add({ severity: 'low', pillar: 'Indexing', title: 'robots.txt does not reference the sitemap', fix: 'Add a line: Sitemap: https://your-domain/sitemap.xml', impact: '+2 Indexing' })
  if (!site.sitemapUrls) add({ severity: 'high', pillar: 'Indexing', title: 'sitemap.xml missing or empty', fix: 'Generate /sitemap.xml (next-sitemap for Next.js) and submit it in Search Console.', impact: '+8 Indexing' })
  if (site.soft404 === false) add({ severity: 'medium', pillar: 'Indexing', title: 'Soft 404: unknown URLs return 200 instead of 404', fix: 'Return a real 404 status for pages that do not exist so search engines drop them.', impact: '+4 Indexing' })
  if (noCanon.length) add({ severity: 'medium', pillar: 'Indexing', title: `${noCanon.length} page(s) without canonical URL`, fix: 'Add <link rel="canonical"> to prevent duplicate-URL dilution.', impact: '+4 Indexing', pages: noCanon })
  if (canonMismatch.length) add({ severity: 'medium', pillar: 'Indexing', title: `${canonMismatch.length} page(s) whose canonical points to a different URL`, fix: 'Confirm this is intentional; otherwise make the canonical self-referencing.', impact: '+3 Indexing', pages: canonMismatch })
  if (noindex.length) add({ severity: 'high', pillar: 'Indexing', title: `${noindex.length} page(s) set to noindex`, fix: 'Remove noindex on pages that should rank.', impact: '+8 Indexing', pages: noindex })
  if (nofollowPages.length) add({ severity: 'low', pillar: 'Indexing', title: `${nofollowPages.length} page(s) with meta nofollow`, fix: 'Remove nofollow so link equity can flow, unless intentional.', impact: '+2 Indexing', pages: nofollowPages })
  if (site.failed.length) add({ severity: 'medium', pillar: 'Indexing', title: `${site.failed.length} internal link(s) failed or returned non-HTML`, fix: 'Fix broken internal links (404/5xx) or redirect them.', impact: '+4 Indexing', pages: site.failed.map(f => `${f.url} (${f.status || 'unreachable'})`) })

  // ================= CONTENT
  const avgWords = Math.round(sum(p => p.words) / n)
  const thin = list(p => p.words < 300)
  const reads = P.filter(p => p.readability > 0).map(p => p.readability)
  const readability = reads.length ? Math.round(reads.reduce((a, b) => a + b, 0) / reads.length) : 0
  const textRatio = Math.round(sum(p => p.textRatio) / n)
  const stuffed = P.filter(p => p.words > 150 && p.keywords[0] && p.keywords[0].n / p.words > 0.04).map(p => p.url)
  const lowText = list(p => p.textRatio < 10 && p.words > 0)
  const kw = new Map<string, number>(); P.forEach(p => p.keywords.forEach(k => kw.set(k.w, (kw.get(k.w) || 0) + k.n)))
  const keywords = [...kw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w, c]) => ({ w, n: c }))
  if (thin.length) add({ severity: thin.length > n / 2 ? 'high' : 'medium', pillar: 'Content', title: `${thin.length} thin page(s) under 300 words`, fix: 'Expand with unique, expert content (aim 800+ words where intent needs it), FAQs and original examples.', impact: '+8 Content', pages: thin })
  if (dupTitles) add({ severity: 'medium', pillar: 'Content', title: `${dupTitles} duplicate title(s) across crawled pages`, fix: 'Give every page a unique title; duplicates confuse ranking and click-through.', impact: '+4 Content' })
  if (dupDescs) add({ severity: 'medium', pillar: 'Content', title: `${dupDescs} duplicate meta description(s)`, fix: 'Write a unique description for each page.', impact: '+3 Content' })
  if (readability && readability < 40) add({ severity: 'medium', pillar: 'Content', title: `Hard-to-read copy (Flesch score ${readability}/100)`, fix: 'Use shorter sentences and simpler words; aim for a Flesch score of 50+ for general audiences.', impact: '+4 Content' })
  if (stuffed.length) add({ severity: 'medium', pillar: 'Content', title: `${stuffed.length} page(s) repeat one keyword more than 4% of the time`, fix: 'Reduce repetition and use natural variations; keyword stuffing can be penalised.', impact: '+4 Content', pages: stuffed })
  if (lowText.length) add({ severity: 'low', pillar: 'Content', title: `${lowText.length} page(s) with very low text-to-HTML ratio (<10%)`, fix: 'Trim bloated markup/inline scripts or add more real content.', impact: '+2 Content', pages: lowText })
  const lowH2 = sum(p => p.h2) / n < 1
  if (lowH2) add({ severity: 'low', pillar: 'Content', title: 'Pages have almost no H2 subheadings', fix: 'Break content into scannable sections with descriptive H2/H3 headings.', impact: '+3 Content' })

  // ================= PERFORMANCE
  const ttfb = Math.round(sum(p => p.ms) / n), htmlKb = Math.round(sum(p => p.bytes) / n / 1024)
  const blocking = sum(p => p.blocking), uncompressed = list(p => !p.compressed && p.bytes > 10_000)
  const scriptsAvg = Math.round(sum(p => p.scripts) / n), noDimImgs = sum(p => p.imgNoDim)
  const modernImgs = sum(p => p.imgModern), lazyImgs = sum(p => p.imgLazy), manyIframes = list(p => p.iframes > 3)
  if (ttfb > 600) add({ severity: 'high', pillar: 'Performance', title: `Slow server response (avg ${ttfb} ms)`, fix: 'Add caching/CDN, optimise DB queries, and use edge/ISR rendering.', impact: '+10 Performance' })
  if (uncompressed.length) add({ severity: 'medium', pillar: 'Performance', title: `${uncompressed.length} page(s) served without gzip/brotli`, fix: 'Enable brotli/gzip on your server or CDN.', impact: '+6 Performance', pages: uncompressed })
  if (blocking) add({ severity: 'medium', pillar: 'Performance', title: `${blocking} render-blocking script(s) in <head>`, fix: 'Add defer/async or move scripts to the end of <body>.', impact: '+6 Performance' })
  if (htmlKb > 200) add({ severity: 'medium', pillar: 'Performance', title: `Heavy HTML (avg ${htmlKb} KB)`, fix: 'Trim inline JSON/CSS and paginate long lists.', impact: '+4 Performance' })
  if (scriptsAvg > 25) add({ severity: 'medium', pillar: 'Performance', title: `Too many external scripts (avg ${scriptsAvg} per page)`, fix: 'Bundle, remove unused third-party scripts and load the rest with defer.', impact: '+5 Performance' })
  if (noDimImgs && imgs) add({ severity: noDimImgs / imgs > 0.5 ? 'medium' : 'low', pillar: 'Performance', title: `${noDimImgs} of ${imgs} images have no width/height (layout shift risk)`, fix: 'Set width and height attributes (or aspect-ratio) so the browser reserves space.', impact: '+4 Performance' })
  if (imgs > 6 && !lazyImgs) add({ severity: 'low', pillar: 'Performance', title: 'No images use lazy loading', fix: 'Add loading="lazy" to below-the-fold images.', impact: '+3 Performance' })
  if (imgs > 5 && modernImgs / imgs < 0.3) add({ severity: 'low', pillar: 'Performance', title: 'Few images use modern formats (WebP/AVIF/SVG)', fix: 'Serve WebP/AVIF; with next/image this is automatic.', impact: '+3 Performance' })
  if (manyIframes.length) add({ severity: 'low', pillar: 'Performance', title: `${manyIframes.length} page(s) embed more than 3 iframes`, fix: 'Lazy-load or remove non-essential embeds.', impact: '+2 Performance', pages: manyIframes })
  if (psi && psi.lcp > 2.5) add({ severity: 'high', pillar: 'Performance', title: `LCP ${psi.lcp}s on mobile (target < 2.5s)`, fix: 'Preload the hero image, use next/image priority, serve WebP/AVIF.', impact: '+12 Performance' })
  if (psi && psi.cls > 0.1) add({ severity: 'medium', pillar: 'Performance', title: `CLS ${psi.cls} on mobile (target < 0.1)`, fix: 'Reserve space for images, ads and embeds; avoid inserting content above existing content.', impact: '+6 Performance' })
  if (psi && psi.tbt > 200) add({ severity: 'medium', pillar: 'Performance', title: `Total Blocking Time ${psi.tbt} ms (target < 200 ms)`, fix: 'Split long JavaScript tasks and defer non-critical scripts.', impact: '+6 Performance' })

  // ================= SECURITY (headers, transport, link hygiene)
  const s = first.sec
  const mixedPages = list(p => p.mixed > 0), mixedTotal = sum(p => p.mixed), blankNoRel = sum(p => p.blankNoRel)
  const versionLeak = /\d+\.\d+/.test(first.server)
  const secCount = Object.values(s).filter(Boolean).length
  if (site.https && site.httpRedirects === false) add({ severity: 'high', pillar: 'Security', title: 'http:// does not redirect to https://', fix: 'Add a permanent 301 redirect from HTTP to HTTPS at your host/CDN.', impact: '+8 Security' })
  if (!s.hsts) add({ severity: 'medium', pillar: 'Security', title: 'Missing Strict-Transport-Security (HSTS) header', fix: 'Send Strict-Transport-Security: max-age=31536000; includeSubDomains.', impact: '+10 Security' })
  if (!s.csp) add({ severity: 'medium', pillar: 'Security', title: 'Missing Content-Security-Policy header', fix: 'Add a CSP that limits where scripts/styles/images may load from (start in report-only mode).', impact: '+10 Security' })
  if (!s.xfo) add({ severity: 'medium', pillar: 'Security', title: 'No clickjacking protection (X-Frame-Options / frame-ancestors)', fix: 'Send X-Frame-Options: DENY or CSP frame-ancestors \'self\'.', impact: '+6 Security' })
  if (!s.xcto) add({ severity: 'low', pillar: 'Security', title: 'Missing X-Content-Type-Options header', fix: 'Send X-Content-Type-Options: nosniff.', impact: '+4 Security' })
  if (!s.referrer) add({ severity: 'low', pillar: 'Security', title: 'Missing Referrer-Policy header', fix: 'Send Referrer-Policy: strict-origin-when-cross-origin.', impact: '+3 Security' })
  if (!s.permissions) add({ severity: 'low', pillar: 'Security', title: 'Missing Permissions-Policy header', fix: 'Send Permissions-Policy to disable unused features (camera, microphone, geolocation).', impact: '+2 Security' })
  if (mixedTotal) add({ severity: 'high', pillar: 'Security', title: `${mixedTotal} insecure http:// resource(s) loaded on HTTPS pages (mixed content)`, fix: 'Load every image, script and stylesheet over https://.', impact: '+10 Security', pages: mixedPages })
  if (versionLeak) add({ severity: 'low', pillar: 'Security', title: `Server header reveals software version ("${first.server}")`, fix: 'Hide version details (server_tokens off / remove X-Powered-By).', impact: '+2 Security' })
  if (blankNoRel) add({ severity: 'low', pillar: 'Security', title: `${blankNoRel} link(s) use target="_blank" without rel="noopener"`, fix: 'Add rel="noopener noreferrer" to links that open in a new tab.', impact: '+2 Security' })

  // ================= ACCESSIBILITY
  const unlabeled = sum(p => p.unlabeled), emptyAnchors = sum(p => p.emptyAnchors), nameless = sum(p => p.nameless)
  const noLandmarks = list(p => !p.landmarks), skipPages = list(p => p.headingSkips > 0)
  if (unlabeled) add({ severity: 'high', pillar: 'Accessibility', title: `${unlabeled} form field(s) have no label`, fix: 'Associate each input with a <label for>, or add aria-label.', impact: '+8 Accessibility', pages: list(p => p.unlabeled > 0) })
  if (emptyAnchors) add({ severity: 'medium', pillar: 'Accessibility', title: `${emptyAnchors} link(s) have no accessible text`, fix: 'Add visible text or aria-label so screen readers can announce the link.', impact: '+5 Accessibility', pages: list(p => p.emptyAnchors > 0) })
  if (nameless) add({ severity: 'medium', pillar: 'Accessibility', title: `${nameless} button(s) have no accessible name`, fix: 'Give icon-only buttons an aria-label.', impact: '+5 Accessibility', pages: list(p => p.nameless > 0) })
  if (noLandmarks.length) add({ severity: 'medium', pillar: 'Accessibility', title: `${noLandmarks.length} page(s) lack landmarks (<main> plus <nav>/<header>)`, fix: 'Wrap primary content in <main> and use <nav>, <header>, <footer>.', impact: '+5 Accessibility', pages: noLandmarks })
  if (skipPages.length) add({ severity: 'low', pillar: 'Accessibility', title: `${skipPages.length} page(s) skip heading levels (e.g. H2 → H4)`, fix: 'Keep headings in order without skipping levels.', impact: '+3 Accessibility', pages: skipPages })

  // ================= SCORES
  const perfHeur = clamp(100 - Math.max(0, ttfb - 200) / 8 - (uncompressed.length ? 10 : 0) - blocking * 4 - Math.max(0, htmlKb - 100) / 6 - (imgs ? (noDimImgs / imgs) * 8 : 0) - (scriptsAvg > 25 ? 8 : 0) - (imgs > 5 && modernImgs / imgs < 0.3 ? 4 : 0))
  const performance = psi ? clamp(perfHeur * 0.4 + psi.mobile * 0.6) : perfHeur
  const structure = clamp(100 - noH1.length / n * 25 - multiH1.length / n * 8 - badTitle.length / n * 18 - badDesc.length / n * 12 - (100 - altCov) * 0.15 - (hasSchema ? 0 : 10) - noViewport.length / n * 15 - noLang.length / n * 4 - noOg.length / n * 8 - noFavicon.length / n * 3 - noCharset.length / n * 3 - noDoctype.length / n * 3 - titleMismatch.length / n * 3)
  const indexing = clamp(100 - (site.https ? 0 : 25) - (site.robots ? 0 : 10) - (site.robotsBlocksAll ? 40 : 0) - (site.sitemapUrls ? 0 : 20) - (site.soft404 === false ? 5 : 0) - noCanon.length / n * 12 - canonMismatch.length / n * 6 - noindex.length / n * 30 - site.failed.length * 5)
  const content = clamp(40 + Math.min(40, avgWords / 20) - thin.length / n * 30 - (dupTitles / n) * 20 - (dupDescs / n) * 8 - (readability && readability < 30 ? 8 : readability && readability < 45 ? 4 : 0) - (stuffed.length / n) * 8 + 20 * Math.min(1, sum(p => p.h2) / n / 3))
  const security = clamp(100 - (site.https ? 0 : 30) - (site.httpRedirects === false ? 10 : 0) - (s.hsts ? 0 : 15) - (s.csp ? 0 : 15) - (s.xfo ? 0 : 8) - (s.xcto ? 0 : 8) - (s.referrer ? 0 : 4) - (s.permissions ? 0 : 3) - mixedPages.length / n * 20 - (versionLeak ? 3 : 0) - Math.min(5, blankNoRel))
  const accessibility = clamp(100 - Math.min(30, unlabeled * 6) - Math.min(20, (emptyAnchors + nameless) * 3) - noLandmarks.length / n * 15 - (100 - altCov) * 0.2 - noLang.length / n * 8 - skipPages.length / n * 8)
  const score = clamp(performance * 0.2 + content * 0.2 + indexing * 0.2 + structure * 0.15 + security * 0.1 + accessibility * 0.15)

  const ck = (label: string, category: string, ok: boolean, warn = false): Check => ({ label, category, status: ok ? 'pass' : warn ? 'warn' : 'fail' })
  const sev = { high: 0, medium: 1, low: 2 }
  return {
    url: first.url, domain: new URL(first.url).hostname, score, grade: grade(score), pillars: { performance, content, indexing, structure, security, accessibility },
    metrics: { pagesCrawled: n, avgWords, thinPages: thin.length, ttfbMs: ttfb, htmlKb, altCoverage: altCov, internalLinksAvg: avgLinks, sitemapUrls: site.sitemapUrls, readability, textRatio, securityHeaders: secCount, imagesTotal: imgs, scriptsAvg, extLinksAvg: Math.round(sum(p => p.extLinks) / n), mixedContent: mixedTotal, keywords, psi },
    pages: P.map(p => ({ url: p.url, status: p.status, title: p.title, words: p.words, h1: p.h1.length, ms: p.ms, issues: issues.filter(i => i.pages?.includes(p.url)).length })),
    issues: issues.sort((a, b) => sev[a.severity] - sev[b.severity]),
    checklist: [
      ck('HTTPS', 'Indexing', site.https), ck('HTTP → HTTPS redirect', 'Security', site.httpRedirects !== false, site.httpRedirects === null),
      ck('robots.txt found', 'Indexing', !!site.robots), ck('robots.txt not blocking site', 'Indexing', !site.robotsBlocksAll), ck('Sitemap listed in robots.txt', 'Indexing', site.robotsHasSitemap, true),
      ck('sitemap.xml found', 'Indexing', !!site.sitemapUrls), ck('Real 404 for missing pages', 'Indexing', site.soft404 !== false, site.soft404 === null),
      ck('Canonical tags', 'Indexing', !noCanon.length, true), ck('Canonicals self-referencing', 'Indexing', !canonMismatch.length, true), ck('No noindex pages', 'Indexing', !noindex.length), ck('No broken internal links', 'Indexing', !site.failed.length, true),
      ck('Single H1 per page', 'Structure', !noH1.length && !multiH1.length, !noH1.length), ck('Title length 20–65', 'Structure', !badTitle.length, true), ck('Meta description', 'Structure', !badDesc.length, true),
      ck('Open Graph tags', 'Structure', !noOg.length, true), ck('Twitter card', 'Structure', noTwitter.length < n, true), ck('Favicon', 'Structure', !noFavicon.length, true),
      ck('Charset + doctype', 'Structure', !noCharset.length && !noDoctype.length, true), ck('Structured data (JSON-LD)', 'Structure', hasSchema, true), ck('Mobile viewport', 'Structure', !noViewport.length), ck('Clean URLs', 'Structure', !deepUrls.length, true),
      ck('Compression enabled', 'Performance', !uncompressed.length, true), ck('Server response < 600 ms', 'Performance', ttfb <= 600, ttfb <= 1200), ck('No render-blocking scripts', 'Performance', !blocking, blocking < 3),
      ck('Images have width/height', 'Performance', !noDimImgs, true), ck('Lazy-loaded images', 'Performance', imgs <= 6 || lazyImgs > 0, true), ck('Modern image formats', 'Performance', imgs <= 5 || modernImgs / imgs >= 0.3, true),
      ck('No thin content', 'Content', !thin.length, thin.length < n / 2), ck('Unique titles', 'Content', !dupTitles, true), ck('Unique descriptions', 'Content', !dupDescs, true),
      ck('Readable copy (Flesch ≥ 40)', 'Content', !readability || readability >= 40, true), ck('No keyword stuffing', 'Content', !stuffed.length, true),
      ck('HSTS', 'Security', s.hsts, true), ck('Content-Security-Policy', 'Security', s.csp, true), ck('Clickjacking protection', 'Security', s.xfo, true), ck('X-Content-Type-Options', 'Security', s.xcto, true),
      ck('Referrer-Policy', 'Security', s.referrer, true), ck('Permissions-Policy', 'Security', s.permissions, true), ck('No mixed content', 'Security', !mixedTotal), ck('Safe external links (noopener)', 'Security', !blankNoRel, true),
      ck('Image alt coverage ≥ 90%', 'Accessibility', altCov >= 90, altCov >= 70), ck('Labeled form fields', 'Accessibility', !unlabeled), ck('Links & buttons have names', 'Accessibility', !emptyAnchors && !nameless, true),
      ck('Landmarks (main/nav)', 'Accessibility', !noLandmarks.length, true), ck('Heading order', 'Accessibility', !skipPages.length, true), ck('Page language set', 'Accessibility', !noLang.length, true),
    ],
  }
}
