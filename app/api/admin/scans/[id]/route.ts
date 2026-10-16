import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { adminGetScan, deleteAudit } from '@/lib/store'

export const dynamic = 'force-dynamic'
export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const d = await adminGetScan(params.id)
  return d ? NextResponse.json(d) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const a = await requireAdmin(); if (!a) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return (await deleteAudit(params.id, a)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}
