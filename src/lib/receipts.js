// Image compression in the browser, plus the IndexedDB store used before accounts existed
// (stage 2): only read now, to import receipts saved on this device.

const DB_NAME = 'gastos'
const STORE = 'receipts'
const MAX_SIDE = 1280
const QUALITY = 0.72

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req.result)
    tx.onabort = () => reject(req.error ?? tx.error ?? new Error('Falló el guardado del ticket'))
  })
}

export function saveReceipt(id, blob) {
  return withStore('readwrite', (store) => store.add(blob, id))
}

export function getReceipt(id) {
  return withStore('readonly', (store) => store.get(id))
}

/**
 * Scales the photo down to `maxSide` and re-encodes it as JPEG.
 * `square: true` crops the centered square first (profile photos).
 */
export async function compressImage(file, { maxSide = MAX_SIDE, square = false } = {}) {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = square ? (bitmap.width - side) / 2 : 0
  const sy = square ? (bitmap.height - side) / 2 : 0
  const sw = square ? side : bitmap.width
  const sh = square ? side : bitmap.height
  const scale = Math.min(1, maxSide / Math.max(sw, sh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sw * scale)
  canvas.height = Math.round(sh * scale)
  canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la imagen'))), 'image/jpeg', QUALITY)
  })
}
