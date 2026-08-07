export default function AboutPanel({ visible, onClose, scrapeDate }) {
  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg)', width: '100%', maxWidth: 360, padding: 24, margin: '60px 0 0 0', borderRadius: '12px 0 0 12px', boxShadow: 'var(--shadow)' }}
      >
        <button onClick={onClose} style={{ float: 'right', fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>About</h2>
        <p style={{ lineHeight: 1.7, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
          NAFDAC (National Agency for Food and Drug Administration and Control) is the Nigerian federal agency responsible for regulating and controlling the manufacture, importation, and distribution of drugs. This tool lets pharmacists instantly verify whether a product is in the NAFDAC registry by name or registration number. Data is sourced from the public NAFDAC Greenbook.
          {scrapeDate && <> Database last updated: <strong>{scrapeDate}</strong>.</>}
        </p>
        <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Questions? Contact NAFDAC: +234 (0) 700-1-623322
        </p>
      </div>
    </div>
  )
}
