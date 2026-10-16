'use client'
import { useEffect, useRef, useState } from 'react'
type Msg = { role: 'user' | 'bot'; text: string }
const SUGGEST = ['Give me a prioritized 5-step fix plan', 'Why is my structure score low?', 'Which pages have thin content?', 'How do I improve indexing?']
function Md({ text }: { text: string }) {
  return <>{text.split('\n').map((l, i) => <p key={i} className={l.trim() ? 'mb-1.5' : 'h-1'} dangerouslySetInnerHTML={{ __html: l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 rounded">$1</code>') }} />)}</>
}
export function AiPanel({ knowledge, autoAsk, auditId }: { knowledge: any[]; autoAsk: string; auditId?: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]); const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const [ms, setMs] = useState(0)
  const box = useRef<HTMLDivElement>(null); const started = useRef(false)
  async function ask(question: string) {
    if (!question.trim() || busy) return
    setBusy(true); setQ(''); const t0 = performance.now()
    setMsgs(m => [...m, { role: 'user', text: question }, { role: 'bot', text: '' }])
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, knowledge, auditId }) })
    const reader = res.body!.getReader(); const dec = new TextDecoder(); let acc = '', first = true
    for (;;) { const { done, value } = await reader.read(); if (done) break; if (first) { setMs(Math.round(performance.now() - t0)); first = false }; acc += dec.decode(value, { stream: true }); setMsgs(m => [...m.slice(0, -1), { role: 'bot', text: acc }]) }
    setBusy(false)
  }
  useEffect(() => { if (!started.current && autoAsk) { started.current = true; ask(autoAsk) } }, []) // eslint-disable-line
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }) }, [msgs])
  return (
    <div className="card p-5 flex flex-col h-[560px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">Ask about your site <span className="text-mute font-normal text-xs">· answers from your own pages</span></h3>
        {ms > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{ms}ms</span>}
      </div>
      <div ref={box} className="flex-1 overflow-y-auto space-y-3 pr-1 text-sm">
        {msgs.map((m, i) => <div key={i} className={m.role === 'user' ? 'ml-8 bg-indigo-50 text-indigo-900 rounded-2xl rounded-br-sm p-3' : 'bg-slate-50 border border-slate-200 rounded-2xl rounded-bl-sm p-3 text-ink/90'}>{m.text ? <Md text={m.text} /> : <span className="animate-pulse text-mute">writing your answer…</span>}</div>)}
      </div>
      <div className="flex flex-wrap gap-1.5 my-3">{SUGGEST.map(s => <button key={s} onClick={() => ask(s)} className="text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-mute hover:text-indigo-700 hover:border-indigo-300 transition">{s}</button>)}</div>
      <div className="flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask(q)} placeholder="Ask anything about this site…" className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" />
        <button onClick={() => ask(q)} disabled={busy} className="btn px-5 rounded-xl text-sm">Ask</button>
      </div>
    </div>
  )
}
