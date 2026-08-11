import { useState } from 'react'

const LS_KEY = 'nafdac_strip_dismissed'

const COPY = {
  Pharmacist: {
    stats: '1 in 10 medicines may be counterfeit (WHO) · ~169K child deaths/yr from fake drugs (Lancet, 2018)',
    cta: 'Verify every drug. Every time.',
  },
  Community: {
    stats: 'Fake drugs are common in Nigeria. Always verify before you take.',
    cta: 'Your life depends on it.',
  },
}

export default function StatsStrip({ mode }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(LS_KEY) === 'true'
  )

  if (dismissed) return null

  function dismiss() {
    localStorage.setItem(LS_KEY, 'true')
    setDismissed(true)
  }

  const { stats, cta } = COPY[mode] ?? COPY.Pharmacist

  return (
    <div style={{
      background: '#f0fdf4',
      borderBottom: '1px solid #bbf7d0',
      padding: '10px 16px 10px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
    }}>
      <p style={{ flex: 1, margin: 0, fontSize: '0.78rem', lineHeight: 1.55, color: 'var(--text-primary)' }}>
        {stats}{' '}
        <strong style={{ color: 'var(--green)' }}>{cta}</strong>
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          color: 'var(--text-muted)',
          fontSize: '1.1rem',
          minHeight: 44,
          minWidth: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ×
      </button>
    </div>
  )
}
