export default function StatCard({ icon, label, value, sub, color }) {
  const colorMap = {
    green: 'border-emerald-500/15 bg-emerald-500/10 text-emerald-300',
    orange: 'border-orange-500/15 bg-orange-500/10 text-orange-300',
    sky: 'border-sky-500/15 bg-sky-500/10 text-sky-300',
    purple: 'border-purple-500/15 bg-purple-500/10 text-purple-300',
    yellow: 'border-yellow-500/15 bg-yellow-500/10 text-yellow-300',
    red: 'border-red-500/15 bg-red-500/10 text-red-300',
  }

  return (
    <div className="group rounded-2xl border border-slate-800/90 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/20 transition duration-200 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border text-lg ${colorMap[color] || colorMap.green}`}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-white sm:text-[1.7rem]">{value}</p>
      {sub && <p className="mt-2 truncate text-xs text-slate-500" title={sub}>{sub}</p>}
    </div>
  )
}
