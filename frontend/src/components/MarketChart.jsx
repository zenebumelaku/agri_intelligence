import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'

const CROP_COLORS = {
  Teff: '#f59e0b',
  Maize: '#10b981',
  Wheat: '#f97316',
  Coffee: '#8b5cf6',
  Sorghum: '#ec4899',
}

export default function MarketChart({ data }) {
  // Aggregate latest price per crop
  const cropMap = {}
  data.forEach((d) => {
    const crop = d.payload.crop
    cropMap[crop] = {
      crop,
      price: d.payload.price_per_quintal_etb,
      volume: d.payload.volume_traded_tons,
      region: d.region,
    }
  })
  const chartData = Object.values(cropMap)

  const latest = data[data.length - 1]

  return (
    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">📈 Market Prices</h2>
          {latest && (
            <p className="text-xs text-slate-400 mt-0.5">
              Latest: <span className="text-yellow-400">{latest.payload.crop}</span> — {latest.region}
            </p>
          )}
        </div>
        {latest && (
          <span className="bg-yellow-500/10 text-yellow-400 text-xs px-2 py-1 rounded-lg">
            {latest.payload.price_per_quintal_etb.toLocaleString()} ETB/q
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="crop" stroke="#475569" tick={{ fontSize: 11 }} />
          <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
            formatter={(val, name) => [
              name === 'price' ? `${val.toLocaleString()} ETB` : `${val} tons`,
              name === 'price' ? 'Price/Quintal' : 'Volume',
            ]}
          />
          <Legend formatter={(v) => (v === 'price' ? 'Price (ETB/q)' : 'Volume (tons)')} wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="price" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.crop} fill={CROP_COLORS[entry.crop] || '#64748b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
