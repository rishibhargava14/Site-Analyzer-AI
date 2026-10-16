import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { Reveal } from '@/components/Reveal'

export const dynamic = 'force-dynamic'

const TICKER = ['Performance', 'Content quality', 'Indexing', 'Structure & meta', 'Security headers', 'Accessibility', 'Open Graph', 'Core Web Vitals', 'Robots & sitemap', 'Mixed content', 'Readability', 'Structured data']
const PILLARS = [
  ['⚡', 'Performance', 'Server response, compression, render-blocking scripts, image sizing & lazy-loading, PageSpeed Core Web Vitals.'],
  ['✍️', 'Content', 'Word count, thin pages, readability, keyword stuffing, duplicate titles & descriptions.'],
  ['🔎', 'Indexing', 'HTTPS, robots.txt, sitemap, canonicals, noindex, broken links and soft-404 detection.'],
  ['🧱', 'Structure', 'H1/H2 hierarchy, title & meta length, Open Graph, schema.org, viewport, favicon.'],
  ['🔒', 'Security', 'HSTS, CSP, clickjacking, nosniff, referrer policy, mixed content and HTTP→HTTPS redirect.'],
  ['♿', 'Accessibility', 'Form labels, link & button names, landmarks, heading order, alt text, page language.'],
]
const STEPS = [['01', 'Paste your URL', 'Any public website. Takes a few seconds.'], ['02', 'We crawl & score', 'Pages, headers, robots and sitemap are analysed across 6 pillars.'], ['03', 'Fix with AI help', 'Get a prioritised fix list and ask the AI consultant anything.']]

export default async function Home() {
  const user = await getSession()
  return (
    <main className="relative bg-pastel min-h-screen overflow-hidden">
      <div className="blob w-[420px] h-[420px] bg-indigo-300 -top-24 -left-24" />
      <div className="blob w-[380px] h-[380px] bg-teal-200 top-40 right-[-100px]" style={{ animationDelay: '-4s' }} />
      <div className="blob w-[320px] h-[320px] bg-indigo-200 top-[900px] left-[20%]" style={{ animationDelay: '-8s' }} />

      <div className="relative max-w-6xl mx-auto px-5">
        <nav className="flex items-center justify-between py-6 fade-up">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-lg"><span className="w-9 h-9 rounded-xl btn grid place-items-center">◎</span>Site Analyzer</Link>
          <div className="hidden md:flex gap-8 text-sm text-mute"><a href="#features" className="hover:text-ink transition">Explore</a><a href="#how" className="hover:text-ink transition">How it works</a></div>
          <div className="flex items-center gap-2 text-sm">
            {user ? <Link href="/analyze" className="btn px-5 py-2 rounded-full">Open analyzer</Link> : <>
              <Link href="/login" className="px-4 py-2 rounded-full text-mute hover:text-ink transition">Sign In</Link>
              <Link href="/signup" className="btn shine px-5 py-2 rounded-full">Join</Link></>}
          </div>
        </nav>

        <section className="grid lg:grid-cols-2 gap-10 items-center pt-10 pb-16">
          <div>
            <p className="fade-up inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 text-mute"><span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" />Live crawler · 60+ checks</p>
            <h1 className="text-5xl md:text-6xl font-black leading-[1.05] mt-5">
              {['Share', 'your', 'URL.'].map((w, i) => <span key={w} className="word mr-3" style={{ animationDelay: `${0.1 + i * 0.12}s` }}>{w}</span>)}<br />
              {['Find', 'what', 'holds', 'it', 'back.'].map((w, i) => <span key={w + i} className="word grad-text mr-3" style={{ animationDelay: `${0.5 + i * 0.12}s` }}>{w}</span>)}
            </h1>
            <p className="fade-up text-mute text-lg mt-6 max-w-lg" style={{ animationDelay: '.9s' }}>A real website audit across performance, content, indexing, structure, security and accessibility — plus an AI consultant that answers from your own pages.</p>
            <div className="fade-up flex flex-wrap gap-3 mt-8" style={{ animationDelay: '1.1s' }}>
              <Link href={user ? '/analyze' : '/signup'} className="btn shine px-7 py-3.5 rounded-xl">{user ? 'Open analyzer →' : 'Join free →'}</Link>
              {!user && <Link href="/login" className="px-7 py-3.5 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition">Sign In</Link>}
            </div>
          </div>
          <div className="relative h-[380px] hidden lg:block">
            <div className="card bob absolute top-4 left-8 p-6 w-72">
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 120 120" className="w-24 h-24 -rotate-90"><circle cx="60" cy="60" r="54" stroke="#d7f3e8" strokeWidth="10" fill="none" /><circle className="ring" cx="60" cy="60" r="54" stroke="#1f8a69" strokeWidth="10" fill="none" strokeLinecap="round" /></svg>
                <div><p className="text-4xl font-black">87</p><p className="text-xs text-mute">Grade B</p></div>
              </div>
              <div className="mt-4 space-y-2 text-[11px] text-mute">
                {[['Performance', 92], ['Security', 74], ['Accessibility', 81]].map(([k, v]) => (
                  <div key={k as string}><div className="flex justify-between"><span>{k}</span><b className="text-ink">{v}</b></div><div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="grow h-full rounded-full bg-indigo-400" style={{ ['--w' as any]: `${v}%` }} /></div></div>
                ))}
              </div>
            </div>
            <div className="card bob2 absolute bottom-6 right-0 p-4 w-64 text-sm"><p className="text-[11px] text-mute mb-1">AI consultant</p><p>Add a CSP header and defer 3 blocking scripts to gain <b>+16</b> points.</p></div>
            <div className="card bob absolute top-0 right-6 px-4 py-2 text-xs flex items-center gap-2" style={{ animationDelay: '-2s' }}><span className="w-2 h-2 rounded-full bg-rose-400" />2 high-severity issues</div>
          </div>
        </section>
      </div>

      <div className="relative border-y border-slate-200 bg-white/60 py-4 overflow-hidden"><div className="marquee tick">{[...TICKER, ...TICKER].map((t, i) => <span key={i} className="mx-6 text-sm text-mute whitespace-nowrap">◎ {t}</span>)}</div></div>

      <div className="relative max-w-6xl mx-auto px-5">
        <section id="how" className="py-20">
          <Reveal><h2 className="text-3xl md:text-4xl font-black text-center">URL → fix list in 3 simple steps</h2></Reveal>
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {STEPS.map(([n, t, d], i) => <Reveal key={n} delay={i * 120}><div className="card lift p-7 h-full"><p className="grad-text text-4xl font-black">{n}</p><h3 className="font-bold text-lg mt-3">{t}</h3><p className="text-mute text-sm mt-2">{d}</p></div></Reveal>)}
          </div>
        </section>

        <section id="features" className="pb-20">
          <Reveal><h2 className="text-3xl md:text-4xl font-black text-center">Six pillars. One honest score.</h2></Reveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {PILLARS.map(([i, t, d], k) => <Reveal key={t} delay={k * 80}><div className="card lift p-6 h-full"><span className="text-2xl">{i}</span><h3 className="font-bold mt-3">{t}</h3><p className="text-mute text-sm mt-2">{d}</p></div></Reveal>)}
          </div>
        </section>

        <Reveal><section className="card p-10 md:p-14 text-center mb-16 relative overflow-hidden">
          <h2 className="text-3xl font-black">Ready to see what your site is missing?</h2>
          <p className="text-mute mt-3">Create a free account and run your first scan in under a minute.</p>
          <Link href={user ? '/analyze' : '/signup'} className="btn shine inline-block px-8 py-3.5 rounded-xl mt-6">{user ? 'Open analyzer →' : 'Join Site Analyzer →'}</Link>
        </section></Reveal>
        <footer className="text-center text-xs text-mute pb-10">© {new Date().getFullYear()} Site Analyzer · Crawler, scoring and AI answers in one place.</footer>
      </div>
    </main>
  )
}
