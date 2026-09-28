import { useEffect, useState } from 'react'
import { getReceipt } from '../lib/receipts'

/** Temporary URL to show a stored receipt photo in an <img>. */
export default function useReceiptUrl(receiptId) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!receiptId) {
      setUrl(null)
      return
    }
    let objectUrl = null
    let cancelled = false
    getReceipt(receiptId)
      .then((blob) => {
        if (blob && !cancelled) {
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [receiptId])

  return url
}
