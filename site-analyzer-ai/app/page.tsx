'use client'
import { useEffect, useRef, useState } from 'react'
import { ScoreGauge } from '@/components/ScoreGauge'
import { AiPanel } from '@/components/AiPanel'
import type { Audit } from '@/lib/analyzer'

const SEV = { high: 'bg-rose-400', medium: 'bg-amber-400', low: 'bg-emerald-400' }
const ST = { pass: 'bg-emerald-50 text-emerald-700', warn: 'bg-amber-50 text-amber-700', fail: 'bg-rose-50 text-rose-700' }
const bar = (v: number) => (v >= 80 ? 'bg-emerald-400' : v >= 60 ? 'bg-amber-400' : 'bg-rose-400')

const EXAMPLES = [
  { label: 'Wikipedia', url: 'https://en.wikipedia.org' },
  { label: 'GitHub', url: 'https://github.com' },
  { label: 'Vercel', url: 'https://vercel.com' },
  { label: 'MDN', url: 'https://developer.mozilla.org' },
]

const LOAD_STEPS = [
  { t: 'Resolving domain & checking robots.txt', d: 0 },
  { t: 'Crawling pages & reading sitemap', d: 900 },
  { t: 'Scoring structure, content & indexing', d: 2200 },
  { t: 'Building knowledge base for AI answers', d: 3400 },
]

function useInView() {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setOn(true); o.disconnect() }
    }, { threshold: 0.15 })
    ref.current && o.observe(ref.current)
    return () => o.disconnect()
  }, [])
  return [ref, on] as const
}

function Reveal({ children, d = 0, className = '' }: { children: React.ReactNode; d?: number; className?: string }) {
  const [ref, on] = useInView()
  return (
    <div ref={ref} style={{ transitionDelay: `${d}ms` }} className={`reveal ${on ? 'in' : ''} ${className}`}>
      {children}
    </div>
  )
}

function Count({ to, suffix = '', delay = 0 }: { to: number; suffix?: string; delay?: number }) {
  const [ref, on] = useInView()
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!on) return
    const t0 = performance.now() + delay
    let r = 0
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - t0) / 1600))
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) r = requestAnimationFrame(tick)
    }
    r = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(r)
  }, [on, to, delay])
  return <span ref={ref as any}>{v}{suffix}</span>
}

const CHECKS = ['robots.txt', 'sitemap.xml', 'H1 headings', 'Title tags', 'Meta descriptions', 'Image alt text', 'Canonical URLs', 'Structured data', 'HTTPS', 'Mobile viewport', 'Thin content', 'Duplicate titles', 'Server speed', 'Broken links', 'noindex tags']
const STEPS = [
  { n: '01', e: '→', t: 'Paste your link', d: 'Type any public website address. No sign-up, no install, nothing to configure.' },
  { n: '02', e: '◎', t: 'We explore your site', d: 'A crawler visits your pages like a search engine would, reading headings, titles, images, links, robots.txt and your sitemap.' },
  { n: '03', e: '◑', t: 'Everything gets scored', d: 'Speed, content, indexing and structure each get a 0–100 score, combined into one clear grade from A to F.' },
  { n: '04', e: '✓', t: 'Fix it, step by step', d: 'You get a prioritized to-do list with the exact fix for every problem, plus a chat that answers questions about your own pages.' },
]
const FEATS = [
  { e: '✚', c: 'bg-indigo-50 text-indigo-600', t: 'Full health check', d: '14 checks across SEO, speed, indexing and page structure in a single scan.' },
  { e: '◎', c: 'bg-teal-50 text-teal-600', t: 'Prioritized fixes', d: 'Issues are ranked high, medium and low, each with the fix and how many points it should win back.' },
  { e: '“”', c: 'bg-sky-50 text-sky-600', t: 'Instant answers', d: 'Ask “why is my score low?” and get a short, specific answer drawn from your own crawl.' },
  { e: '☰', c: 'bg-amber-50 text-amber-600', t: 'Page-by-page view', d: 'See word count, headings and response time for every page it visited.' },
  { e: '◆', c: 'bg-indigo-50 text-indigo-600', t: 'Safe by design', d: 'Private and internal addresses are blocked, and scans are rate-limited to keep things fair.' },
  { e: '↯', c: 'bg-teal-50 text-teal-600', t: 'Fast & cached', d: 'Most scans finish in seconds, and repeat scans of the same site return instantly.' },
]
const STACK = ['Next.js 14', 'TypeScript', 'Tailwind CSS', 'Cheerio crawler', 'Streaming answers', 'Docker-ready']

export default function Page() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<{ audit: Audit; knowledge: any[] } | null>(null)
  const [tab, setTab] = useState<'issues' | 'checklist' | 'pages'>('issues')
  const [dark, setDark] = useState(false)
  const [loadStep, setLoadStep] = useState(0)
  const [copied, setCopied] = useState(false)
  const out = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Dark mode init + persist
  useEffect(() => {
    const saved = localStorage.getItem('sa-theme')
    const preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = saved === 'dark' || (!saved && preferDark)
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  function toggleDark() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('sa-theme', next ? 'dark' : 'light')
  }

  // Progress steps during loading
  useEffect(() => {
    if (!loading) {
      timers.current.forEach(clearTimeout)
      timers.current = []
      setLoadStep(0)
      return
    }
    setLoadStep(0)
    LOAD_STEPS.forEach((s, i) => {
      const id = setTimeout(() => setLoadStep(i), s.d)
      timers.current.push(id)
    })
    return () => timers.current.forEach(clearTimeout)
  }, [loading])

  async function run(u = url) {
    if (!u.trim()) return
    setLoading(true)
    setErr('')
    setRes(null)
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: u }),
      })
      const j = await r.json()
      setLoading(false)
      if (r.ok) {
        setRes(j)
        setTimeout(() => out.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      } else {
        setErr(j.error || 'Something went wrong. Try again.')
      }
    } catch {
      setLoading(false)
      setErr('Network error. Check your connection and try again.')
    }
  }

  function exportJson() {
    if (!res) return
    const blob = new Blob([JSON.stringify(res.audit, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `site-report-${res.audit.domain.replace(/\./g, '-')}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function copyReport() {
    if (!res) return
    const a = res.audit
    const lines = [
      `Site Analyzer Report — ${a.domain}`,
      `Score: ${a.score}/100 (Grade ${a.grade})`,
      `Pages crawled: ${a.metrics.pagesCrawled}`,
      '',
      'Pillars:',
      ...Object.entries(a.pillars).map(([k, v]) => `  ${k}: ${v}`),
      '',
      `Issues (${a.issues.length}):`,
      ...a.issues.map(i => `  [${i.severity.toUpperCase()}] ${i.title}\n    Fix: ${i.fix} (${i.impact})`),
    ]
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const a = res?.audit

  return (
    <main id="top" className="relative bg-pastel min-h-screen overflow-hidden">
      <div className="blob w-[420px] h-[420px] bg-indigo-300 -top-24 -left-24" />
      <div className="blob w-[380px] h-[380px] bg-sky-200 top-40 right-[-100px]" style={{ animationDelay: '-4s' }} />
      <div className="blob w-[340px] h-[340px] bg-teal-200 top-[620px] left-[30%]" style={{ animationDelay: '-8s' }} />
      <div className="blob w-[300px] h-[300px] bg-indigo-200 top-[1100px] right-[10%]" style={{ animationDelay: '-2s' }} />

      <div className="relative max-w-6xl mx-auto px-5">
        {/* NAV */}
        <nav className="flex items-center justify-between py-6 fade-up">
          <div className="flex items-center gap-2 font-extrabold text-lg">
            <span className="w-9 h-9 rounded-xl btn grid place-items-center text-base">◎</span>
            Site Analyzer
          </div>
          <div className="flex items-center gap-5">
            <div className="hidden sm:flex gap-7 text-sm text-mute">
              <a href="#how" className="hover:text-ink transition">How it works</a>
              <a href="#features" className="hover:text-ink transition">Features</a>
              <a href="#about" className="hover:text-ink transition">The project</a>
            </div>
            <button
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white grid place-items-center text-lg hover:border-indigo-300 transition"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </nav>

        {/* HERO */}
        <section className="grid lg:grid-cols-2 gap-10 items-center pt-8 pb-16">
          <div>
            <span
              className="fade-up inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 text-mute"
              style={{ animationDelay: '.1s' }}
            >
              <i className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />
              Free website health check
            </span>
            <h1
              className="fade-up text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mt-5"
              style={{ animationDelay: '.2s' }}
            >
              Find out why your website <span className="grad-text">isn’t getting found.</span>
            </h1>
            <p className="fade-up text-lg text-mute mt-5 max-w-lg" style={{ animationDelay: '.35s' }}>
              Paste your link and get a clear score, a list of what’s holding you back, and simple fixes you can act on today.
            </p>

            {/* Input */}
            <div className="fade-up card p-2.5 mt-8 max-w-xl" style={{ animationDelay: '.5s' }}>
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && run()}
                  placeholder="https://your-website.com"
                  className="flex-1 bg-slate-50 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-indigo-300 placeholder:text-mute/60"
                  disabled={loading}
                />
                <button onClick={() => run()} disabled={loading || !url.trim()} className="btn px-7 rounded-xl">
                  {loading ? 'Scanning…' : 'Analyze →'}
                </button>
              </div>
            </div>

            {/* Example URLs */}
            <div className="fade-up flex flex-wrap items-center gap-2 mt-3" style={{ animationDelay: '.6s' }}>
              <span className="text-xs text-mute mr-1">Try:</span>
              {EXAMPLES.map(ex => (
                <button
                  key={ex.url}
                  onClick={() => { setUrl(ex.url); run(ex.url) }}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 text-mute hover:text-indigo-700 hover:border-indigo-300 transition disabled:opacity-50"
                >
                  {ex.label}
                </button>
              ))}
            </div>

            {err && <p className="text-rose-500 text-sm mt-3">⚠ {err}</p>}
            <p className="fade-up text-xs text-mute mt-4" style={{ animationDelay: '.65s' }}>
              ✓ No sign-up &nbsp; ✓ Results in seconds &nbsp; ✓ Works on any public site
            </p>
          </div>

          {/* Animated preview */}
          <div className="relative h-[430px] hidden lg:block fade-up" style={{ animationDelay: '.4s' }}>
            <div className="card absolute inset-x-6 top-6 p-6 bob">
              <div className="flex items-center gap-5">
                <div className="relative w-28 h-28 shrink-0">
                  <svg viewBox="0 0 120 120" className="-rotate-90">
                    <circle cx="60" cy="60" r="54" stroke="#ece8fb" strokeWidth="10" fill="none" />
                    <circle className="ring" cx="60" cy="60" r="54" stroke="url(#g)" strokeWidth="10" fill="none" strokeLinecap="round" />
                    <defs>
                      <linearGradient id="g">
                        <stop offset="0" stopColor="#4f46e5" />
                        <stop offset="1" stopColor="#14b8a6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 grid place-items-center text-3xl font-black">
                    <Count to={87} delay={600} />
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  {[['Speed', 92, '#14b8a6'], ['Content', 81, '#6366f1'], ['Indexing', 88, '#2dd4bf'], ['Structure', 76, '#818cf8']].map(([k, v, c]: any, i) => (
                    <div key={k}>
                      <div className="flex justify-between text-xs text-mute mb-1">
                        <span>{k}</span><span>{v}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="grow h-full rounded-full" style={{ ['--w' as any]: `${v}%`, background: c, animationDelay: `${0.8 + i * 0.15}s` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {[
              ['✓ Title tag looks great', 'left-0 top-[210px]', 'bg-white border border-emerald-200 text-emerald-700', 1.4, 'bob2'],
              ['⚠ 3 images need alt text', 'right-0 top-[260px]', 'bg-white border border-amber-200 text-amber-700', 1.8, 'bob'],
              ['✓ Sitemap found', 'left-10 top-[330px]', 'bg-white border border-sky-200 text-sky-700', 2.2, 'bob'],
              ['✕ Missing H1 on /about', 'right-6 top-[375px]', 'bg-white border border-rose-200 text-rose-700', 2.6, 'bob2'],
            ].map(([t, pos, cl, d, b]: any) => (
              <div key={t} className={`absolute ${pos} ${b}`}>
                <div className={`pop px-4 py-2.5 rounded-xl text-sm font-medium shadow-md ${cl}`} style={{ animationDelay: `${d}s` }}>
                  {t}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BETTER LOADING STATE */}
        {loading && (
          <div className="card p-8 mb-10 fade-up">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl btn grid place-items-center text-xl animate-spin">◎</div>
              <div>
                <p className="font-bold text-lg">Scanning your website…</p>
                <p className="text-sm text-mute">This usually takes 3–8 seconds</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-6">
              <div className="h-full rounded-full bg-indigo-500 progress-bar" />
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {LOAD_STEPS.map((s, i) => (
                <div
                  key={s.t}
                  className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                    i <= loadStep ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                      i < loadStep
                        ? 'bg-emerald-500 text-white'
                        : i === loadStep
                        ? 'bg-indigo-500 text-white animate-pulse'
                        : 'bg-slate-200 text-mute'
                    }`}
                  >
                    {i < loadStep ? '✓' : i + 1}
                  </span>
                  <span className={i === loadStep ? 'font-medium' : ''}>{s.t}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESULTS */}
        {a && res && (
          <section ref={out} className="pb-20 scroll-mt-6 fade-up">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <h2 className="text-2xl font-extrabold">
                Your report for <span className="grad-text">{a.domain}</span>
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={copyReport}
                  className="text-sm px-4 py-2 rounded-xl bg-white border border-slate-200 text-mute hover:text-indigo-700 hover:border-indigo-300 transition flex items-center gap-1.5"
                >
                  {copied ? '✓ Copied!' : '📋 Copy report'}
                </button>
                <button
                  onClick={exportJson}
                  className="text-sm px-4 py-2 rounded-xl bg-white border border-slate-200 text-mute hover:text-indigo-700 hover:border-indigo-300 transition flex items-center gap-1.5"
                >
                  ⬇ Export JSON
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5 mb-5">
              <div className="card p-6">
                <ScoreGauge score={a.score} grade={a.grade} />
                <p className="text-center text-sm mt-3 text-mute">{a.metrics.pagesCrawled} pages explored</p>
              </div>
              <div className="md:col-span-2 card p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(a.pillars).map(([k, v]) => (
                    <div key={k} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-[11px] uppercase tracking-wider text-mute">{k}</p>
                      <p className="text-3xl font-black mt-1">{v}</p>
                      <div className="h-1.5 bg-slate-100 rounded mt-2">
                        <div className={`h-full rounded ${bar(v)}`} style={{ width: `${v}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs text-mute">
                  <div>Server response <b className="text-ink">{a.metrics.ttfbMs}ms</b></div>
                  <div>Avg words <b className="text-ink">{a.metrics.avgWords}</b></div>
                  <div>Alt coverage <b className="text-ink">{a.metrics.altCoverage}%</b></div>
                  <div>
                    {a.metrics.psi ? (
                      <>Mobile speed <b className="text-ink">{a.metrics.psi.mobile}</b></>
                    ) : (
                      <>Sitemap URLs <b className="text-ink">{a.metrics.sitemapUrls}</b></>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3">
                <div className="flex gap-2 mb-4">
                  {(['issues', 'checklist', 'pages'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-4 py-1.5 rounded-full text-sm capitalize transition ${
                        tab === t ? 'btn' : 'bg-white border border-slate-200 text-mute hover:text-ink'
                      }`}
                    >
                      {t}{t === 'issues' ? ` (${a.issues.length})` : ''}
                    </button>
                  ))}
                </div>
                <div className="card p-4 space-y-2 max-h-[500px] overflow-y-auto">
                  {tab === 'issues' &&
                    (a.issues.length ? (
                      a.issues.map((i, k) => (
                        <div key={k} className="flex gap-3 p-3 rounded-xl bg-slate-50">
                          <span className={`h-2.5 w-2.5 mt-1.5 rounded-full shrink-0 ${SEV[i.severity]}`} />
                          <div>
                            <p className="text-sm font-semibold">{i.title}</p>
                            <p className="text-xs text-mute mt-1">{i.fix}</p>
                            <p className="text-[11px] mt-1 text-indigo-600">{i.pillar} · {i.impact}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-emerald-600 text-sm p-3">🎉 No issues found.</p>
                    ))}
                  {tab === 'checklist' &&
                    a.checklist.map((c, k) => (
                      <div key={k} className="flex justify-between text-sm p-2.5 rounded-lg bg-slate-50">
                        <span>
                          {c.label} <span className="text-mute text-xs">· {c.category}</span>
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ST[c.status]}`}>{c.status}</span>
                      </div>
                    ))}
                  {tab === 'pages' &&
                    a.pages.map((p, k) => (
                      <div key={k} className="p-3 rounded-lg bg-slate-50 text-sm">
                        <p className="truncate text-indigo-600">{p.url}</p>
                        <p className="text-xs text-mute truncate">{p.title || '— no title —'}</p>
                        <p className="text-[11px] text-mute mt-1">
                          {p.words} words · H1 ×{p.h1} · {p.ms}ms · {p.status}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
              <div className="lg:col-span-2">
                <AiPanel key={a.url} knowledge={res.knowledge} autoAsk="Give me a prioritized 5-step improvement plan for this site." />
              </div>
            </div>
          </section>
        )}

        {/* STATS */}
        <Reveal className="card grid grid-cols-2 md:grid-cols-4 gap-6 p-8 text-center mb-16">
          {[
            [14, '', 'health checks per scan'],
            [4, '', 'score areas, A to F'],
            [8, '', 'pages explored each time'],
            [3, 's', 'typical scan time'],
          ].map(([n, s, l]: any, i) => (
            <div key={l}>
              <p className="text-4xl font-black grad-text">
                <Count to={n} suffix={s} delay={i * 150} />
              </p>
              <p className="text-sm text-mute mt-1">{l}</p>
            </div>
          ))}
        </Reveal>

        {/* MARQUEE */}
        <Reveal className="mb-20 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <p className="text-center text-sm text-mute mb-4">Everything we look at on your website</p>
          <div className="marquee">
            {[...CHECKS, ...CHECKS].map((c, i) => (
              <span key={i} className="mx-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 text-sm font-medium text-slate-700 whitespace-nowrap">
                <i className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2 align-middle" />
                {c}
              </span>
            ))}
          </div>
        </Reveal>

        {/* HOW */}
        <section id="how" className="scroll-mt-6 mb-24">
          <Reveal className="text-center mb-12">
            <p className="text-sm font-semibold text-indigo-600">HOW IT WORKS</p>
            <h2 className="text-4xl font-black mt-2">From link to action plan in four steps</h2>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} d={i * 120}>
                <div className="card p-6 h-full lift relative">
                  <span className="absolute top-4 right-5 text-5xl font-black text-slate-100">{s.n}</span>
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center text-xl font-bold">{s.e}</div>
                  <h3 className="font-bold text-lg mt-5">{s.t}</h3>
                  <p className="text-sm text-mute mt-2 leading-relaxed">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="scroll-mt-6 mb-24">
          <Reveal className="text-center mb-12">
            <p className="text-sm font-semibold text-teal-600">WHAT YOU GET</p>
            <h2 className="text-4xl font-black mt-2">Everything you need to fix your site</h2>
          </Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATS.map((f, i) => (
              <Reveal key={f.t} d={(i % 3) * 120}>
                <div className="card p-7 h-full lift">
                  <div className={`w-11 h-11 rounded-xl grid place-items-center text-lg font-bold ${f.c}`}>{f.e}</div>
                  <h3 className="font-bold text-lg mt-4">{f.t}</h3>
                  <p className="text-sm text-mute mt-2 leading-relaxed">{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="scroll-mt-6 mb-20">
          <Reveal>
            <div className="card p-8 md:p-12 grid md:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-sm font-semibold text-indigo-600">ABOUT THE PROJECT</p>
                <h2 className="text-3xl font-black mt-2">A real audit, not a made-up score</h2>
                <p className="text-mute mt-4 leading-relaxed">
                  Site Analyzer visits your pages the way a search engine does and measures what it actually finds — your headings, titles, images, links, speed and sitemap. Nothing is guessed or randomised.
                </p>
                <p className="text-mute mt-3 leading-relaxed">
                  It then turns those findings into a plain-English report and keeps them handy, so you can ask follow-up questions and get short answers that point to the exact pages involved.
                </p>
                <div className="flex flex-wrap gap-2 mt-6">
                  {STACK.map(s => (
                    <span key={s} className="text-xs px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">{s}</span>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  ['Crawl', 'Reads up to 8 pages plus robots.txt and sitemap.xml', 'bg-slate-50'],
                  ['Score', 'Weighs speed, content, indexing and structure equally', 'bg-slate-100'],
                  ['Explain', 'Ranks problems and writes the fix for each one', 'bg-slate-50'],
                  ['Answer', 'Replies to your questions using only your own pages', 'bg-slate-50'],
                ].map(([t, d, c], i) => (
                  <div key={t} className={`flex items-center gap-4 p-4 rounded-xl border border-slate-200 ${c} lift`}>
                    <span className="w-9 h-9 rounded-full bg-indigo-600 text-white grid place-items-center font-bold text-sm">{i + 1}</span>
                    <div>
                      <p className="font-bold text-sm">{t}</p>
                      <p className="text-xs text-mute">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        <Reveal className="text-center pb-16">
          <h2 className="text-3xl font-black">Ready to see how your site scores?</h2>
          <a
            href="#top"
            onClick={e => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="btn inline-block mt-6 px-8 py-3.5 rounded-xl"
          >
            Analyze my website ↑
          </a>
          <p className="text-xs text-mute mt-10">© Site Analyzer · built with Next.js</p>
        </Reveal>
      </div>
    </main>
  )
}
