import { NextRequest, NextResponse } from 'next/server'
import { verifyLogin } from '@/lib/users'
import { signSession, COOKIE, cookieOpts } from '@/lib/auth'
import { dbRateLimited } from '@/lib/store'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'local'
  if ((await dbRateLimited(ip, 8, 'auth')) === true) return NextResponse.json({ error: 'Too many attempts. Wait a minute.' }, { status: 429 })
  const { email = '', password = '' } = await req.json().catch(() => ({}))
  const r = await verifyLogin(String(email), String(password))
  if (!r.session) return NextResponse.json({ error: r.error }, { status: 401 })
  const res = NextResponse.json({ user: r.session })
  res.cookies.set(COOKIE, await signSession(r.session), cookieOpts)
  return res
}
