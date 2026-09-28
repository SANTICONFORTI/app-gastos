import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const LINK_SECONDS = 60 * 60

/** Temporary private link to show a stored receipt photo (the receipts bucket is private). */
export default function useReceiptUrl(path) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    setUrl(null)
    if (!path) return
    let cancelled = false
    supabase.storage.from('receipts').createSignedUrl(path, LINK_SECONDS).then(({ data }) => {
      if (!cancelled && data?.signedUrl) setUrl(data.signedUrl)
    })
    return () => { cancelled = true }
  }, [path])

  return url
}
