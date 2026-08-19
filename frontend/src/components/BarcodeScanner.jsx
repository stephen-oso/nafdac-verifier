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

const ERROR_MESSAGES = {
  permission: 'Camera access was denied. Allow camera in your browser settings, or type the drug name above.',
  'no-camera': 'No camera found on this device.',
  'load-fail': 'Scanner unavailable. Type the drug name or reg number above.',
}

function Viewfinder() {
  const b = '3px solid white'
  const base = { position: 'absolute', width: 24, height: 24 }
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ ...base, top: 0, left: 0, borderTop: b, borderLeft: b }} />
      <div style={{ ...base, top: 0, right: 0, borderTop: b, borderRight: b }} />
      <div style={{ ...base, bottom: 0, left: 0, borderBottom: b, borderLeft: b }} />
      <div style={{ ...base, bottom: 0, right: 0, borderBottom: b, borderRight: b }} />
    </div>
  )
}

export default function BarcodeScanner({ startDecoding, error, onDecode, onClose }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (error || !videoRef.current) return
    startDecoding(videoRef.current, (text) => {
      onDecode(text)
      onClose()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          <div style={{ position: 'relative', width: '100%', maxWidth: 360, padding: '0 20px', boxSizing: 'border-box' }}>
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
