import Link from 'next/link'
import { adminStats } from '@/lib/store'

export const dynamic = 'force-dynamic'
const tone = (g: string) => (g === 'A' || g === 'B' ? 'bg-emerald-50 text-emerald-700' : g === 'C' || g === 'D' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700')

export default async function Overview() {
  const s = await adminStats()
  if (!s) return <p className="card p-6">Database is not connected. Set <code>MONGODB_URI</code>.</p>
  const maxDay = Math.max(1, ...s.daily.map(d => d.n)), totalG = Math.max(1, (Object.values(s.grades) as number[]).reduce((a, b) => a + b, 0))
  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-black">Overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[['Users', s.users], ['Total scans', s.scans], ['Scans (7 days)', s.weekScans], ['Avg score', s.avgScore], ['AI chats', s.chats]].map(([k, v]) => <div key={k as string} className="card p-5"><p className="text-xs text-mute">{k}</p><p className="text-3xl font-black mt-1 tabular-nums">{v}</p></div>)}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2"><h2 className="font-bold mb-4">Scans, last 7 days</h2>
          {s.daily.length ? <div className="flex items-end gap-3 h-36">{s.daily.map(d => <div key={d.day} className="flex-1 flex flex-col items-center gap-1"><span className="text-[10px] text-mute">{d.n}</span><div className="w-full rounded-t-lg bg-indigo-400" style={{ height: `${(d.n / maxDay) * 100}%`, minHeight: 4 }} /><span className="text-[10px] text-mute">{d.day.slice(5)}</span></div>)}</div> : <p className="text-sm text-mute">No scans yet.</p>}
        </div>
        <div className="card p-5"><h2 className="font-bold mb-4">Grades</h2>
          <div className="space-y-2">{['A', 'B', 'C', 'D', 'F'].map(g => <div key={g} className="flex items-center gap-2 text-sm"><span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold ${tone(g)}`}>{g}</span><div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-indigo-400" style={{ width: `${((s.grades[g] || 0) / totalG) * 100}%` }} /></div><span className="w-6 text-right text-mute">{s.grades[g] || 0}</span></div>)}</div>
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2 overflow-x-auto"><div className="flex justify-between mb-3"><h2 className="font-bold">Latest scans</h2><Link href="/admin/scans" className="text-sm text-indigo-700">View all →</Link></div>
          <table className="w-full text-sm"><tbody>{s.recent.map(r => <tr key={r.id} className="border-t border-slate-100"><td className="py-2"><Link href={`/admin/scans/${r.id}`} className="font-medium hover:text-indigo-700">{r.domain}</Link><div className="text-[11px] text-mute">{r.user}</div></td><td className="text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tone(r.grade)}`}>{r.score} · {r.grade}</span></td><td className="text-right text-xs text-mute pl-4">{new Date(r.createdAt).toLocaleString()}</td></tr>)}</tbody></table>
          {!s.recent.length && <p className="text-sm text-mute">No scans yet.</p>}
        </div>
        <div className="card p-5"><h2 className="font-bold mb-3">Most scanned domains</h2>{s.domains.map(d => <div key={d.domain} className="flex justify-between text-sm py-1.5 border-t border-slate-100"><span className="truncate">{d.domain}</span><span className="text-mute">{d.n}× · avg {d.avg}</span></div>)}{!s.domains.length && <p className="text-sm text-mute">No data.</p>}</div>
      </div>
    </div>
  )
}
