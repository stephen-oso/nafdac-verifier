import { useState, useRef, useCallback } from 'react'

export function useBarcodeScanner() {
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState(null)
  const [snapping, setSnapping] = useState(false)
  const streamRef = useRef(null)

  const open = useCallback(() => {
    setError(null)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setIsOpen(false)
    setError(null)
    setSnapping(false)
  }, [])

  const startCamera = useCallback(async (videoEl) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      videoEl.srcObject = stream
      await videoEl.play()
      streamRef.current = stream
    } catch (err) {
      if (err?.name === 'NotAllowedError') setError('permission')
      else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') setError('no-camera')
      else setError('load-fail')
    }
  }, [])

  const snap = useCallback(async (videoEl, onDecode) => {
    if (snapping) return
    setError(null)
    setSnapping(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = videoEl.videoWidth || 640
      canvas.height = videoEl.videoHeight || 480
      canvas.getContext('2d').drawImage(videoEl, 0, 0)
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      const result = await reader.decodeFromCanvas(canvas)
      onDecode(result.getText())
    } catch {
      setError('no-barcode')
    } finally {
      setSnapping(false)
    }
  }, [snapping])

  return { isOpen, error, snapping, open, close, startCamera, snap }
}
