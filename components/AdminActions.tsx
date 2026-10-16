'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

async function call(url: string, method: string, body?: any) {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  if (!r.ok) alert((await r.json().catch(() => ({}))).error || 'Request failed')
  return r.ok
}

export function DeleteScan({ id, redirect }: { id: string; redirect?: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false)
  return <button disabled={busy} onClick={async () => { if (!confirm('Delete this scan and its chat history?')) return; setBusy(true); if (await call(`/api/admin/scans/${id}`, 'DELETE')) { redirect ? router.push(redirect) : router.refresh() } setBusy(false) }} className="text-xs px-3 py-1.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 transition">Delete</button>
}

export function UserActions({ id, role, self }: { id: string; role: 'user' | 'admin'; self: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false)
  if (self) return <span className="text-xs text-mute">You</span>
  return (
    <div className="flex gap-2 justify-end">
      <button disabled={busy} onClick={async () => { setBusy(true); if (await call(`/api/admin/users/${id}`, 'PATCH', { role: role === 'admin' ? 'user' : 'admin' })) router.refresh(); setBusy(false) }} className="text-xs px-3 py-1.5 rounded-full border border-slate-200 hover:border-indigo-300 transition">{role === 'admin' ? 'Make user' : 'Make admin'}</button>
      <button disabled={busy} onClick={async () => { if (!confirm('Delete this user and all their scans?')) return; setBusy(true); if (await call(`/api/admin/users/${id}`, 'DELETE')) router.refresh(); setBusy(false) }} className="text-xs px-3 py-1.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 transition">Delete</button>
    </div>
  )
}
