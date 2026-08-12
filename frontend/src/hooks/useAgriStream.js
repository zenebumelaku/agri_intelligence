import { useState, useEffect, useRef, useCallback } from 'react'

const REGIONS = ['Amhara', 'Oromia', 'SNNPR', 'Tigray', 'Sidama']
const CROPS = ['Teff', 'Maize', 'Wheat', 'Coffee', 'Sorghum']

const rand = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

const mockWeather = () => ({ event_type: 'WEATHER_TELEMETRY', timestamp: Date.now(), region: pick(REGIONS), payload: { temperature_c: rand(15, 38), rainfall_mm: rand(0, 45), humidity_pct: rand(20, 95), soil_moisture_pct: rand(10, 60) } })
const mockMarket = () => ({ event_type: 'MARKET_PRICE', timestamp: Date.now(), region: pick(REGIONS), payload: { crop: pick(CROPS), price_per_quintal_etb: rand(3200, 9500), volume_traded_tons: rand(10, 500) } })
const mockCropRisk = () => ({ event_type: 'CROP_SIGNAL', timestamp: Date.now(), region: pick(REGIONS), payload: { crop: pick(CROPS), pest_threat_index: rand(0, 1), vegetation_health_index: rand(0.1, 0.9) } })
const mockProduction = () => ({ event_type: 'PRODUCTION', timestamp: Date.now(), region: pick(REGIONS), payload: { crop: pick(CROPS), production_tons: rand(500, 5000), area_hectares: rand(100, 2000) } })
const GENERATORS = [mockWeather, mockMarket, mockCropRisk, mockProduction]

const SSE_URL = 'http://localhost:8001/api/events/stream'
const MAX_POINTS = 20
const append = (prev, item) => [...prev.slice(-(MAX_POINTS - 1)), item]

export function useAgriStream() {
  const [weather, setWeather] = useState(() => Array.from({ length: 10 }, mockWeather))
  const [market, setMarket] = useState(() => Array.from({ length: 10 }, mockMarket))
  const [cropRisk, setCropRisk] = useState(() => Array.from({ length: 10 }, mockCropRisk))
  const [production, setProduction] = useState(() => Array.from({ length: 10 }, mockProduction))
  const [connected, setConnected] = useState(false)
  const [source, setSource] = useState('mock')

  const mockTimer = useRef(null)
  const esRef = useRef(null)
  const retryRef = useRef(null)

  const dispatch = useCallback((event) => {
    switch (event.event_type) {
      case 'WEATHER_TELEMETRY': setWeather(p => append(p, event)); break
      case 'MARKET_PRICE': setMarket(p => append(p, event)); break
      case 'CROP_SIGNAL': setCropRisk(p => append(p, event)); break
      case 'PRODUCTION': setProduction(p => append(p, event)); break
      default: break
    }
  }, [])

  const stopMock = useCallback(() => {
    clearInterval(mockTimer.current)
    mockTimer.current = null
  }, [])

  const startMock = useCallback(() => {
    if (mockTimer.current) return
    mockTimer.current = setInterval(() => {
      dispatch(GENERATORS[Math.floor(Math.random() * GENERATORS.length)]())
    }, 1500)
  }, [dispatch])

  useEffect(() => {
    // Start mock immediately so page is never blank
    startMock()

    function connect() {
      if (esRef.current) esRef.current.close()

      const es = new EventSource(SSE_URL)
      esRef.current = es

      es.onopen = () => {
        stopMock()
        setConnected(true)
        setSource('live')
      }

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)
          if (event.error === 'kafka_unavailable') { setConnected(false); return }
          setConnected(true)
          dispatch(event)
        } catch (_) { }
      }

      es.onerror = () => {
        es.close()
        esRef.current = null
        setConnected(false)
        setSource('mock')
        startMock()
        retryRef.current = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      clearTimeout(retryRef.current)
      esRef.current?.close()
      stopMock()
    }
  }, [dispatch, startMock, stopMock])

  const [hdfsFiles, setHdfsFiles] = useState(0)
  const [hdfsEvents, setHdfsEvents] = useState(0)
  const [hdfsSize, setHdfsSize] = useState(0)

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await fetch('http://localhost:8001/api/pipeline/overview')
        if (res.ok) {
          const data = await res.json()
          setHdfsFiles(data.hdfs?.batch_files || 0)
          setHdfsEvents(data.hdfs?.estimated_events || 0)
          setHdfsSize(data.hdfs?.total_bytes || 0)
        }
      } catch (e) {}
    }
    fetchOverview()
    const interval = setInterval(fetchOverview, 5000)
    return () => clearInterval(interval)
  }, [])

  return { weather, market, cropRisk, production, connected, source, hdfsFiles, hdfsEvents, hdfsSize }
}
