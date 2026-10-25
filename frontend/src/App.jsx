import { useMemo, useState } from 'react'
import { useAgriStream } from './hooks/useAgriStream'
import WeatherChart from './components/WeatherChart'
import MarketChart from './components/MarketChart'
import CropRiskChart from './components/CropRiskChart'
import ProductionChart from './components/ProductionChart'
import StatCard from './components/StatCard'
import EventFeed from './components/EventFeed'

const REGIONS = ['All', 'Amhara', 'Oromia', 'SNNPR', 'Tigray', 'Sidama']

const average = (items, accessor, fallback = 0) => {
  if (!items.length) return fallback
  const total = items.reduce((sum, item) => sum + accessor(item), 0)
  return total / items.length
}

export default function App() {
  const { weather, market, cropRisk, production, connected, source, hdfsFiles, hdfsEvents, hdfsSize } = useAgriStream()
  const [selectedRegion, setSelectedRegion] = useState('All')

  const filteredWeather = useMemo(() => {
    return selectedRegion === 'All' ? weather : weather.filter((item) => item.region === selectedRegion)
  }, [weather, selectedRegion])

  const filteredMarket = useMemo(() => {
    return selectedRegion === 'All' ? market : market.filter((item) => item.region === selectedRegion)
  }, [market, selectedRegion])

  const filteredCropRisk = useMemo(() => {
    return selectedRegion === 'All' ? cropRisk : cropRisk.filter((item) => item.region === selectedRegion)
  }, [cropRisk, selectedRegion])

  const filteredProduction = useMemo(() => {
    return selectedRegion === 'All' ? production : production.filter((item) => item.region === selectedRegion)
  }, [production, selectedRegion])

  const stats = useMemo(() => {
    const latestW = filteredWeather[filteredWeather.length - 1]
    const latestM = filteredMarket[filteredMarket.length - 1]
    const latestC = filteredCropRisk[filteredCropRisk.length - 1]
    const latestP = filteredProduction[filteredProduction.length - 1]

    return {
      temp: latestW ? `${latestW.payload.temperature_c.toFixed(1)}°C` : '--',
      tempSub: latestW ? `${latestW.region} · ${latestW.payload.humidity_pct.toFixed(0)}% humidity` : 'No data',
      price: latestM ? `${latestM.payload.price_per_quintal_etb.toLocaleString()} ETB` : '--',
      priceSub: latestM ? `${latestM.payload.crop} · ${latestM.region}` : 'No data',
      pest: latestC ? `${(latestC.payload.pest_threat_index * 100).toFixed(0)}%` : '--',
      pestSub: latestC ? `${latestC.payload.crop} · ${latestC.region}` : 'No data',
      prod: latestP ? `${latestP.payload.production_tons.toFixed(0)}t` : '--',
      prodSub: latestP ? `${latestP.payload.crop} · ${latestP.region}` : 'No data',
    }
  }, [filteredWeather, filteredMarket, filteredCropRisk, filteredProduction])

  const overview = useMemo(() => {
    const avgTemp = average(filteredWeather, (item) => item.payload.temperature_c)
    const avgRain = average(filteredWeather, (item) => item.payload.rainfall_mm)
    const avgMoisture = average(filteredWeather, (item) => item.payload.soil_moisture_pct)
    const avgPrice = average(filteredMarket, (item) => item.payload.price_per_quintal_etb)
    const avgPest = average(filteredCropRisk, (item) => item.payload.pest_threat_index)
    const totalProduction = filteredProduction.reduce((sum, item) => sum + item.payload.production_tons, 0)

    return {
      avgTemp: `${avgTemp.toFixed(1)}°C`,
      avgRain: `${avgRain.toFixed(1)} mm`,
      avgMoisture: `${avgMoisture.toFixed(0)}%`,
      avgPrice: `${avgPrice.toLocaleString()} ETB`,
      avgPest: `${(avgPest * 100).toFixed(0)}%`,
      totalProduction: `${totalProduction.toLocaleString()} t`,
    }
  }, [filteredWeather, filteredMarket, filteredCropRisk, filteredProduction])

  const alerts = useMemo(() => {
    const items = []
    const riskSpike = filteredCropRisk[filteredCropRisk.length - 1]
    if (riskSpike && riskSpike.payload.pest_threat_index > 0.7) {
      items.push({
        title: 'High pest risk',
        detail: `${riskSpike.region} · ${(riskSpike.payload.pest_threat_index * 100).toFixed(0)}% threat`,
        tone: 'red',
      })
    }

    const drySoil = filteredWeather[filteredWeather.length - 1]
    if (drySoil && drySoil.payload.soil_moisture_pct < 25) {
      items.push({
        title: 'Soil moisture alert',
        detail: `${drySoil.region} · ${drySoil.payload.soil_moisture_pct.toFixed(0)}% moisture`,
        tone: 'orange',
      })
    }

    const pricePeak = filteredMarket[filteredMarket.length - 1]
    if (pricePeak && pricePeak.payload.price_per_quintal_etb > 8500) {
      items.push({
        title: 'Market premium',
        detail: `${pricePeak.payload.crop} · ${pricePeak.payload.price_per_quintal_etb.toLocaleString()} ETB/q`,
        tone: 'yellow',
      })
    }

    if (!items.length) {
      items.push({
        title: 'System stable',
        detail: 'No critical anomalies detected in the current view.',
        tone: 'green',
      })
    }

    return items.slice(0, 3)
  }, [filteredCropRisk, filteredWeather, filteredMarket])

  const allEvents = useMemo(() => {
    return [...filteredWeather, ...filteredMarket, ...filteredCropRisk, ...filteredProduction]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-40)
  }, [filteredWeather, filteredMarket, filteredCropRisk, filteredProduction])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-screen-2xl px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-2xl shadow-lg shadow-emerald-500/10">🌾</div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">Agri Intelligence</h1>
                <p className="text-xs text-slate-400">Real-time agricultural monitoring</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
              <div className="flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
                <span className={connected ? 'text-emerald-400' : 'text-amber-400'}>
                  {connected ? 'Live · Kafka connected' : 'Demo · Mock feed'}
                </span>
                {source === 'mock' && (
                  <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    backend offline
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {REGIONS.map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => setSelectedRegion(region)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selectedRegion === region
                        ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl space-y-6 px-4 py-6 md:px-6">
        <section className="grid gap-4 xl:grid-cols-[1.5fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-5 shadow-2xl shadow-slate-950/40">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-300/80">Operational snapshot</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {selectedRegion === 'All' ? 'All regions overview' : `${selectedRegion} focus`}
                </h2>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                {connected ? 'ONLINE' : 'SIMULATED'}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Avg temp</p>
                <p className="mt-2 text-2xl font-bold text-white">{overview.avgTemp}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Rainfall</p>
                <p className="mt-2 text-2xl font-bold text-white">{overview.avgRain}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Avg price</p>
                <p className="mt-2 text-2xl font-bold text-white">{overview.avgPrice}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Production</p>
                <p className="mt-2 text-2xl font-bold text-white">{overview.totalProduction}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">Priority alerts</p>
            <div className="mt-4 space-y-3">
              {alerts.map((alert) => (
                <div key={alert.title} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        alert.tone === 'red'
                          ? 'bg-red-400'
                          : alert.tone === 'orange'
                            ? 'bg-orange-400'
                            : alert.tone === 'yellow'
                              ? 'bg-yellow-400'
                              : 'bg-emerald-400'
                      }`}
                    />
                    <p className="font-medium text-white">{alert.title}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{alert.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard icon="🌡️" label="Temperature" value={stats.temp} sub={stats.tempSub} color="orange" />
          <StatCard icon="💰" label="Market Price" value={stats.price} sub={stats.priceSub} color="yellow" />
          <StatCard icon="🐛" label="Pest Threat" value={stats.pest} sub={stats.pestSub} color="red" />
          <StatCard icon="🌱" label="Production" value={stats.prod} sub={stats.prodSub} color="green" />
          <StatCard icon="🗄️" label="HDFS Storage" value={`~${(hdfsEvents / 1000).toFixed(1)}k rows`} sub={`${(hdfsSize / 1024 / 1024).toFixed(2)} MB in ${hdfsFiles} files`} color="sky" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <WeatherChart data={filteredWeather} />
          <MarketChart data={filteredMarket} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CropRiskChart data={filteredCropRisk} />
          <ProductionChart data={filteredProduction} />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <EventFeed events={allEvents} />
        </div>
      </main>

      <footer className="border-t border-slate-800 py-5 text-center text-xs text-slate-600">
        Agri Intelligence Dashboard · {source === 'live' ? 'Connected to pipeline_api :8000' : 'Mock mode — start pipeline_api to go live'}
      </footer>
    </div>
  )
}
