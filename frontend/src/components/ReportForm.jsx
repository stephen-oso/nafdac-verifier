import { useState } from 'react'
import { submitReport } from '../api'

const FIELDS = [
  { key: 'drug_query',    label: 'Drug name',                      placeholder: 'Drug name',        required: true },
  { key: 'manufacturer',  label: 'Manufacturer (optional)',         placeholder: 'As printed on pack' },
  { key: 'batch_number',  label: 'Batch number (optional)',         placeholder: 'From pack label' },
  { key: 'expiry_date',   label: 'Expiry date (optional)',          placeholder: 'MM/YY' },
]

export default function ReportForm({ drugQuery, closestMatch, mode }) {
  const [fields, setFields] = useState({
    drug_query:   drugQuery || '',
    manufacturer: '',
    batch_number: '',
    expiry_date:  '',
    location:     '',
    observation:  '',
  })
  const [loading, setLoading] = useState(false)
  const [ref, setRef] = useState(null)
  const [error, setError] = useState('')

  function update(key, value) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  async function submit() {
    if (!fields.drug_query.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await submitReport({ ...fields, closest_match: closestMatch || null })
      setRef(res.ref)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (ref) {
    return (
      <div style={{ padding: '16px 20px', background: '#f0fdf4', borderTop: '1px solid #bbf7d0' }}>
        <p style={{ fontWeight: 700, color: 'var(--green)', fontSize: '0.9rem', margin: 0 }}>
          Report #{ref} sent to NAFDAC.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
          Reference this number if you follow up.
        </p>
      </div>
    )
  }

  const buttonLabel = mode === 'Community' ? 'FLAG THIS DRUG AS SUSPICIOUS' : 'SEND REPORT TO NAFDAC'
  const sectionLabel = mode === 'Community' ? 'Flag this drug as suspicious' : 'Report to NAFDAC'

  return (
    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
      <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 14 }}>
        {sectionLabel}
      </p>

      {FIELDS.map(({ key, label, placeholder }) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            {label}
          </label>
          <input
            type="text"
            placeholder={placeholder}
            value={fields[key]}
            onChange={(e) => update(key, e.target.value)}
            style={{ width: '100%', height: 48, border: '1.5px solid var(--border)', borderRadius: 6, padding: '0 12px', fontSize: '0.9rem', fontFamily: 'inherit' }}
          />
        </div>
      ))}

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          What did you observe? (optional)
        </label>
        <textarea
          placeholder="Describe what seemed wrong with this drug..."
          value={fields.observation}
          onChange={(e) => update('observation', e.target.value.slice(0, 280))}
          rows={3}
          style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
        />
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', margin: '2px 0 0' }}>
          {fields.observation.length}/280
        </p>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
          Your location (optional)
        </label>
        <input
          type="text"
          placeholder="e.g. Lagos Island"
          value={fields.location}
          onChange={(e) => update('location', e.target.value)}
          style={{ width: '100%', height: 48, border: '1.5px solid var(--border)', borderRadius: 6, padding: '0 12px', fontSize: '0.9rem', fontFamily: 'inherit' }}
        />
      </div>

      {error && (
        <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 10 }}>{error}</p>
      )}

      <button
        onClick={submit}
        disabled={!fields.drug_query.trim() || loading}
        style={{
          width: '100%',
          height: 52,
          background: fields.drug_query.trim() && !loading ? 'var(--green)' : '#9ca3af',
          color: '#fff',
          borderRadius: 6,
          fontWeight: 700,
          fontSize: '0.9rem',
          letterSpacing: '0.03em',
        }}
      >
        {loading ? 'Sending…' : buttonLabel}
      </button>
    </div>
  )
}
