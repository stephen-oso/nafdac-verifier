import { useState, useEffect } from 'react'
import Header from './components/Header'
import AboutPanel from './components/AboutPanel'
import SearchInput from './components/SearchInput'
import ResultCard from './components/ResultCard'
import Footer from './components/Footer'
import { verifyDrug, fetchHealth } from './api'

export default function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAbout, setShowAbout] = useState(false)
  const [scrapeDate, setScrapeDate] = useState(null)

  useEffect(() => {
    fetchHealth().then((data) => {
      if (data?.scrape_date) setScrapeDate(data.scrape_date)
    })
  }, [])

  async function handleVerify(query) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await verifyDrug(query)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Header onInfoClick={() => setShowAbout(true)} />
      <AboutPanel visible={showAbout} onClose={() => setShowAbout(false)} scrapeDate={scrapeDate} />

      <main style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SearchInput onVerify={handleVerify} loading={loading} />

        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Checking registry…</p>
        )}

        {error && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: '14px 16px', color: '#991b1b', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {result && !loading && <ResultCard result={result} />}
      </main>

      <Footer scrapeDate={scrapeDate} />
    </div>
  )
}
