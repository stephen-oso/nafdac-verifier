const FALLBACK = "Do not dispense. Contact NAFDAC: +234 (0) 700-1-623322"

export default function NotFoundCard({ summary, closestMatches }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--red)', color: '#fff', padding: '16px 20px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', opacity: 0.9 }}>✕ NOT FOUND — POSSIBLE COUNTERFEIT</div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <p style={{ lineHeight: 1.6, marginBottom: closestMatches?.length ? 16 : 0 }}>
          {summary || FALLBACK}
        </p>
        {closestMatches?.length > 0 && (
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Closest matches in registry
            </p>
            <ul style={{ listStyle: 'none' }}>
              {closestMatches.map((m) => (
                <li key={m.reg_number} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                  {m.drug_name}
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{m.reg_number}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
