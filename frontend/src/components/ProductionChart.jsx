import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'

const REGION_COLORS = {
  Amhara: '#6366f1',
  Oromia: '#10b981',
  SNNPR: '#f59e0b',
  Tigray: '#ef4444',
  Sidama: '#8b5cf6',
}

export default function ProductionChart({ data }) {
  // Aggregate latest production per region
  const regionMap = {}
  data.forEach((d) => {
    regionMap[d.region] = {
      region: d.region,
      production: d.payload.production_tons,
      area: d.payload.area_hectares,
      crop: d.payload.crop,
    }
  })
  const chartData = Object.values(regionMap)

  const latest = data[data.length - 1]
  const totalProduction = chartData.reduce((sum, d) => sum + d.production, 0)

  return (
    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">🏭 Production Data</h2>
          {latest && (
            <p className="text-xs text-slate-400 mt-0.5">
              Latest: <span className="text-indigo-400">{latest.payload.crop}</span> — {latest.region}
            </p>
          )}
        </div>
        <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-1 rounded-lg">
          Total: {totalProduction.toFixed(0)} tons
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barSize={22}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="region" stroke="#475569" tick={{ fontSize: 10 }} />
          <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
            formatter={(val, name) => [
              name === 'production' ? `${val.toFixed(0)} tons` : `${val.toFixed(0)} ha`,
              name === 'production' ? 'Production' : 'Area',
            ]}
          />
          <Legend
            formatter={(v) => (v === 'production' ? 'Production (tons)' : 'Area (ha)')}
            wrapperStyle={{ fontSize: 11 }}
          />
          <Bar dataKey="production" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.region} fill={REGION_COLORS[entry.region] || '#64748b'} />
            ))}
          </Bar>
          <Bar dataKey="area" fill="#334155" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
