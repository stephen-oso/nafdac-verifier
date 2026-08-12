import { useState } from 'react'

const ITEMS = [
  'Packaging seal intact?',
  'Print sharp — no blurring or smudging?',
  'Lot number matches expiry label?',
  'Colour and smell normal for this drug?',
  'No signs of heat or smoke damage?',
]

export default function PhysicalChecklist({ defaultOpen = false, collapsible = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const [checked, setChecked] = useState(Array(ITEMS.length).fill(false))

  function toggle(i) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
  }

  const isOpen = collapsible ? open : true

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      {collapsible ? (
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            width: '100%',
            padding: '14px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            minHeight: 48,
            textAlign: 'left',
          }}
        >
          Physical inspection checklist
          <span style={{ fontSize: '1.1rem', fontWeight: 400 }}>{open ? '−' : '+'}</span>
        </button>
      ) : (
        <div
          style={{
            width: '100%',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            minHeight: 48,
          }}
        >
          Physical inspection checklist
        </div>
      )}

      {isOpen && (
        <div style={{ padding: '0 20px 16px' }}>
          {ITEMS.map((item, i) => (
            <label
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                borderBottom: i < ITEMS.length - 1 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                minHeight: 48,
              }}
            >
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                style={{ width: 20, height: 20, accentColor: 'var(--green)', flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>{item}</span>
            </label>
          ))}
          <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--red)', fontWeight: 600, lineHeight: 1.4 }}>
            If any box fails — do not dispense. Report below.
          </p>
        </div>
      )}
    </div>
  )
}
