// Receipt photos: compressed in the browser and stored in IndexedDB
// (localStorage is too small for images). Receipts are never replaced or deleted.

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

/** Scales the photo down to MAX_SIDE and re-encodes it as JPEG. */
export async function compressImage(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la imagen'))), 'image/jpeg', QUALITY)
  })
}
