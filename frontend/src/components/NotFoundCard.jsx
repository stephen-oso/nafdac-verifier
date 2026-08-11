import PhysicalChecklist from './PhysicalChecklist'
import ReportForm from './ReportForm'

const FALLBACK_PHARMACIST = 'Do not dispense. Contact NAFDAC: 0800-162-3322'
const FALLBACK_COMMUNITY = 'This drug was not found in the official NAFDAC database. It may be fake or harmful. Do not take it.'

export default function NotFoundCard({ summary, closestMatches, mode, query, closestMatch }) {
  const isCommunity = mode === 'Community'

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--red)', color: '#fff', padding: '16px 20px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', opacity: 0.9 }}>
          {isCommunity ? '⚠ WARNING — DO NOT TAKE THIS DRUG' : '✕ NOT FOUND — POSSIBLE COUNTERFEIT'}
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <p style={{ lineHeight: 1.6, marginBottom: closestMatches?.length ? 16 : 0 }}>
          {isCommunity
            ? FALLBACK_COMMUNITY
            : (summary || FALLBACK_PHARMACIST)}
        </p>

        {!isCommunity && closestMatches?.length > 0 && (
          <div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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

        {isCommunity && (
          <p style={{ marginTop: 12, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Need help? Call NAFDAC: <strong style={{ color: 'var(--text-primary)' }}>0800-162-3322</strong> (toll-free)
          </p>
        )}
      </div>

      <PhysicalChecklist defaultOpen={isCommunity} />

      <ReportForm
        drugQuery={query}
        closestMatch={closestMatch}
        mode={mode}
      />
    </div>
  )
}
