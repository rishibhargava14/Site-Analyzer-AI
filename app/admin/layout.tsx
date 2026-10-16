import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { UserMenu } from '@/components/UserMenu'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Admin · Site Analyzer' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession()
  if (!s) redirect('/login?next=/admin')
  if (s.role !== 'admin') redirect('/analyze')
  const links = [['/admin', '▦', 'Overview'], ['/admin/scans', '🗂', 'Scans'], ['/admin/users', '👥', 'Users'], ['/analyze', '◎', 'Open analyzer']]
  return (
    <div className="min-h-screen bg-pastel md:flex">
      <aside className="md:w-60 md:min-h-screen p-5 border-b md:border-b-0 md:border-r border-slate-200 bg-white/70 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 font-extrabold mb-8"><span className="w-9 h-9 rounded-xl btn grid place-items-center">◎</span>Admin</Link>
        <nav className="flex md:flex-col gap-1 text-sm overflow-x-auto">{links.map(([h, i, t]) => <Link key={h} href={h} className="px-3 py-2 rounded-xl text-mute hover:bg-indigo-50 hover:text-indigo-700 transition whitespace-nowrap"><span className="mr-2">{i}</span>{t}</Link>)}</nav>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="flex justify-end p-4 border-b border-slate-200 bg-white/50"><UserMenu /></header>
        <div className="p-5 md:p-8 fade-up">{children}</div>
      </div>
    </div>
  )
}
