import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const COOKIE = 'sa_session'
export type Session = { uid: string; email: string; name: string; role: 'user' | 'admin' }

function secret() {
  const s = process.env.AUTH_SECRET
  if (!s && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(s || 'dev-only-secret-change-me-please-32chars')
}

export async function signSession(s: Session) {
  return new SignJWT({ ...s }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(secret())
}
export async function readToken(token?: string): Promise<Session | null> {
  if (!token) return null
  try { const { payload } = await jwtVerify(token, secret()); return { uid: String(payload.uid), email: String(payload.email), name: String(payload.name), role: payload.role === 'admin' ? 'admin' : 'user' } } catch { return null }
}
export const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 }

// Server-side helper for route handlers and server components
export async function getSession() { return readToken(cookies().get(COOKIE)?.value) }
