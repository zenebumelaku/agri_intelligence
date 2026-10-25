import { useEffect, useMemo, useState } from 'react'
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
  const [insights, setInsights] = useState(null)
  const [recommendations, setRecommendations] = useState([])

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const res = await fetch('http://localhost:8001/api/ml/insights')
        if (!res.ok) return
        const data = await res.json()
        setInsights(data)
      } catch (error) {
        console.warn('ML insights unavailable', error)
      }
    }

    const fetchRecommendations = async () => {
      try {
        const res = await fetch('http://localhost:8001/api/recommendations')
        if (!res.ok) return
        const data = await res.json()
        setRecommendations(data.actions || [])
      } catch (error) {
        console.warn('Recommendations unavailable', error)
      }
    }

    fetchInsights()
    fetchRecommendations()
  }, [])

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

  const exportReport = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      selectedRegion,
      connected,
      source,
      overview,
      alerts,
      insights,
      recommendations,
      hdfsFiles,
      hdfsEvents,
      hdfsSize,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `agri-intelligence-report-${selectedRegion.toLowerCase().replace(/\s+/g, '-')}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto max-w-screen-2xl px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/20 to-lime-400/5 text-2xl shadow-lg shadow-emerald-500/10">🌾</div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">Agri<span className="text-emerald-300">Sense</span></h1>
                <p className="text-[11px] text-slate-500">Agricultural intelligence platform</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
              <nav aria-label="Dashboard sections" className="order-2 flex items-center gap-1 sm:order-1">
                <a href="#overview" className="rounded-lg px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">Overview</a>
                <a href="#analytics" className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-white/5 hover:text-white">Analytics</a>
                <a href="#intelligence" className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-white/5 hover:text-white">Intelligence</a>
              </nav>

              <div className="order-1 flex items-center gap-2 self-start rounded-full border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs sm:order-2 sm:self-auto">
                <span className={`relative flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`}>
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                </span>
                <span className={connected ? 'text-emerald-300' : 'text-amber-300'}>
                  {connected ? 'Live data' : 'Demo mode'}
                </span>
                {source === 'mock' && (
                  <span className="border-l border-slate-700 pl-2 text-[10px] uppercase tracking-wider text-slate-500">API offline</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl space-y-8 px-4 py-6 md:px-6 md:py-8">
        <section id="overview" className="grid scroll-mt-24 gap-5 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="relative isolate overflow-hidden rounded-3xl border border-emerald-400/10 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 p-6 shadow-2xl shadow-slate-950/40 md:p-7">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">Regional intelligence · Ethiopia</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  {selectedRegion === 'All' ? 'All regions overview' : `${selectedRegion} focus`}
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">A live view of climate, crop health, markets, and production signals across your selected region.</p>
              </div>
              <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300 sm:inline-flex">
                {connected ? 'ONLINE' : 'SIMULATED'}
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor="region-filter" className="text-xs font-medium text-slate-400">Region</label>
              <select
                id="region-filter"
                value={selectedRegion}
                onChange={(event) => setSelectedRegion(event.target.value)}
                className="min-w-48 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/10"
              >
                {REGIONS.map((region) => <option key={region} value={region}>{region === 'All' ? 'All regions' : region}</option>)}
              </select>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/[0.06] bg-slate-950/40 p-4 transition hover:border-white/10">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Avg temperature</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{overview.avgTemp}</p>
                <p className="mt-1 text-[11px] text-slate-500">Across recent readings</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-slate-950/40 p-4 transition hover:border-white/10">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Rainfall</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{overview.avgRain}</p>
                <p className="mt-1 text-[11px] text-slate-500">Average precipitation</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-slate-950/40 p-4 transition hover:border-white/10">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Average price</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{overview.avgPrice}</p>
                <p className="mt-1 text-[11px] text-slate-500">Market signal</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-slate-950/40 p-4 transition hover:border-white/10">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">Production</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{overview.totalProduction}</p>
                <p className="mt-1 text-[11px] text-slate-500">Recent reported volume</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">Monitoring</p>
                <h3 className="mt-1 text-base font-semibold text-white">Priority alerts</h3>
              </div>
              <button
                type="button"
                onClick={exportReport}
                className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-500/15 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              >
                Export
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {alerts.map((alert) => (
                <div key={alert.title} className="flex gap-3 rounded-2xl border border-white/[0.06] bg-slate-950/40 p-4">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    alert.tone === 'red'
                      ? 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.55)]'
                      : alert.tone === 'orange'
                        ? 'bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.5)]'
                        : alert.tone === 'yellow'
                          ? 'bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.5)]'
                          : 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                  }`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{alert.title}</p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{alert.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-label="Key performance indicators" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard icon="🌡️" label="Temperature" value={stats.temp} sub={stats.tempSub} color="orange" />
          <StatCard icon="💰" label="Market Price" value={stats.price} sub={stats.priceSub} color="yellow" />
          <StatCard icon="🐛" label="Pest Threat" value={stats.pest} sub={stats.pestSub} color="red" />
          <StatCard icon="🌱" label="Production" value={stats.prod} sub={stats.prodSub} color="green" />
          <StatCard icon="🗄️" label="HDFS Storage" value={`~${(hdfsEvents / 1000).toFixed(1)}k rows`} sub={`${(hdfsSize / 1024 / 1024).toFixed(2)} MB in ${hdfsFiles} files`} color="sky" />
        </section>

        <section id="analytics" className="scroll-mt-24 space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/70">Field signals</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Analytics overview</h2>
            </div>
            <p className="hidden text-xs text-slate-500 sm:block">Recent observations · {selectedRegion === 'All' ? 'All regions' : selectedRegion}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <WeatherChart data={filteredWeather} />
          <MarketChart data={filteredMarket} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CropRiskChart data={filteredCropRisk} />
          <ProductionChart data={filteredProduction} />
          </div>
        </section>

        <section id="intelligence" className="grid scroll-mt-24 grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">Machine learning</p>
                <h2 className="mt-2 text-lg font-semibold text-white">AI crop intelligence</h2>
              </div>
              {insights && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                  {insights.overall_label}
                </span>
              )}
            </div>

            {insights ? (
              <div className="space-y-3">
                {insights.regions.slice(0, 3).map((region) => (
                  <div key={region.region} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{region.region}</p>
                        <p className="text-xs text-slate-400">{region.alert}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Risk</p>
                        <p className="text-lg font-semibold text-amber-300">{region.risk_score}%</p>
                      </div>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500" style={{ width: `${Math.min(region.risk_score, 100)}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Yield forecast: {region.yield_forecast_tons.toFixed(1)} t</span>
                      <span>Confidence: {(region.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-400">
                Loading AI insights...
              </div>
            )}

            <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">Action center</p>
              <div className="mt-3 space-y-3">
                {recommendations.length > 0 ? (
                  recommendations.slice(0, 3).map((item) => (
                    <div key={`${item.region}-${item.priority}`} className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-white">{item.region}</p>
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-300">
                          P{item.priority}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{item.recommendation}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Loading action recommendations...</p>
                )}
              </div>
            </div>
          </div>

          <EventFeed events={allEvents} />
        </section>
      </main>

      <footer className="mt-10 border-t border-white/[0.06] bg-slate-950/50 py-6">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-2 px-4 text-center text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between md:px-6 sm:text-left">
          <span><span className="font-semibold text-slate-300">AgriSense</span> · Agricultural intelligence dashboard</span>
          <span>{source === 'live' ? 'Connected to pipeline API' : 'Demo data · Start the API to connect live sources'}</span>
        </div>
      </footer>
    </div>
  )
}
