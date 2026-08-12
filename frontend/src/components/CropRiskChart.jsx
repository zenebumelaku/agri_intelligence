import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'

export default function CropRiskChart({ data }) {
  // Latest risk per region
  const regionMap = {}
  data.forEach((d) => {
    regionMap[d.region] = {
      region: d.region,
      pest: parseFloat((d.payload.pest_threat_index * 100).toFixed(1)),
      health: parseFloat((d.payload.vegetation_health_index * 100).toFixed(1)),
    }
  })
  const radarData = Object.values(regionMap)

  // Time series for area chart
  const areaData = data.slice(-15).map((d, i) => ({
    index: i,
    pest: parseFloat((d.payload.pest_threat_index * 100).toFixed(1)),
    health: parseFloat((d.payload.vegetation_health_index * 100).toFixed(1)),
  }))

  const latest = data[data.length - 1]

  return (
    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">🐛 Crop Risk Signals</h2>
          {latest && (
            <p className="text-xs text-slate-400 mt-0.5">
              Latest: <span className="text-pink-400">{latest.payload.crop}</span> — {latest.region}
            </p>
          )}
        </div>
        {latest && (
          <div className="flex gap-2 text-xs">
            <span className="bg-red-500/10 text-red-400 px-2 py-1 rounded-lg">
              Pest {(latest.payload.pest_threat_index * 100).toFixed(0)}%
            </span>
            <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded-lg">
              Health {(latest.payload.vegetation_health_index * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#1e293b" />
            <PolarAngleAxis dataKey="region" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#475569' }} />
            <Radar name="Pest Threat" dataKey="pest" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.3} />
            <Radar name="Veg Health" dataKey="health" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
              formatter={(val, name) => [`${val}%`, name]}
            />
          </RadarChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={areaData}>
            <defs>
              <linearGradient id="pestGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="index" hide />
            <YAxis domain={[0, 100]} stroke="#475569" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
              formatter={(val, name) => [`${val}%`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="pest" name="Pest Threat" stroke="#f43f5e" fill="url(#pestGrad)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="health" name="Veg Health" stroke="#22c55e" fill="url(#healthGrad)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
