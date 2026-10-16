import Link from 'next/link'
import { adminListScans } from '@/lib/store'

export const dynamic = 'force-dynamic'
const tone = (g: string) => (g === 'A' || g === 'B' ? 'bg-emerald-50 text-emerald-700' : g === 'C' || g === 'D' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700')

export default async function Scans({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q || '').slice(0, 80); const rows = await adminListScans(q)
  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-black">All scans <span className="text-mute text-base font-normal">({rows.length})</span></h1>
        <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Search domain or user…" className="input !w-64" /><button className="btn px-5 rounded-xl text-sm">Search</button></form></div>
      <div className="card overflow-x-auto"><table className="w-full text-sm">
        <thead className="text-left text-xs text-mute"><tr><th className="p-4">Site</th><th>Score</th><th>Issues</th><th>Scanned by</th><th>Date</th><th /></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id} className="border-t border-slate-100 hover:bg-indigo-50/40 transition"><td className="p-4"><Link href={`/admin/scans/${r.id}`} className="font-medium hover:text-indigo-700">{r.domain}</Link><div className="text-[11px] text-mute truncate max-w-xs">{r.url}</div></td><td><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tone(r.grade)}`}>{r.score} · {r.grade}</span></td><td>{r.issues}</td><td className="text-mute">{r.user}</td><td className="text-mute text-xs">{new Date(r.createdAt).toLocaleString()}</td><td className="pr-4 text-right"><Link href={`/admin/scans/${r.id}`} className="text-indigo-700 text-xs">Open →</Link></td></tr>)}</tbody>
      </table>{!rows.length && <p className="p-6 text-sm text-mute">No scans found.</p>}</div>
    </div>
  )
}
