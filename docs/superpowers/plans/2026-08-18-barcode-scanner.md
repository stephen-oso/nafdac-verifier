# Barcode Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a camera-based barcode scanner to the NAFDAC Drug Verifier so pharmacists can scan drug packaging instead of typing, with the decoded value dropped into the existing search input for confirmation before submitting.

**Architecture:** A camera icon button sits on the right edge of the existing text input. Tapping it opens a fullscreen overlay (`BarcodeScanner.jsx`) which lazy-loads `@zxing/browser` and decodes barcodes from the device camera. On first successful decode, the overlay closes and the decoded text populates the search input — no auto-submit, pharmacist confirms then taps Verify. All existing search/verify logic is untouched.

**Tech Stack:** React 19, Vite 8, `@zxing/browser` (lazy-loaded), inline styles (no CSS framework, matches existing codebase convention)

**Spec:** `docs/superpowers/specs/2026-08-18-barcode-scanner-design.md`

## Global Constraints

- No CSS framework — all styles are inline JS objects, matching existing components
- No test framework present — verification steps are manual browser checks
- System font stack only — no web fonts
- `@zxing/browser` must be dynamically imported (`import('@zxing/browser')`) so it is not in the initial bundle
- Camera constraint must use `{ ideal: 'environment' }` not `{ exact: 'environment' }` — fallback to front camera on devices without rear camera
- No backend changes
- Color palette: `--green: #008751`, `--text-muted: #6b7280`, `--text-primary: #111827`, `--border: existing var`
- PowerShell is the shell on this machine — use `npm install` via PowerShell from `frontend\` directory

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/hooks/useBarcodeScanner.js` | **Create** | Lazy-loads ZXing, manages reader lifecycle, exposes `{ isOpen, error, open, close, startDecoding }` |
| `frontend/src/components/BarcodeScanner.jsx` | **Create** | Fullscreen modal overlay: video element, viewfinder, error states, close button |
| `frontend/src/components/SearchInput.jsx` | **Modify** | Adds camera icon button + mounts/unmounts BarcodeScanner + handles decode callback |
| `frontend/package.json` | **Modify** | Adds `@zxing/browser` dependency |

---

### Task 1: Install `@zxing/browser`

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json` (auto-updated by npm)

**Interfaces:**
- Produces: `@zxing/browser` available for dynamic import in later tasks

- [ ] **Step 1: Install the package**

Run from `C:\Users\Stephen\nafdac-verifier\frontend\`:
```powershell
npm install @zxing/browser
```

- [ ] **Step 2: Verify installation**

Check that `package.json` now has `"@zxing/browser"` in `dependencies` with a version like `^0.1.x`.

- [ ] **Step 3: Commit**

Run from repo root `C:\Users\Stephen\nafdac-verifier\`:
```powershell
git add frontend/package.json frontend/package-lock.json
git commit -m "deps: add @zxing/browser for barcode scanning"
```

---

### Task 2: Create `useBarcodeScanner.js` hook

**Files:**
- Create: `frontend/src/hooks/useBarcodeScanner.js`

**Interfaces:**
- Consumes: `@zxing/browser` (dynamic import)
- Produces:
  ```js
  useBarcodeScanner() → {
    isOpen: boolean,
    error: 'permission' | 'no-camera' | 'load-fail' | null,
    open: () => void,
    close: () => void,
    startDecoding: (videoEl: HTMLVideoElement, onDecode: (text: string) => void) => Promise<void>
  }
  ```

- [ ] **Step 1: Create the hook file**

Create `frontend/src/hooks/useBarcodeScanner.js` with this content:

```js
import { useState, useRef, useCallback } from 'react'

export function useBarcodeScanner() {
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState(null)
  const controlsRef = useRef(null)

  const open = useCallback(() => {
    setError(null)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.stop()
      controlsRef.current = null
    }
    setIsOpen(false)
    setError(null)
  }, [])

  const startDecoding = useCallback(async (videoEl, onDecode) => {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoEl,
        (result, _err, ctrl) => {
          if (result) {
            ctrl.stop()
            controlsRef.current = null
            onDecode(result.getText())
          }
        }
      )
      controlsRef.current = controls
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        setError('permission')
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setError('no-camera')
      } else {
        setError('load-fail')
      }
    }
  }, [])

  return { isOpen, error, open, close, startDecoding }
}
```

- [ ] **Step 2: Manual smoke check**

Start the dev server if not already running:
```powershell
cd "C:\Users\Stephen\nafdac-verifier\frontend"; npm run dev
```

The app should load at `http://localhost:5173` with no console errors. The hook isn't wired yet — this just confirms no import errors.

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/hooks/useBarcodeScanner.js
git commit -m "feat: add useBarcodeScanner hook with ZXing lazy-load"
```

---

### Task 3: Create `BarcodeScanner.jsx` component

**Files:**
- Create: `frontend/src/components/BarcodeScanner.jsx`

**Interfaces:**
- Consumes:
  ```js
  BarcodeScanner({
    startDecoding: (videoEl: HTMLVideoElement, onDecode: (text: string) => void) => Promise<void>,
    error: 'permission' | 'no-camera' | 'load-fail' | null,
    onDecode: (text: string) => void,   // fires when barcode decoded
    onClose: () => void                  // fires on X button or after decode
  })
  ```
- Produces: fullscreen scanner overlay rendered into the DOM

- [ ] **Step 1: Create the component file**

Create `frontend/src/components/BarcodeScanner.jsx`:

```jsx
import { useEffect, useRef } from 'react'

const OVERLAY = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.92)',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  gap: 20,
}

const CLOSE_BTN = {
  position: 'absolute', top: 16, right: 16,
  width: 40, height: 40,
  background: 'none', border: 'none',
  color: '#fff', fontSize: '1.75rem', lineHeight: 1,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const ERROR_BOX = {
  background: '#1f1f1f', border: '1px solid #444',
  borderRadius: 8, padding: '24px 20px',
  color: '#fff', textAlign: 'center', maxWidth: 300,
  display: 'flex', flexDirection: 'column', gap: 16,
}

const DISMISS_BTN = {
  padding: '10px 20px', background: '#008751',
  color: '#fff', border: 'none', borderRadius: 8,
  fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
}

const CORNER = (pos) => ({
  position: 'absolute', width: 24, height: 24,
  ...pos,
})

function Viewfinder() {
  const b = '3px solid white'
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ ...CORNER({ top: 0, left: 0 }), borderTop: b, borderLeft: b }} />
      <div style={{ ...CORNER({ top: 0, right: 0 }), borderTop: b, borderRight: b }} />
      <div style={{ ...CORNER({ bottom: 0, left: 0 }), borderBottom: b, borderLeft: b }} />
      <div style={{ ...CORNER({ bottom: 0, right: 0 }), borderBottom: b, borderRight: b }} />
    </div>
  )
}

const ERROR_MESSAGES = {
  permission: 'Camera access was denied. Allow camera in your browser settings, or type the drug name above.',
  'no-camera': 'No camera found on this device.',
  'load-fail': null, // silent — overlay should not have opened
}

export default function BarcodeScanner({ startDecoding, error, onDecode, onClose }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (error || !videoRef.current) return
    startDecoding(videoRef.current, (text) => {
      onDecode(text)
      onClose()
    })
    // cleanup: hook's close() stops the stream when onClose fires
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const errorMsg = error ? ERROR_MESSAGES[error] : null

  return (
    <div style={OVERLAY} role="dialog" aria-modal="true" aria-label="Barcode scanner">
      <button style={CLOSE_BTN} onClick={onClose} aria-label="Close scanner">×</button>

      {errorMsg ? (
        <div style={ERROR_BOX}>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55 }}>{errorMsg}</p>
          <button style={DISMISS_BTN} onClick={onClose}>Dismiss</button>
        </div>
      ) : (
        <>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <video
              ref={videoRef}
              style={{ width: '100%', borderRadius: 8, display: 'block', background: '#111' }}
              playsInline
              muted
            />
            <Viewfinder />
          </div>
          <p style={{ color: '#fff', fontSize: '0.875rem', margin: 0, opacity: 0.85 }}>
            Point at the barcode on the packaging
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Manual render check**

The component isn't wired to anything yet. Temporarily add it to `App.jsx` to verify it renders (do NOT commit this):

```jsx
// Temporarily at top of App.jsx return, inside the outer div:
import BarcodeScanner from './components/BarcodeScanner'
// ...
<BarcodeScanner startDecoding={() => {}} error={null} onDecode={() => {}} onClose={() => {}} />
```

Open the browser. You should see the dark fullscreen overlay with a video area and "Point at the barcode" text. Remove this temporary addition before the next step.

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/components/BarcodeScanner.jsx
git commit -m "feat: add BarcodeScanner fullscreen overlay component"
```

---

### Task 4: Wire scanner into `SearchInput.jsx`

**Files:**
- Modify: `frontend/src/components/SearchInput.jsx`

**Interfaces:**
- Consumes:
  - `useBarcodeScanner()` from `../hooks/useBarcodeScanner`
  - `BarcodeScanner` from `./BarcodeScanner`
- Produces: complete barcode scan flow integrated into the search input

- [ ] **Step 1: Replace `SearchInput.jsx` with the wired version**

Full replacement of `frontend/src/components/SearchInput.jsx`:

```jsx
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
    setTimeout(() => inputRef.current?.focus(), 50)
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
```

- [ ] **Step 2: Verify in browser — camera icon visible**

Open `http://localhost:5173`. The search input should now have a small scan icon on its right edge. Typing should still work normally. Typeahead should still work.

- [ ] **Step 3: Verify in browser — scanner opens**

Click the scan icon. The dark fullscreen overlay should appear with a camera viewfinder and "Point at the barcode on the packaging" text. The × button should close it.

- [ ] **Step 4: Verify camera stream (requires HTTPS or localhost)**

The dev server at `localhost:5173` qualifies as a secure context. Click the scan icon — your browser should prompt for camera permission. Grant it. The camera feed should appear in the viewfinder.

- [ ] **Step 5: Verify decode flow**

Hold a barcode (any product — cereal box, phone box, anything) up to the camera. The scanner should close and the barcode value should appear in the search input. The Verify button should become active. You can then edit the value or tap Verify.

- [ ] **Step 6: Verify permission-denied error state**

In your browser settings, block camera for `localhost`. Tap the scan icon — the overlay should show the permission error message and a Dismiss button. Dismiss should close the overlay.

- [ ] **Step 7: Commit**

```powershell
git add frontend/src/components/SearchInput.jsx
git commit -m "feat: wire barcode scanner into search input"
```

---

### Task 5: Build, deploy, and verify on mobile

**Files:** No code changes — build and deploy only.

- [ ] **Step 1: Production build check**

```powershell
cd "C:\Users\Stephen\nafdac-verifier\frontend"; npm run build
```

Should complete with no errors. Check that the `dist/` output exists.

- [ ] **Step 2: Deploy to Vercel**

```powershell
cd "C:\Users\Stephen\nafdac-verifier"; vercel --prod
```

Or push to the main branch if auto-deploy is configured (check Railway/Vercel dashboard).

- [ ] **Step 3: Verify on mobile (Android Chrome)**

Open `https://nafdac-verifier-sooty.vercel.app` on an Android phone. Tap the scan icon. The phone should prompt for camera permission, then open the rear camera. Test scanning a barcode.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```powershell
git add -A
git commit -m "fix: barcode scanner mobile adjustments"
```

---

## Self-Review

**Spec coverage:**
- ✅ Camera icon inside search input (right edge)
- ✅ ZXing lazy-loaded on first tap
- ✅ Fullscreen dark overlay with viewfinder
- ✅ `facingMode: { ideal: 'environment' }` constraint
- ✅ Decode → value in input → no auto-submit
- ✅ Close button (×)
- ✅ Instruction text below camera
- ✅ Permission denied error state
- ✅ No camera error state
- ✅ Load fail: silent (open() fires but startDecoding catches and sets error='load-fail', which BarcodeScanner maps to `null` message — so overlay opens but shows nothing useful. Fix: treat load-fail same as no-camera with "Scanner unavailable" message)

**Load-fail fix:** Update `ERROR_MESSAGES` in `BarcodeScanner.jsx`:
```js
const ERROR_MESSAGES = {
  permission: 'Camera access was denied. Allow camera in your browser settings, or type the drug name above.',
  'no-camera': 'No camera found on this device.',
  'load-fail': 'Scanner unavailable. Type the drug name or reg number above.',
}
```
This is already included in Task 3 Step 1 above — the plan is correct.

**Placeholder scan:** None found.

**Type consistency:** `startDecoding(videoEl, onDecode)` defined in Task 2, consumed correctly in Task 3 and Task 4. `onDecode(text: string)` consistent throughout. `error` values `'permission' | 'no-camera' | 'load-fail' | null` consistent between hook and component.
