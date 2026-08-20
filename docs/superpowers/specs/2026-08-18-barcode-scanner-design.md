# Barcode Scanner — Design Spec
_NAFDAC Drug Verifier · 2026-08-18_

## Goal

Let pharmacists scan a drug's barcode instead of typing. The decoded value drops into the existing search input; the pharmacist confirms (and edits if needed) before tapping Verify. No backend changes.

## Approach

**ZXing-js, lazy-loaded.** `@zxing/browser` handles all barcode formats (EAN-13, QR, Code128, DataMatrix, etc.) across Android Chrome and iOS Safari. It is loaded dynamically only when the pharmacist first taps the camera icon — zero cost to initial page load.

## Architecture

Two new files:

- `src/components/BarcodeScanner.jsx` — fullscreen modal overlay; owns video element and viewfinder UI; receives ZXing reader instance; fires `onDecode(string)` on first successful scan; unmounts camera on close
- `src/hooks/useBarcodeScanner.js` — lazy-loads ZXing, manages `BrowserMultiFormatReader` lifecycle, exposes `{ isOpen, open, close, error, startDecoding }`

One modified file:

- `src/components/SearchInput.jsx` — adds camera icon button on right edge of input; mounts `BarcodeScanner` when open; on decode: closes scanner, populates `query` state

## Data Flow

```
tap camera icon
  → useBarcodeScanner.open()
  → BarcodeScanner mounts
  → ZXing lazy-loads (first time only)
  → getUserMedia({ video: { facingMode: 'environment' } })
  → camera stream attached to <video> element
  → BrowserMultiFormatReader.decodeFromVideoDevice() polls frames
  → first successful decode → onDecode(text) fires
  → BarcodeScanner unmounts, stream stopped
  → query state = decoded text
  → input focused, pharmacist reviews/edits
  → taps Verify → existing verifyDrug() pipeline runs unchanged
```

## UI

**Camera icon:** SVG barcode-scan icon, 20×20px, positioned absolutely on the right edge of the text input (right: 12px, vertically centered). Input right padding increases from 16px to 48px to avoid text overlap. Icon color: `var(--text-muted)`; hover: `var(--text-primary)`.

**Scanner overlay:**
- `position: fixed; inset: 0; z-index: 1000`
- Background: `rgba(0,0,0,0.92)`
- Camera feed: `<video>` centered, `max-width: 100%; max-height: 70vh; border-radius: 8px`
- Viewfinder: CSS-only corner brackets (4 divs, 24px arms, 3px thick, white) overlaid on the video using `position: absolute`
- Instruction text: "Point at the barcode on the packaging" — white, 0.875rem, below the video
- Close button: "×" top-right corner, white, 32px tap target

**After decode:** scanner disappears, decoded text is in the input, input is focused. No auto-submit — pharmacist must tap Verify.

## Error States

| State | Message | Action |
|---|---|---|
| Permission denied | "Camera access was denied. Allow camera in your browser settings, or type the drug name above." | Dismiss button |
| No camera device | "No camera found on this device." | Dismiss button |
| ZXing fails to load | Silent — icon simply does nothing; fallback to typing | — |
| Scan timeout (>30s no decode) | No timeout implemented — pharmacist closes manually | — |

## Camera Constraints

```js
{ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }
```

`ideal` not `exact` — falls back gracefully if rear camera unavailable (desktop, front-only devices).

## Spec Self-Review

- No TBDs or placeholders
- No backend changes, no new API endpoints
- Scope is narrow: one input mechanism added, existing pipeline untouched
- ZXing reader must be `.reset()` on component unmount to release the camera — this is the main gotcha
