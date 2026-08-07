import { useState, useEffect, useRef, useCallback } from 'react'
import { searchDrugs } from '../api'
import TypeaheadDropdown from './TypeaheadDropdown'

const DEBOUNCE_MS = 300
const MIN_CHARS = 3

export default function SearchInput({ onVerify, loading }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)

  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < MIN_CHARS) { setSuggestions([]); return }
    const data = await searchDrugs(q)
    setSuggestions(data.results ?? [])
    setShowSuggestions(true)
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

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Drug name or NAFDAC reg. number"
            autoComplete="off"
            style={{
              width: '100%',
              height: 52,
              padding: '0 16px',
              fontSize: '1rem',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius)',
              outline: 'none',
            }}
          />
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
  )
}
