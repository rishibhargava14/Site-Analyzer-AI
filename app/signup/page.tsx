import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/AuthForm'
import { getSession } from '@/lib/auth'

export const metadata = { title: 'Create account · Site Analyzer' }
export const dynamic = 'force-dynamic'
const safe = (n?: string) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/analyze')

export default async function Page({ searchParams }: { searchParams: { next?: string } }) {
  if (await getSession()) redirect('/analyze')
  return <AuthForm mode="signup" next={safe(searchParams.next)} />
}
