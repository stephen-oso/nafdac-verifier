import ModeToggle from './ModeToggle'

export default function Header({ onInfoClick, mode, onModeChange }) {
  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 20px',
      borderBottom: '1px solid var(--border)',
      gap: 8,
    }}>
      <div style={{ flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--green)' }}>NAFDAC</span>
        <span style={{ fontWeight: 400, fontSize: '1.05rem', color: 'var(--text-primary)' }}> Verifier</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <ModeToggle mode={mode} onModeChange={onModeChange} />
        <button
          onClick={onInfoClick}
          aria-label="About this tool"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '1.5px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            color: 'var(--text-muted)',
          }}
        >
          ℹ
        </button>
      </div>
    </header>
  )
}
