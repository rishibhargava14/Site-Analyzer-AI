import { NextResponse } from 'next/server'
import { getAudit, deleteAudit } from '@/lib/store'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = await getSession(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const d = await getAudit(params.id, user)
  return d ? NextResponse.json(d) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const user = await getSession(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return (await deleteAudit(params.id, user)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}
