const s = {
  section: { marginTop: 20 },
  heading: { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 },
  body: { lineHeight: 1.7, color: 'var(--text-primary)', fontSize: '0.875rem' },
  li: { display: 'flex', gap: 8, marginBottom: 6, fontSize: '0.875rem', lineHeight: 1.6 },
  bullet: { flexShrink: 0, color: 'var(--text-muted)' },
  note: { background: '#fef9ec', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 12px', fontSize: '0.8rem', lineHeight: 1.6, color: '#92400e', marginTop: 8 },
}

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
        style={{ background: 'var(--bg)', width: '100%', maxWidth: 360, padding: 24, margin: '60px 0 0 0', borderRadius: '12px 0 0 12px', boxShadow: 'var(--shadow)', overflowY: 'auto', maxHeight: 'calc(100dvh - 60px)' }}
      >
        <button onClick={onClose} style={{ float: 'right', fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</button>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>About</h2>

        <p style={s.body}>
          NAFDAC (National Agency for Food and Drug Administration and Control) is the Nigerian federal agency that regulates drugs entering the market. Every legitimate drug sold in Nigeria must carry a NAFDAC registration number issued only after the actual product passes testing — a process that takes years and costs money.
          {scrapeDate && <> Database last updated: <strong>{scrapeDate}</strong>.</>}
        </p>

        <div style={s.section}>
          <div style={s.heading}>What this app catches</div>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={s.li}><span style={s.bullet}>→</span><span>Drugs with a <strong>completely made-up</strong> registration number — returns NOT FOUND</span></li>
            <li style={s.li}><span style={s.bullet}>→</span><span>Drugs with <strong>no reg. number</strong> on the packaging — NOT FOUND or the real manufacturer won't match</span></li>
            <li style={s.li}><span style={s.bullet}>→</span><span>Drugs that <strong>copy a real reg. number</strong> belonging to a different product — the result will show a different drug name or manufacturer than what's on the box</span></li>
          </ul>
          <p style={{ ...s.body, marginTop: 6, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Most Nigerian drug counterfeiting is opportunistic — fake packaging with invented numbers, wrong numbers, or numbers belonging to a different drug entirely. This app catches all of those cases instantly.
          </p>
        </div>

        <div style={s.section}>
          <div style={s.heading}>Limitations</div>
          <div style={s.note}>
            ⚠ A sophisticated counterfeiter who copies both the correct drug name <em>and</em> the correct reg. number onto fake packaging will return VERIFIED — the data matches, but the pills inside may still be fake. This app cannot detect that case. When in doubt, only purchase from licensed wholesalers and report suspicious products to NAFDAC.
          </div>
          <p style={{ ...s.body, marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Drugs not yet in the NAFDAC database (recently approved) will also return NOT FOUND even if genuine.
          </p>
        </div>

        <p style={{ marginTop: 20, fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          Questions? Contact NAFDAC: +234 (0) 700-1-623322
        </p>
      </div>
    </div>
  )
}
