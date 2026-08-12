import { useState } from 'react'
import VerifiedCard from './VerifiedCard'

const FALLBACK = "Multiple NAFDAC registrations found. Verify the exact product with your pharmacist or contact NAFDAC: 0800-162-3322";

export default function MultipleMatchesCard({ candidates, summary, mode }) {
  const [selected, setSelected] = useState(null)

  if (selected !== null) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          style={{ marginBottom: 12, color: 'var(--green)', fontWeight: 600, fontSize: '0.9rem', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ← Back to matches
        </button>
        <VerifiedCard drug={candidates[selected]} mode={mode} />
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--amber)', color: '#fff', padding: '16px 20px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', opacity: 0.9 }}>⚠ MULTIPLE MATCHES</div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <p style={{ lineHeight: 1.6, marginBottom: 16 }}>{summary ?? FALLBACK}</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Select the correct product
        </p>
        <ul style={{ listStyle: 'none' }}>
          {candidates.map((c, i) => (
            <li key={c.reg_number}>
              <button
                onClick={() => setSelected(i)}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                  background: 'none',
                  minHeight: 48,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontWeight: 500 }}>› {c.drug_name}</span>
                {c.manufacturer && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.manufacturer}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
