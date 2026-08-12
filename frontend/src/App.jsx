import { useState, useEffect } from 'react'
import Header from './components/Header'
import AboutPanel from './components/AboutPanel'
import SearchInput from './components/SearchInput'
import ResultCard from './components/ResultCard'
import StatsStrip from './components/StatsStrip'
import Footer from './components/Footer'
import { verifyDrug, fetchHealth } from './api'

const MODE_KEY = 'nafdac_mode'

export default function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAbout, setShowAbout] = useState(false)
  const [scrapeDate, setScrapeDate] = useState(null)
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) || 'Pharmacist')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchHealth().then((data) => {
      if (data?.scrape_date) setScrapeDate(data.scrape_date)
    })
  }, [])

  function handleModeChange(m) {
    setMode(m)
    localStorage.setItem(MODE_KEY, m)
  }

  async function handleVerify(q) {
    setQuery(q)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await verifyDrug(q)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Header onInfoClick={() => setShowAbout(true)} mode={mode} onModeChange={handleModeChange} />
      <StatsStrip mode={mode} />
      <AboutPanel visible={showAbout} onClose={() => setShowAbout(false)} scrapeDate={scrapeDate} />

      <main style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <SearchInput onVerify={handleVerify} loading={loading} mode={mode} />

        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Checking registry…</p>
        )}

        {error && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecaca', borderRadius: 'var(--radius)', padding: '14px 16px', color: '#991b1b', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {result && !loading && <ResultCard result={result} mode={mode} query={query} />}

        {!result && !loading && !error && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 18px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
              How to verify a drug
            </div>
            <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                mode === 'Community'
                  ? 'Find the drug name on your pack and type it below.'
                  : 'Find the NAFDAC registration number on the packaging and search it here.',
                'Compare the drug name and manufacturer in the result to what is printed on the box.',
                'If they do not match — the product is likely counterfeit.',
              ].map((step, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--green)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: '0.875rem', lineHeight: 1.55, color: 'var(--text-primary)', paddingTop: 2 }}>{step}</span>
                </li>
              ))}
            </ol>
            <p style={{ marginTop: 14, fontSize: '0.775rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {mode === 'Community'
                ? 'You can also type the NAFDAC number if you can find it on the pack.'
                : 'You can also search by drug name. Tap ⓘ for a full explanation of what this app can and cannot detect.'}
            </p>
          </div>
        )}
      </main>

      <Footer scrapeDate={scrapeDate} />
    </div>
  )
}
