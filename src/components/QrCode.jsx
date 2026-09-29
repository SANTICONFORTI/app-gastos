import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

/** QR code drawn in the browser as SVG (no external service). */
export default function QrCode({ value, size = 200, label }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const count = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
      }
    }
    return { d, count }
  }, [value])

  const margin = 2
  const box = path.count + margin * 2
  return (
    <svg
      className="qr"
      width={size}
      height={size}
      viewBox={`${-margin} ${-margin} ${box} ${box}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect x={-margin} y={-margin} width={box} height={box} fill="#fff" />
      <path d={path.d} fill="#0E1230" />
    </svg>
  )
}
