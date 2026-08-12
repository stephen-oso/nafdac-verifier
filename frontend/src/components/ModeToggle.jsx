export default function ModeToggle({ mode, onModeChange }) {
  return (
    <div style={{
      display: 'flex',
      gap: 3,
      background: 'var(--surface)',
      borderRadius: 6,
      padding: 3,
      border: '1px solid var(--border)',
    }}>
      {['Pharmacist', 'Community'].map((m) => (
        <button
          key={m}
          onClick={() => onModeChange(m)}
          aria-pressed={mode === m}
          style={{
            padding: '5px 9px',
            borderRadius: 4,
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.03em',
            background: mode === m ? 'var(--green)' : 'transparent',
            color: mode === m ? '#fff' : 'var(--text-muted)',
            minHeight: 32,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {m}
        </button>
      ))}
    </div>
  )
}
