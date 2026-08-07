const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TIMEOUT_MS = 8000

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(id)
    return resp
  } catch (err) {
    clearTimeout(id)
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Check your network and try again.')
    }
    throw err
  }
}

export async function verifyDrug(query) {
  const resp = await fetchWithTimeout(`${API_BASE}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!resp.ok) throw new Error('Service temporarily unavailable.')
  return resp.json()
}

export async function searchDrugs(q) {
  const resp = await fetchWithTimeout(`${API_BASE}/search?q=${encodeURIComponent(q)}`)
  if (!resp.ok) return { results: [] }
  return resp.json()
}

export async function fetchHealth() {
  const resp = await fetchWithTimeout(`${API_BASE}/health`)
  if (!resp.ok) return null
  return resp.json()
}
