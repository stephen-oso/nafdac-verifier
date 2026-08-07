export default function Header({ onInfoClick }) {
  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--green)' }}>NAFDAC</span>
        <span style={{ fontWeight: 400, fontSize: '1.1rem', color: 'var(--text-primary)' }}> Drug Verifier</span>
      </div>
      <button
        onClick={onInfoClick}
        aria-label="About this tool"
        style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: 'var(--text-muted)' }}
      >
        ℹ
      </button>
    </header>
  )
}
