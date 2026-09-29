// Draws a Wrapped slide as a 1080x1920 JPEG with the browser's canvas (no library, no server).

const W = 1080
const H = 1920
const PAD = 96
const FONT = "Manrope, -apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif"

const THEMES = {
  personal: { bg: '#0A1428', glow1: '#1B4C7C', glow2: '#0F2548', text2: '#A9B6CE' },
  group: { bg: '#0E1230', glow1: '#3D2F86', glow2: '#1D1B52', text2: '#C3C6E4' },
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Font size that makes `text` fit in `maxWidth` (starting at `size`). */
function fitSize(ctx, text, size, weight, maxWidth) {
  let s = size
  do {
    ctx.font = `${weight} ${s}px ${FONT}`
    if (ctx.measureText(text).width <= maxWidth) return s
    s -= 6
  } while (s > 40)
  return s
}

function hexAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export async function renderSlideImage(slide, space = 'personal') {
  if (document.fonts?.ready) await document.fonts.ready
  const theme = THEMES[space]
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Background: base color, the space's glow on top and a soft glow of the slide's accent.
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, W, H)
  let g = ctx.createRadialGradient(W / 2, -200, 0, W / 2, -200, 1500)
  g.addColorStop(0, theme.glow1)
  g.addColorStop(0.45, theme.glow2)
  g.addColorStop(1, hexAlpha(theme.bg, 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  g = ctx.createRadialGradient(W * 0.8, H * 0.78, 0, W * 0.8, H * 0.78, 900)
  g.addColorStop(0, hexAlpha(slide.accent, 0.28))
  g.addColorStop(1, hexAlpha(slide.accent, 0))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  ctx.textBaseline = 'alphabetic'
  let y = 420

  // Kicker
  ctx.fillStyle = slide.accent
  ctx.font = `800 40px ${FONT}`
  ctx.fillText(slide.kicker.toUpperCase(), PAD, y)
  y += 110

  // Title
  ctx.fillStyle = '#F2F5FA'
  ctx.font = `800 88px ${FONT}`
  for (const line of wrapLines(ctx, slide.title, W - PAD * 2).slice(0, 3)) {
    ctx.fillText(line, PAD, y)
    y += 104
  }

  // Big value
  if (slide.value) {
    y += 70
    const size = fitSize(ctx, slide.value, 170, 800, W - PAD * 2)
    ctx.font = `800 ${size}px ${FONT}`
    ctx.fillStyle = '#F2F5FA'
    ctx.fillText(slide.value, PAD, y + size * 0.3)
    y += size * 0.3 + 60
    ctx.fillStyle = slide.accent
    ctx.fillRect(PAD, y, 140, 10)
    y += 90
  } else {
    y += 40
  }

  // Lines
  ctx.font = `600 46px ${FONT}`
  ctx.fillStyle = theme.text2
  for (const text of slide.lines ?? []) {
    for (const line of wrapLines(ctx, text, W - PAD * 2).slice(0, 3)) {
      ctx.fillText(line, PAD, y)
      y += 62
    }
    y += 22
  }

  // List (ranking / bars)
  if (slide.list?.length) {
    y += 30
    const rowH = Math.min(96, (1640 - y) / slide.list.length)
    for (const item of slide.list) {
      ctx.fillStyle = item.color ?? slide.accent
      ctx.beginPath()
      ctx.arc(PAD + 14, y - 14, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#F2F5FA'
      ctx.font = `700 44px ${FONT}`
      ctx.fillText(item.label, PAD + 48, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = theme.text2
      ctx.fillText(item.value, W - PAD, y)
      ctx.textAlign = 'left'
      if (item.bar !== undefined) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)'
        ctx.fillRect(PAD + 48, y + 18, W - PAD * 2 - 48, 10)
        ctx.fillStyle = item.color ?? slide.accent
        ctx.fillRect(PAD + 48, y + 18, (W - PAD * 2 - 48) * Math.max(0.02, item.bar), 10)
      }
      y += rowH
    }
  }

  // Brand, small at the bottom.
  const by = H - 150
  ctx.fillStyle = slide.accent
  ctx.beginPath()
  ctx.arc(W / 2 - 92, by - 16, 32, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = theme.bg
  ctx.font = `800 38px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('$', W / 2 - 92, by - 2)
  ctx.fillStyle = '#F2F5FA'
  ctx.font = `800 48px ${FONT}`
  ctx.fillText('Puly', W / 2 + 10, by)
  ctx.fillStyle = theme.text2
  ctx.font = `600 32px ${FONT}`
  ctx.fillText('puly.vercel.app', W / 2, by + 60)
  ctx.textAlign = 'left'

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/jpeg', 0.92))
}

/** Shares the image (Web Share API) or downloads it if sharing files isn't supported. */
export async function shareOrDownload(blob, fileName, title) {
  const file = new File([blob], fileName, { type: 'image/jpeg' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  download(blob, fileName)
  return 'downloaded'
}

export function download(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
