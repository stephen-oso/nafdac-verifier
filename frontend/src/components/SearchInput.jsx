import { useState, useEffect, useRef, useCallback } from 'react'
import { searchDrugs } from '../api'
import TypeaheadDropdown from './TypeaheadDropdown'
import BarcodeScanner from './BarcodeScanner'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'

const DEBOUNCE_MS = 300
const MIN_CHARS = 3

function ScanIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  )
}

export default function SearchInput({ onVerify, loading, mode }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const { isOpen, error, open, close, startDecoding } = useBarcodeScanner()

  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < MIN_CHARS) { setSuggestions([]); return }
    try {
      const data = await searchDrugs(q)
      setSuggestions(data.results ?? [])
      setShowSuggestions(true)
    } catch {
      setSuggestions([])
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(query), DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [query, fetchSuggestions])

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(name) {
    setQuery(name)
    setShowSuggestions(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!query.trim()) return
    setShowSuggestions(false)
    onVerify(query.trim())
  }

  function handleDecode(text) {
    setQuery(text)
    onVerify(text.trim())
  }

  return (
    <>
      {isOpen && (
        <BarcodeScanner
          startDecoding={startDecoding}
          error={error}
          onDecode={handleDecode}
          onClose={close}
        />
      )}

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder={mode === 'Community' ? 'Type the drug name on your pack' : 'Drug name or NAFDAC reg number'}
              autoComplete="off"
              style={{
                width: '100%',
                height: 52,
                padding: '0 48px 0 16px',
                fontSize: '1rem',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={open}
              aria-label="Scan barcode"
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 0,
              }}
            >
              <ScanIcon />
            </button>
            <TypeaheadDropdown
              results={suggestions}
              onSelect={handleSelect}
              visible={showSuggestions}
            />
          </div>
          <button
            type="submit"
            disabled={!query.trim() || loading}
            style={{
              height: 52,
              padding: '0 24px',
              background: 'var(--green)',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 'var(--radius)',
              opacity: (!query.trim() || loading) ? 0.6 : 1,
              whiteSpace: 'nowrap',
              minWidth: 90,
            }}
          >
            {loading ? '...' : 'Verify'}
          </button>
        </div>
      </form>
    </>
  )
}
