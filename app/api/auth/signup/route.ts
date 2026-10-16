import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/users'
import { signSession, COOKIE, cookieOpts } from '@/lib/auth'
import { dbRateLimited } from '@/lib/store'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'local'
  if ((await dbRateLimited(ip, 5, 'auth')) === true) return NextResponse.json({ error: 'Too many attempts. Wait a minute.' }, { status: 429 })
  const { name = '', email = '', password = '' } = await req.json().catch(() => ({}))
  const r = await createUser(String(email), String(name), String(password))
  if (!r.session) return NextResponse.json({ error: r.error }, { status: 400 })
  const res = NextResponse.json({ user: r.session })
  res.cookies.set(COOKIE, await signSession(r.session), cookieOpts)
  return res
}
