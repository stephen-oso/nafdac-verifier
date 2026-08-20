import { useEffect, useRef } from 'react'

const DEMO_REG = '04-2531' // Dizpharm Paracetamol — real NAFDAC number

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

const CAMERA_ERRORS = {
  permission: 'Camera access was denied. Allow camera in your browser settings, or type the drug name above.',
  'no-camera': 'No camera found on this device.',
  'load-fail': 'Scanner unavailable. Type the drug name or reg number above.',
}

function Viewfinder({ snapping }) {
  const color = snapping ? '#008751' : 'white'
  const b = `3px solid ${color}`
  const base = { position: 'absolute', width: 24, height: 24, transition: 'border-color 0.15s' }
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ ...base, top: 0, left: 0, borderTop: b, borderLeft: b }} />
      <div style={{ ...base, top: 0, right: 0, borderTop: b, borderRight: b }} />
      <div style={{ ...base, bottom: 0, left: 0, borderBottom: b, borderLeft: b }} />
      <div style={{ ...base, bottom: 0, right: 0, borderBottom: b, borderRight: b }} />
    </div>
  )
}

function ShutterButton({ onClick, snapping }) {
  return (
    <button
      onClick={onClick}
      disabled={snapping}
      aria-label="Capture barcode"
      style={{
        width: 68, height: 68, borderRadius: '50%',
        border: '4px solid white',
        background: snapping ? '#008751' : 'rgba(255,255,255,0.15)',
        cursor: snapping ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      {snapping ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
        </svg>
      ) : (
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'white' }} />
      )}
    </button>
  )
}

export default function BarcodeScanner({ startCamera, snap, snapping, error, onDecode, onClose }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (CAMERA_ERRORS[error] || !videoRef.current) return
    startCamera(videoRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSnap() {
    if (!videoRef.current) return
    snap(videoRef.current, (text) => {
      onDecode(text)
      onClose()
    })
  }

  function handleDemo() {
    onDecode(DEMO_REG)
    onClose()
  }

  const cameraError = CAMERA_ERRORS[error]

  return (
    <div style={OVERLAY} role="dialog" aria-modal="true" aria-label="Barcode scanner">
      <button style={CLOSE_BTN} onClick={onClose} aria-label="Close scanner">×</button>

      {cameraError ? (
        <div style={ERROR_BOX}>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55 }}>{cameraError}</p>
          <button
            style={{ padding: '10px 20px', background: '#008751', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}
            onClick={onClose}
          >
            Dismiss
          </button>
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
            <Viewfinder snapping={snapping} />
          </div>

          {error === 'no-barcode' && (
            <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>
              No barcode found — reframe and try again
            </p>
          )}

          {error !== 'no-barcode' && (
            <p style={{ color: '#fff', fontSize: '0.875rem', margin: 0, opacity: 0.85 }}>
              Frame the barcode, then tap the button
            </p>
          )}

          <ShutterButton onClick={handleSnap} snapping={snapping} />

          <button
            onClick={handleDemo}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem',
              padding: '8px 16px', borderRadius: 20, cursor: 'pointer',
            }}
          >
            No drug handy? Use demo number
          </button>
        </>
      )}
    </div>
  )
}
