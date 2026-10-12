import './globals.css'
export const metadata = { title: 'Site Analyzer – see why your website isn’t ranking', description: 'Paste a URL and get a clear health score, a prioritized fix list and instant answers about your site.' }
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
