import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { deleteUser, setRole } from '@/lib/users'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireAdmin(); if (!a) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (params.id === a.uid) return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 400 })
  const { role } = await req.json().catch(() => ({}))
  if (role !== 'user' && role !== 'admin') return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  return (await setRole(params.id, role)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const a = await requireAdmin(); if (!a) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (params.id === a.uid) return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
  return (await deleteUser(params.id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}
