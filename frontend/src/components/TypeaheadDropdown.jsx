export default function TypeaheadDropdown({ results, onSelect, visible }) {
  if (!visible || results.length === 0) return null

  return (
    <ul style={{
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      zIndex: 10,
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderTop: 'none',
      borderRadius: '0 0 var(--radius) var(--radius)',
      maxHeight: 240,
      overflowY: 'auto',
      listStyle: 'none',
      boxShadow: 'var(--shadow)',
    }}>
      {results.map((r) => (
        <li key={r.reg_number}>
          <button
            type="button"
            onClick={() => onSelect(r.drug_name)}
            style={{
              width: '100%',
              padding: '12px 16px',
              textAlign: 'left',
              minHeight: 48,
              borderBottom: '1px solid var(--border)',
              background: 'none',
              fontSize: '0.95rem',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
          >
            <span style={{ fontWeight: 500 }}>{r.drug_name}</span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.8rem' }}>
              {r.reg_number}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
