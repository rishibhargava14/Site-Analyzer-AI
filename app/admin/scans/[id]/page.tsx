import Link from 'next/link'
import { notFound } from 'next/navigation'
import { adminGetScan } from '@/lib/store'
import { buildTree, TNode } from '@/lib/tree'
import { ScoreGauge } from '@/components/ScoreGauge'
import { DeleteScan } from '@/components/AdminActions'

export const dynamic = 'force-dynamic'
const sevTone = { high: 'bg-rose-50 text-rose-700', medium: 'bg-amber-50 text-amber-700', low: 'bg-emerald-50 text-emerald-700' } as const
const stTone = { pass: 'bg-emerald-50 text-emerald-700', warn: 'bg-amber-50 text-amber-700', fail: 'bg-rose-50 text-rose-700' } as const
const bar = (v: number) => (v >= 80 ? 'bg-emerald-400' : v >= 60 ? 'bg-amber-400' : 'bg-rose-400')

function Tree({ n, root = false }: { n: TNode; root?: boolean }) {
  return (
    <li className="py-0.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{n.children.length ? '📁' : '📄'}</span>
        <span className={n.crawled ? 'font-medium' : 'text-mute'}>{root ? n.name : n.name}</span>
        {n.crawled && <span className={`text-[10px] px-1.5 rounded-full ${n.crawled.status === 200 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{n.crawled.status} · {n.crawled.words}w · {n.crawled.ms}ms</span>}
        {!n.crawled && n.discovered && <span className="text-[10px] px-1.5 rounded-full bg-slate-100 text-mute">linked, not crawled</span>}
        {n.inSitemap && <span className="text-[10px] px-1.5 rounded-full bg-sky-50 text-sky-700">sitemap</span>}
      </div>
      {n.children.length > 0 && <ul>{n.children.map(c => <Tree key={c.path} n={c} />)}</ul>}
    </li>
  )
}

const Sec = ({ title, children, sub }: { title: string; sub?: string; children: React.ReactNode }) => <section className="card p-6"><h2 className="font-bold text-lg">{title}</h2>{sub && <p className="text-xs text-mute mb-4">{sub}</p>}<div className={sub ? '' : 'mt-4'}>{children}</div></section>

export default async function ScanDetail({ params }: { params: { id: string } }) {
  const d = await adminGetScan(params.id); if (!d) notFound()
  const { audit: a, site } = d
  const tree = site ? buildTree(site.origin, site.pages.map(p => ({ url: p.url, status: p.status, words: p.words, ms: p.ms })), site.sitemapList || [], site.pages.flatMap(p => p.internal)) : null
  const cats = [...new Set(a.checklist.map(c => c.category))]
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/admin/scans" className="text-xs text-indigo-700">← All scans</Link><h1 className="text-2xl font-black mt-1">{a.domain}</h1><p className="text-xs text-mute break-all">{a.url} · scanned by {d.user} ({d.userName}) · {new Date(d.createdAt).toLocaleString()}</p></div>
        <DeleteScan id={d.id} redirect="/admin/scans" />
      </div>

      {/* 1 — Summary */}
      <div className="grid md:grid-cols-3 gap-5">
        <div className="card p-6"><ScoreGauge score={a.score} grade={a.grade} /><p className="text-center text-sm mt-3 text-mute">{a.metrics.pagesCrawled} pages crawled</p></div>
        <div className="card p-6 md:col-span-2"><h2 className="font-bold mb-4">Pillar scores</h2>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">{Object.entries(a.pillars).map(([k, v]) => <div key={k}><div className="flex justify-between text-sm capitalize"><span>{k}</span><b>{v}</b></div><div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${bar(v)}`} style={{ width: `${v}%` }} /></div></div>)}</div>
        </div>
      </div>

      {/* 2 — Files & structure */}
      <Sec title="Site files & structure" sub="Folder-style map of every URL found: crawled pages, sitemap entries, and links discovered during the crawl.">
        {tree ? <ul className="tree"><Tree n={tree} root /></ul> : <p className="text-sm text-mute">No structure stored for this older scan. Re-scan to capture it.</p>}
        {site && <div className="grid md:grid-cols-2 gap-5 mt-6">
          <div><h3 className="font-semibold text-sm mb-2">robots.txt {site.robots ? '' : <span className="text-rose-600 font-normal">(not found)</span>}</h3>{site.robots && <pre className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-auto max-h-64 whitespace-pre-wrap">{site.robots.slice(0, 4000)}</pre>}</div>
          <div><h3 className="font-semibold text-sm mb-2">sitemap.xml <span className="text-mute font-normal">({site.sitemapUrls} URLs)</span></h3>{site.sitemapList?.length ? <pre className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-auto max-h-64">{site.sitemapList.join('\n')}</pre> : <p className="text-xs text-rose-600">Missing or empty.</p>}</div>
        </div>}
        {site && <p className="text-xs text-mute mt-4">HTTPS: <b>{site.https ? 'yes' : 'no'}</b> · HTTP→HTTPS redirect: <b>{site.httpRedirects === null ? 'n/a' : site.httpRedirects ? 'yes' : 'no'}</b> · Real 404 page: <b>{site.soft404 === null ? 'unknown' : site.soft404 ? 'yes' : 'no (soft 404)'}</b>{site.failed.length > 0 && <> · Failed: {site.failed.map(f => `${f.url} (${f.status || 'unreachable'})`).join(', ')}</>}</p>}
      </Sec>

      {/* 3 — Per-page content */}
      {site && <Sec title="Page-by-page content" sub="Expand a page to see its metadata, heading outline, keywords, assets and extracted text.">
        <div className="space-y-2">{site.pages.map(p => (
          <details key={p.url} className="border border-slate-200 rounded-xl group">
            <summary className="cursor-pointer p-3 flex flex-wrap items-center gap-2 text-sm"><b className="break-all">{p.title || '(no title)'}</b><span className="text-xs text-mute break-all">{p.url}</span><span className="ml-auto text-xs text-mute">{p.words} words · {p.ms} ms · {(p.bytes / 1024).toFixed(0)} KB</span></summary>
            <div className="p-4 border-t border-slate-100 grid lg:grid-cols-2 gap-5 text-sm">
              <div className="space-y-2">
                <p><span className="text-mute">Description:</span> {p.desc || <i className="text-rose-600">missing</i>}</p>
                <p><span className="text-mute">Canonical:</span> {p.canonical || <i className="text-rose-600">none</i>} · <span className="text-mute">lang:</span> {p.lang || '—'} · <span className="text-mute">Flesch:</span> {p.readability || 'n/a'} · <span className="text-mute">text/HTML:</span> {p.textRatio}%</p>
                <p><span className="text-mute">Schema:</span> {p.schema.join(', ') || 'none'} · <span className="text-mute">Open Graph:</span> {p.og.title && p.og.image ? 'yes' : 'incomplete'} · <span className="text-mute">Twitter:</span> {p.og.twitter ? 'yes' : 'no'}</p>
                <p><span className="text-mute">Links:</span> {p.internal.length} internal, {p.extLinks} external · <span className="text-mute">Images:</span> {p.imgs} ({p.imgNoAlt} no alt) · <span className="text-mute">Scripts:</span> {p.scripts} ({p.blocking} blocking)</p>
                <p><span className="text-mute">Keywords:</span> {p.keywords.map(k => `${k.w} (${k.n})`).join(', ') || '—'}</p>
                <div><p className="text-mute mb-1">Heading outline</p><ul className="text-xs space-y-0.5">{p.outline.map((h, i) => <li key={i} style={{ marginLeft: (h.level - 1) * 14 }}><span className="text-indigo-700 font-mono mr-1">H{h.level}</span>{h.text}</li>)}{!p.outline.length && <li className="text-rose-600">No headings</li>}</ul></div>
              </div>
              <div className="space-y-3">
                {([['Scripts', p.assets.scripts], ['Stylesheets', p.assets.styles], ['Images', p.assets.images]] as const).map(([t, l]) => <details key={t}><summary className="cursor-pointer text-xs font-semibold">{t} ({l.length})</summary><ul className="text-[11px] text-mute break-all mt-1 space-y-0.5 max-h-32 overflow-auto">{l.map(u => <li key={u}>{u}</li>)}</ul></details>)}
                <div><p className="text-xs font-semibold mb-1">Extracted text</p><p className="text-xs text-mute bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-48 overflow-auto">{p.text.slice(0, 1500) || '—'}{p.text.length > 1500 ? '…' : ''}</p></div>
              </div>
            </div>
          </details>))}</div>
      </Sec>}

      {/* 4 — Analysis */}
      <Sec title={`Analysis · ${a.issues.length} issues`} sub="Everything the analyzer flagged, highest severity first.">
        <div className="space-y-3">{a.issues.map((i, k) => (
          <div key={k} className="border border-slate-200 rounded-xl p-4"><div className="flex flex-wrap items-center gap-2"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${sevTone[i.severity]}`}>{i.severity}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-mute">{i.pillar}</span><b className="text-sm">{i.title}</b><span className="ml-auto text-xs text-mute">{i.impact}</span></div>
            <p className="text-sm text-mute mt-1">Fix: {i.fix}</p>
            {i.pages && i.pages.length > 0 && <details className="mt-1"><summary className="text-xs cursor-pointer text-indigo-700">{i.pages.length} affected page(s)</summary><ul className="text-[11px] text-mute break-all mt-1">{i.pages.map(u => <li key={u}>{u}</li>)}</ul></details>}</div>))}
          {!a.issues.length && <p className="text-sm text-emerald-700">No issues found 🎉</p>}</div>
      </Sec>

      <Sec title="Checklist & metrics">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">{cats.map(c => <div key={c}><h3 className="font-semibold text-sm mb-2">{c}</h3><ul className="space-y-1">{a.checklist.filter(x => x.category === c).map(x => <li key={x.label} className="flex items-center justify-between gap-2 text-xs"><span>{x.label}</span><span className={`px-2 py-0.5 rounded-full font-semibold ${stTone[x.status]}`}>{x.status}</span></li>)}</ul></div>)}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 text-xs text-mute">
          {([['Avg words', a.metrics.avgWords], ['Thin pages', a.metrics.thinPages], ['Server response', a.metrics.ttfbMs + ' ms'], ['HTML size', a.metrics.htmlKb + ' KB'], ['Alt coverage', a.metrics.altCoverage + '%'], ['Internal links / page', a.metrics.internalLinksAvg], ['External links / page', a.metrics.extLinksAvg], ['Sitemap URLs', a.metrics.sitemapUrls], ['Readability (Flesch)', a.metrics.readability || 'n/a'], ['Text / HTML', a.metrics.textRatio + '%'], ['Security headers', a.metrics.securityHeaders + '/6'], ['Mixed content', a.metrics.mixedContent], ['Images', a.metrics.imagesTotal], ['Scripts / page', a.metrics.scriptsAvg], ['PageSpeed mobile', a.metrics.psi ? a.metrics.psi.mobile : 'n/a'], ['LCP / CLS', a.metrics.psi ? `${a.metrics.psi.lcp}s / ${a.metrics.psi.cls}` : 'n/a']] as const).map(([k, v]) => <div key={k} className="bg-slate-50 rounded-xl p-3">{k}<b className="block text-ink text-base">{v}</b></div>)}
        </div>
        {a.metrics.keywords?.length > 0 && <p className="text-xs text-mute mt-4">Top keywords: {a.metrics.keywords.map(k => `${k.w} (${k.n})`).join(' · ')}</p>}
      </Sec>

      {/* 5 — AI conversation + knowledge base */}
      <Sec title={`AI conversation · ${d.chats.length} message(s)`}>
        <div className="space-y-3">{d.chats.map((c, i) => <div key={i} className="text-sm"><p className="bg-indigo-50 text-indigo-900 rounded-xl p-3"><b>Q:</b> {c.question}</p><p className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1 whitespace-pre-wrap"><b>A ({c.mode}):</b> {c.answer}</p></div>)}{!d.chats.length && <p className="text-sm text-mute">No questions asked on this scan.</p>}</div>
        <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold">Knowledge base fed to the AI ({d.knowledge.length} chunks)</summary><ul className="mt-2 space-y-1 max-h-96 overflow-auto">{d.knowledge.map(k => <li key={k.id} className="text-[11px] text-mute border-t border-slate-100 pt-1"><b className="text-ink">{k.src}</b> — {k.text.slice(0, 300)}</li>)}</ul></details>
      </Sec>
    </div>
  )
}
