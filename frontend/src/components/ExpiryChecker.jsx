import { useState } from 'react'

export default function ExpiryChecker({ mode }) {
  const [mm, setMm] = useState('')
  const [yy, setYy] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  function check() {
    setError('')
    setResult(null)

    const month = parseInt(mm, 10)
    const year = parseInt('20' + yy, 10)

    if (!mm || !yy || isNaN(month) || isNaN(year)) {
      setError('Enter a valid expiry date')
      return
    }
    if (month < 1 || month > 12) {
      setError('Enter a valid month (01–12)')
      return
    }

    const now = new Date()
    // A drug expires at the end of the stated month, so compare from the 1st of next month
    const expiryEnd = new Date(year, month, 1)
    const soonThreshold = new Date()
    soonThreshold.setDate(soonThreshold.getDate() + 30)

    if (expiryEnd <= now) {
      setResult('expired')
    } else if (expiryEnd <= soonThreshold) {
      setResult('soon')
    } else {
      setResult('valid')
    }
  }

  const RESULTS = {
    valid:   { color: 'var(--green)', text: `Expires ${mm}/${yy} — safe to dispense` },
    soon:    { color: 'var(--amber)', text: `Expires within 30 days — check with patient before dispensing` },
    expired: {
      color: 'var(--red)',
      text: mode === 'Community'
        ? 'DO NOT TAKE — this drug is expired and may be harmful'
        : 'EXPIRED — do not dispense. Remove from stock immediately.',
    },
  }

  return (
    <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        Check expiry date on the pack
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          placeholder="MM"
          value={mm}
          onChange={(e) => setMm(e.target.value.replace(/\D/g, ''))}
          style={{ flex: 1, minWidth: 60, height: 48, border: '1.5px solid var(--border)', borderRadius: 6, textAlign: 'center', fontSize: '1rem', padding: '0 8px' }}
        />
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          placeholder="YY"
          value={yy}
          onChange={(e) => setYy(e.target.value.replace(/\D/g, ''))}
          style={{ flex: 1, minWidth: 60, height: 48, border: '1.5px solid var(--border)', borderRadius: 6, textAlign: 'center', fontSize: '1rem', padding: '0 8px' }}
        />
        <button
          onClick={check}
          style={{ flex: '1 1 100%', height: 48, background: 'var(--green)', color: '#fff', borderRadius: 6, fontWeight: 700, fontSize: '0.9rem' }}
        >
          CHECK
        </button>
      </div>
      {error && (
        <p style={{ marginTop: 8, color: 'var(--red)', fontSize: '0.85rem' }}>{error}</p>
      )}
      {result && (
        <p style={{ marginTop: 10, fontWeight: 700, fontSize: '0.9rem', color: RESULTS[result].color }}>
          {RESULTS[result].text}
        </p>
      )}
    </div>
  )
}
