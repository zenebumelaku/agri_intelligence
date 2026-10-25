import { useState } from 'react'

const API_URL = 'http://localhost:8001/api/ml/crop-recommendations'
const HISTORY_KEY = 'agrisense.crop-recommendation-history'
const HISTORY_LIMIT = 8

const REGIONS = ['Amhara', 'Oromia', 'SNNPR', 'Tigray', 'Sidama']
const SEASONS = ['Meher', 'Belg', 'Bega', 'unknown']
const SOILS = ['unknown', 'loamy', 'clay', 'sandy', 'volcanic']
const WATER_LEVELS = ['none', 'limited', 'moderate', 'abundant']

function readHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch (error) {
    console.warn('Could not read saved crop recommendation history', error)
    return []
  }
}

function Field({ label, htmlFor, children, hint }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-xs font-medium text-slate-300">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{hint}</p>}
    </div>
  )
}

const controlClass = 'w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/10'

export default function CropAdvisor() {
  const [form, setForm] = useState({
    region: 'Amhara',
    season: 'Meher',
    soil_type: 'unknown',
    water_availability: 'limited',
    farm_size_ha: '1',
  })
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState(readHistory)
  const [comparisonId, setComparisonId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const comparison = history.find((item) => item.id === comparisonId)

  function updateForm(event) {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          farm_size_ha: Number(form.farm_size_ha),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : 'Check the farm details and try again.'
        throw new Error(detail)
      }

      const record = {
        id: `${Date.now()}`,
        createdAt: new Date().toISOString(),
        result: data,
      }
      const nextHistory = [record, ...history].slice(0, HISTORY_LIMIT)
      setResult(data)
      setHistory(nextHistory)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))
      } catch (storageError) {
        console.error('Could not save crop recommendation history', storageError)
        setError('Recommendations are ready, but this browser could not save them for later comparison.')
      }
    } catch (requestError) {
      setError(requestError.message || 'Could not get crop recommendations. Check that the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  function clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY)
      setHistory([])
      setComparisonId('')
    } catch (storageError) {
      console.error('Could not clear crop recommendation history', storageError)
      setError('Could not clear saved history in this browser.')
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-900/80 shadow-xl shadow-slate-950/20">
      <div className="border-b border-white/[0.06] bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 px-5 py-5 md:px-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/75">Farm planning tool</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">Personalized crop recommendations</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
              Compare broad crop suitability for your conditions. Recommendations are guidance for planning, not a guarantee of yield.
            </p>
          </div>
          <span className="w-fit rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-amber-200/80">
            Advisory · not a forecast
          </span>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:p-7 xl:grid-cols-[0.8fr_1.2fr]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Region" htmlFor="advisor-region">
              <select id="advisor-region" name="region" value={form.region} onChange={updateForm} className={controlClass}>
                {REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
              </select>
            </Field>

            <Field label="Growing season" htmlFor="advisor-season">
              <select id="advisor-season" name="season" value={form.season} onChange={updateForm} className={controlClass}>
                {SEASONS.map((season) => <option key={season} value={season}>{season === 'unknown' ? 'Not sure' : season}</option>)}
              </select>
            </Field>

            <Field label="Soil type" htmlFor="advisor-soil" hint="Choose “Not sure” if you do not have a soil test.">
              <select id="advisor-soil" name="soil_type" value={form.soil_type} onChange={updateForm} className={controlClass}>
                {SOILS.map((soil) => <option key={soil} value={soil}>{soil === 'unknown' ? 'Not sure' : soil[0].toUpperCase() + soil.slice(1)}</option>)}
              </select>
            </Field>

            <Field label="Available water" htmlFor="advisor-water">
              <select id="advisor-water" name="water_availability" value={form.water_availability} onChange={updateForm} className={controlClass}>
                {WATER_LEVELS.map((water) => <option key={water} value={water}>{water === 'none' ? 'Rain-fed only' : water[0].toUpperCase() + water.slice(1)}</option>)}
              </select>
            </Field>

            <div className="sm:col-span-2">
              <Field label="Farm size" htmlFor="advisor-size" hint="Enter the total area in hectares.">
                <div className="relative">
                  <input
                    id="advisor-size"
                    name="farm_size_ha"
                    type="number"
                    min="0.01"
                    max="100000"
                    step="0.01"
                    required
                    value={form.farm_size_ha}
                    onChange={updateForm}
                    className={`${controlClass} pr-14`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">hectares</span>
                </div>
              </Field>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/40 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? 'Finding suitable crops…' : 'Get crop recommendations'}
            {!loading && <span aria-hidden="true">→</span>}
          </button>

          {error && <p role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs leading-relaxed text-amber-200">{error}</p>}

          {history.length > 0 && (
            <div className="border-t border-white/[0.06] pt-4">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="advisor-compare" className="text-xs font-medium text-slate-300">Compare with a saved assessment</label>
                <button type="button" onClick={clearHistory} className="text-[11px] text-slate-500 transition hover:text-red-300">Clear history</button>
              </div>
              <select
                id="advisor-compare"
                value={comparisonId}
                onChange={(event) => setComparisonId(event.target.value)}
                className={`${controlClass} mt-2`}
              >
                <option value="">Select a previous assessment</option>
                {history.filter((item) => item.result !== result).map((item) => (
                  <option key={item.id} value={item.id}>
                    {new Date(item.createdAt).toLocaleString()} · {item.result.region} · {item.result.season}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-slate-500">Saved on this device. Up to {HISTORY_LIMIT} assessments are kept.</p>
            </div>
          )}
        </form>

        <div className="min-w-0">
          {!result ? (
            <div className="flex h-full min-h-64 flex-col justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 p-6">
              <span className="text-3xl" aria-hidden="true">🌱</span>
              <h3 className="mt-4 font-semibold text-white">Plan with your field conditions</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                Enter your farm details to see ranked options for teff, maize, wheat, sorghum, and coffee—with reasons and limitations for each.
              </p>
            </div>
          ) : (
            <div aria-live="polite">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-white">Ranked options for {result.region}</h3>
                  <p className="mt-1 text-xs text-slate-500">{result.season} · {result.soil_type} soil · {result.water_availability} water · {result.farm_size_ha} ha</p>
                </div>
                {comparison && <span className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] text-slate-300">Comparing saved run</span>}
              </div>

              <div className="space-y-3">
                {result.recommendations.map((crop, index) => {
                  const previousScore = comparison?.result.recommendations.find((item) => item.crop === crop.crop)?.suitability_score
                  const change = previousScore === undefined ? null : crop.suitability_score - previousScore
                  return (
                    <article key={crop.crop} className="rounded-2xl border border-white/[0.06] bg-slate-950/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/10 text-sm font-semibold text-emerald-300">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <h4 className="font-semibold text-white">{crop.crop}</h4>
                            <p className="text-[10px] text-slate-500">{crop.score_label}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-emerald-300">{crop.suitability_score}<span className="text-xs text-slate-500">/100</span></p>
                          {change !== null && <p className={`text-[10px] ${change > 0 ? 'text-emerald-300' : change < 0 ? 'text-amber-300' : 'text-slate-500'}`}>{change > 0 ? '+' : ''}{change} vs saved</p>}
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-300 transition-[width] duration-500" style={{ width: `${crop.suitability_score}%` }} />
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-slate-300">{crop.reasons.join(' ')}</p>
                      <p className="mt-2 text-[11px] leading-relaxed text-amber-200/70"><span className="font-semibold text-amber-200/90">Limitation:</span> {crop.limitations}</p>
                    </article>
                  )
                })}
              </div>

              <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <summary className="cursor-pointer text-xs font-semibold text-slate-300">How to interpret these results</summary>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">{result.method}</p>
                <p className="mt-3 text-xs font-semibold text-slate-300">Information that could improve the assessment</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-400">
                  {result.missing_information.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </details>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
