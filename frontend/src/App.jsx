import { useMemo } from 'react'
import { useAgriStream } from './hooks/useAgriStream'
import WeatherChart from './components/WeatherChart'
import MarketChart from './components/MarketChart'
import CropRiskChart from './components/CropRiskChart'
import ProductionChart from './components/ProductionChart'
import StatCard from './components/StatCard'
import EventFeed from './components/EventFeed'

export default function App() {
  const { weather, market, cropRisk, production, connected, source, hdfsFiles, hdfsEvents, hdfsSize } = useAgriStream()

  const stats = useMemo(() => {
    const latestW = weather[weather.length - 1]
    const latestM = market[market.length - 1]
    const latestC = cropRisk[cropRisk.length - 1]
    const latestP = production[production.length - 1]
    return {
      temp: latestW ? `${latestW.payload.temperature_c}°C` : '--',
      tempSub: latestW?.region,
      price: latestM ? `${latestM.payload.price_per_quintal_etb.toLocaleString()} ETB` : '--',
      priceSub: latestM ? `${latestM.payload.crop} · ${latestM.region}` : '',
      pest: latestC ? `${(latestC.payload.pest_threat_index * 100).toFixed(0)}%` : '--',
      pestSub: latestC ? `${latestC.payload.crop} · ${latestC.region}` : '',
      prod: latestP ? `${latestP.payload.production_tons.toFixed(0)}t` : '--',
      prodSub: latestP ? `${latestP.payload.crop} · ${latestP.region}` : '',
    }
  }, [weather, market, cropRisk, production])

  // Merge all events for the live feed, sorted by timestamp
  const allEvents = useMemo(() => {
    return [...weather, ...market, ...cropRisk, ...production]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-40)
  }, [weather, market, cropRisk, production])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10 bg-slate-950/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌾</span>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Agri Intelligence</h1>
            <p className="text-xs text-slate-500">Real-time Agricultural Data Pipeline</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`} />
          <span className={connected ? 'text-green-400' : 'text-yellow-400'}>
            {connected ? 'Live — Kafka' : 'Mock data'}
          </span>
          {source === 'mock' && (
            <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">
              backend offline
            </span>
          )}
          <span className="text-slate-600 ml-1 text-xs hidden sm:block">
            Regions: Amhara · Oromia · SNNPR · Tigray · Sidama
          </span>
        </div>
      </header>

      <main className="px-4 md:px-6 py-6 space-y-6 max-w-screen-2xl mx-auto">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon="🌡️" label="Temperature" value={stats.temp} sub={stats.tempSub} color="orange" />
          <StatCard icon="💰" label="Market Price" value={stats.price} sub={stats.priceSub} color="yellow" />
          <StatCard icon="🐛" label="Pest Threat" value={stats.pest} sub={stats.pestSub} color="red" />
          <StatCard icon="🌱" label="Production" value={stats.prod} sub={stats.prodSub} color="green" />
          <StatCard icon="🗄️" label="HDFS Storage" value={`~${(hdfsEvents / 1000).toFixed(1)}k rows`} sub={`${(hdfsSize / 1024 / 1024).toFixed(2)} MB in ${hdfsFiles} files`} color="sky" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WeatherChart data={weather} />
          <MarketChart data={market} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CropRiskChart data={cropRisk} />
          <ProductionChart data={production} />
        </div>

        {/* Live Event Feed */}
        <div className="grid grid-cols-1 gap-4">
          <EventFeed events={allEvents} />
        </div>
      </main>

      <footer className="text-center text-xs text-slate-700 py-4 border-t border-slate-800">
        Agri Intelligence Dashboard · {source === 'live' ? 'Connected to pipeline_api :8000' : 'Mock mode — start pipeline_api to go live'}
      </footer>
    </div>
  )
}
