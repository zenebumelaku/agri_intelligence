import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const COLORS = {
  temperature_c: '#f97316',
  rainfall_mm: '#38bdf8',
  humidity_pct: '#a78bfa',
  soil_moisture_pct: '#34d399',
}

export default function WeatherChart({ data }) {
  const chartData = data.map((d, i) => ({
    index: i,
    region: d.region,
    temperature_c: d.payload.temperature_c,
    rainfall_mm: d.payload.rainfall_mm,
    humidity_pct: d.payload.humidity_pct,
    soil_moisture_pct: d.payload.soil_moisture_pct,
  }))

  const latest = data[data.length - 1]

  return (
    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">🌤 Weather Telemetry</h2>
          {latest && (
            <p className="text-xs text-slate-400 mt-0.5">
              Latest: <span className="text-green-400">{latest.region}</span>
            </p>
          )}
        </div>
        <div className="flex gap-3 text-xs">
          {latest && (
            <>
              <span className="bg-orange-500/10 text-orange-400 px-2 py-1 rounded-lg">
                {latest.payload.temperature_c}°C
              </span>
              <span className="bg-sky-500/10 text-sky-400 px-2 py-1 rounded-lg">
                {latest.payload.rainfall_mm}mm
              </span>
            </>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="index" hide />
          <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
            labelFormatter={() => ''}
            formatter={(val, name) => [val, name.replace(/_/g, ' ')]}
          />
          <Legend formatter={(v) => v.replace(/_/g, ' ')} wrapperStyle={{ fontSize: 11 }} />
          {Object.entries(COLORS).map(([key, color]) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
