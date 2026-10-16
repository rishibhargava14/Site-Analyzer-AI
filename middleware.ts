import { NextRequest, NextResponse } from 'next/server'
import { readToken, COOKIE } from '@/lib/auth'

// Gate: /analyze and /admin need a session; /admin and /api/admin need role=admin.
// (API handlers re-check the session themselves; this just redirects early.)
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const s = await readToken(req.cookies.get(COOKIE)?.value)
  const isApi = pathname.startsWith('/api/')

  if (!s) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }
  if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && s.role !== 'admin') {
    if (isApi) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const url = req.nextUrl.clone(); url.pathname = '/analyze'; url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}
export const config = { matcher: ['/analyze/:path*', '/admin/:path*', '/api/analyze', '/api/chat', '/api/history/:path*', '/api/admin/:path*'] }
