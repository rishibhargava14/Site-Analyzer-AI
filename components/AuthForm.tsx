'use client'
import { useState } from 'react'
import Link from 'next/link'

export function AuthForm({ mode, next }: { mode: 'login' | 'signup'; next: string }) {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [show, setShow] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const signup = mode === 'signup'

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email, password }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Something went wrong. Try again.'); setBusy(false); return }
      window.location.href = next // full reload so the new session cookie is used everywhere
    } catch { setErr('Network error. Check your connection.'); setBusy(false) }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-pastel relative overflow-hidden">
      <div className="blob w-[420px] h-[420px] bg-indigo-300 -top-24 -left-24" />
      <div className="blob w-[320px] h-[320px] bg-teal-200 bottom-[-80px] right-[8%]" style={{ animationDelay: '-6s' }} />

      <aside className="hidden lg:flex flex-col justify-between p-12 relative">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-lg"><span className="w-9 h-9 rounded-xl btn grid place-items-center">◎</span>Site Analyzer</Link>
        <div>
          <h2 className="fade-up text-4xl font-black leading-tight">Paste a URL.<br /><span className="grad-text">Get the fix list.</span></h2>
          <ul className="mt-8 space-y-4 text-mute">
            {['60+ checks across 6 pillars', 'AI consultant that answers from your own pages', 'Every scan saved to your history'].map((t, i) => (
              <li key={t} className="pop flex items-center gap-3" style={{ animationDelay: `${0.4 + i * 0.2}s` }}><span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center text-xs">✓</span>{t}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-mute flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot" /> Live crawler online</p>
      </aside>

      <main className="flex items-center justify-center p-6 relative">
        <form onSubmit={submit} className="card w-full max-w-md p-8 fade-up">
          <Link href="/" className="lg:hidden flex items-center gap-2 font-extrabold mb-6"><span className="w-8 h-8 rounded-lg btn grid place-items-center text-sm">◎</span>Site Analyzer</Link>
          <h1 className="text-2xl font-black">{signup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="text-sm text-mute mt-1 mb-6">{signup ? 'Join to scan sites and keep your reports.' : 'Sign in to continue to your dashboard.'}</p>

          {signup && <label className="block mb-3 text-sm font-medium">Name<input className="input mt-1" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required minLength={2} placeholder="Your name" /></label>}
          <label className="block mb-3 text-sm font-medium">Email<input className="input mt-1" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" /></label>
          <label className="block mb-1 text-sm font-medium">Password
            <div className="relative mt-1">
              <input className="input pr-16" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 8 : 1} placeholder={signup ? 'At least 8 characters' : 'Your password'} />
              <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mute hover:text-ink">{show ? 'Hide' : 'Show'}</button>
            </div>
          </label>
          {err && <p className="text-rose-500 text-sm mt-3" role="alert">⚠ {err}</p>}
          <button disabled={busy} className="btn shine w-full rounded-xl py-3 mt-5 text-sm">{busy ? 'Please wait…' : signup ? 'Create account →' : 'Sign in →'}</button>
          <p className="text-sm text-mute text-center mt-5">
            {signup ? <>Already have an account? <Link className="text-indigo-700 font-semibold" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></> : <>New here? <Link className="text-indigo-700 font-semibold" href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></>}
          </p>
        </form>
      </main>
    </div>
  )
}
