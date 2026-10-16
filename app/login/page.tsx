import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/AuthForm'
import { getSession } from '@/lib/auth'

export const metadata = { title: 'Sign in · Site Analyzer' }
export const dynamic = 'force-dynamic'
const safe = (n?: string) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/analyze')

export default async function Page({ searchParams }: { searchParams: { next?: string } }) {
  if (await getSession()) redirect('/analyze')
  return <AuthForm mode="login" next={safe(searchParams.next)} />
}
