import { NextResponse } from 'next/server'
import { listAudits } from '@/lib/store'
import { dbEnabled } from '@/lib/db'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/history -> the signed-in user's latest 20 scans
export async function GET() {
  const user = await getSession(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ enabled: dbEnabled(), items: await listAudits(user, 20) })
}
