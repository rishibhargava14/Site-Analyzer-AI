'use client'
import { useEffect, useState } from 'react'
type U = { name: string; email: string; role: 'user' | 'admin' }
export function UserMenu() {
  const [u, setU] = useState<U | null>(null)
  useEffect(() => { fetch('/api/auth/me').then(r => r.json()).then(j => setU(j.user)).catch(() => {}) }, [])
  async function out() { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/' }
  if (!u) return null
  return (
    <div className="flex items-center gap-2 text-sm">
      {u.role === 'admin' && <a href="/admin" className="px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100 transition">Admin</a>}
      <span className="hidden md:inline text-mute" title={u.email}>{u.name}</span>
      <button onClick={out} className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-mute hover:text-ink transition">Sign out</button>
    </div>
  )
}
