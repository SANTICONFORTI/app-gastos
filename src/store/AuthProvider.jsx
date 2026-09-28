import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

// Session + profile of the signed-in user.
// status: 'loading' | 'signed-out' | 'recovery' (came from a reset-password link) | 'signed-in'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [status, setStatus] = useState('loading')
  const [profileError, setProfileError] = useState(null)

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) {
      setProfileError(error)
      return null
    }
    setProfileError(null)
    setProfile(data)
    return data
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      if (active) setStatus((s) => (s === 'recovery' ? s : data.session ? 'signed-in' : 'signed-out'))
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('recovery')
        return
      }
      if (event === 'SIGNED_OUT' || !newSession) {
        setProfile(null)
        setStatus('signed-out')
        return
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Don't await inside the callback (supabase-js recommendation): defer the query.
        setTimeout(async () => {
          await loadProfile(newSession.user.id)
          setStatus((s) => (s === 'recovery' ? s : 'signed-in'))
        }, 0)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo(() => ({
    status,
    session,
    user: session?.user ?? null,
    profile,
    profileError,
    reloadProfile: () => (session ? loadProfile(session.user.id) : Promise.resolve(null)),
    finishRecovery: () => setStatus(session ? 'signed-in' : 'signed-out'),
    signOut: () => supabase.auth.signOut(),
  }), [status, session, profile, profileError, loadProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
