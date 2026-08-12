export default function StatCard({ icon, label, value, sub, color }) {
  const colorMap = {
    green: 'border-green-500/30 bg-green-500/5 text-green-400',
    orange: 'border-orange-500/30 bg-orange-500/5 text-orange-400',
    sky: 'border-sky-500/30 bg-sky-500/5 text-sky-400',
    purple: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
    yellow: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
    red: 'border-red-500/30 bg-red-500/5 text-red-400',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.green}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}
