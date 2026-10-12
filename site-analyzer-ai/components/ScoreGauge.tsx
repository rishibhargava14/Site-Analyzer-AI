export function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const c = 2 * Math.PI * 54, off = c - (score / 100) * c
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r="54" stroke="#e8eaf3" strokeWidth="10" fill="none" />
        <circle cx="60" cy="60" r="54" stroke={color} strokeWidth="10" fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-5xl font-black tabular-nums">{score}</span><span className="text-xs text-mute mt-1">Grade {grade}</span></div>
    </div>
  )
}
