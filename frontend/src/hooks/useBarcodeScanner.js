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
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
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
