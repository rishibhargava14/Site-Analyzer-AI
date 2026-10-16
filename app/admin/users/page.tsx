import { getSession } from '@/lib/auth'
import { listUsers } from '@/lib/users'
import { UserActions } from '@/components/AdminActions'

export const dynamic = 'force-dynamic'

export default async function Users() {
  const [me, users] = await Promise.all([getSession(), listUsers()])
  return (
    <div className="max-w-6xl space-y-5">
      <h1 className="text-2xl font-black">Users <span className="text-mute text-base font-normal">({users.length})</span></h1>
      <div className="card overflow-x-auto"><table className="w-full text-sm">
        <thead className="text-left text-xs text-mute"><tr><th className="p-4">User</th><th>Role</th><th>Scans</th><th>Joined</th><th>Last login</th><th /></tr></thead>
        <tbody>{users.map(u => <tr key={u.id} className="border-t border-slate-100"><td className="p-4"><div className="font-medium">{u.name}</div><div className="text-[11px] text-mute">{u.email}</div></td><td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-mute'}`}>{u.role}</span></td><td>{u.scans}</td><td className="text-xs text-mute">{new Date(u.createdAt).toLocaleDateString()}</td><td className="text-xs text-mute">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</td><td className="pr-4"><UserActions id={u.id} role={u.role} self={u.id === me?.uid} /></td></tr>)}</tbody>
      </table></div>
    </div>
  )
}
