import { useEffect, useRef, useState } from 'react'

const EVENT_STYLES = {
  WEATHER_TELEMETRY: { dot: 'bg-sky-400', badge: 'bg-sky-500/10 text-sky-400', label: 'Weather' },
  MARKET_PRICE: { dot: 'bg-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400', label: 'Market' },
  CROP_SIGNAL: { dot: 'bg-red-400', badge: 'bg-red-500/10 text-red-400', label: 'Crop Risk' },
  PRODUCTION: { dot: 'bg-indigo-400', badge: 'bg-indigo-500/10 text-indigo-400', label: 'Production' },
}

function formatPayload(event) {
  const p = event.payload
  switch (event.event_type) {
    case 'WEATHER_TELEMETRY':
      return `${p.temperature_c}°C · ${p.rainfall_mm}mm rain · ${p.humidity_pct}% humidity`
    case 'MARKET_PRICE':
      return `${p.crop} · ${p.price_per_quintal_etb.toLocaleString()} ETB/q · ${p.volume_traded_tons}t`
    case 'CROP_SIGNAL':
      return `${p.crop} · Pest ${(p.pest_threat_index * 100).toFixed(0)}% · Health ${(p.vegetation_health_index * 100).toFixed(0)}%`
    case 'PRODUCTION':
      return `${p.crop} · ${p.production_tons.toFixed(0)}t · ${p.area_hectares.toFixed(0)}ha`
    default:
      return ''
  }
}

export default function EventFeed({ events }) {
  const containerRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    const el = containerRef.current
    if (autoScroll && el) {
      el.scrollTop = el.scrollHeight
    }
  }, [events, autoScroll])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(atBottom)
  }

  return (
    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">⚡ Live Event Feed</h2>
        <span className="flex items-center gap-1.5 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Streaming
        </span>
      </div>
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true)
            const el = containerRef.current
            if (el) el.scrollTop = el.scrollHeight
          }}
          className="mb-2 w-full text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg py-1 hover:bg-green-500/20 transition"
        >
          ↓ Scroll to latest
        </button>
      )}
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ maxHeight: 320 }}>
        {events.map((e, i) => {
          const style = EVENT_STYLES[e.event_type] || EVENT_STYLES.WEATHER_TELEMETRY
          return (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-800 last:border-0">
              <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${style.badge}`}>{style.label}</span>
                  <span className="text-xs text-slate-400">{e.region}</span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 truncate">{formatPayload(e)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
