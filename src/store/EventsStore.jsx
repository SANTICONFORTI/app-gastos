import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

// Events I can see (group events of my groups, standalone ones I created or take part in).
// Rules live in the database; this store loads everything with one query and refreshes in realtime.

const EVENT_FIELDS = `*,
  participants:event_participants(*, profile:profiles!event_participants_user_id_fkey(id, display_name, username, avatar_url, alias_cvu)),
  expenses:event_expenses(*),
  payments:event_payments(*)`

const EventsContext = createContext(null)

const randomToken = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function EventsStoreProvider({ children }) {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [status, setStatus] = useState('loading')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('events').select(EVENT_FIELDS).order('event_date', { ascending: false })
    if (error) {
      setStatus((s) => (s === 'ready' ? s : 'error'))
      return
    }
    for (const ev of data) {
      ev.participants.sort((a, b) => a.created_at.localeCompare(b.created_at))
      ev.expenses.sort((a, b) => b.spent_at.localeCompare(a.spent_at))
      ev.payments.sort((a, b) => b.created_at.localeCompare(a.created_at))
    }
    setEvents(data)
    setStatus('ready')
  }, [])

  useEffect(() => {
    load()
    let timer = null
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(load, 300)
    }
    const channel = supabase.channel(`eventos:${user.id}`)
    for (const table of ['events', 'event_participants', 'event_expenses', 'event_payments']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
    }
    channel.subscribe()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [load, user.id])

  const actions = useMemo(() => {
    const call = async (promise) => {
      const { data, error } = await promise
      if (error) throw error
      return data
    }
    const done = async (value) => {
      await load()
      return value
    }
    return {
      reload: load,

      /** Creates the event and adds members (by user id) and guests (by name). */
      async createEvent({ name, date, groupId, memberIds = [], guests = [] }) {
        const ev = await call(supabase.from('events').insert({ name: name.trim(), event_date: date, group_id: groupId ?? null }).select().single())
        const rows = [
          ...memberIds.filter((id) => id !== user.id).map((id) => ({ event_id: ev.id, user_id: id })),
          ...guests.map((g) => g.trim()).filter(Boolean).map((g) => ({ event_id: ev.id, guest_name: g })),
        ]
        if (rows.length) await call(supabase.from('event_participants').insert(rows))
        return done(ev)
      },

      async addParticipants(eventId, { memberIds = [], guests = [] }) {
        const rows = [
          ...memberIds.map((id) => ({ event_id: eventId, user_id: id })),
          ...guests.map((g) => g.trim()).filter(Boolean).map((g) => ({ event_id: eventId, guest_name: g })),
        ]
        if (rows.length) await call(supabase.from('event_participants').insert(rows))
        return done()
      },

      async addExpense(eventId, { paidBy, amount, note, splits }) {
        await call(supabase.from('event_expenses').insert({
          event_id: eventId,
          paid_by: paidBy,
          amount,
          currency: 'ARS',
          note: note?.trim() || null,
          split_snapshot: splits.map((s) => ({ participant_id: s.user_id, amount: s.amount })),
        }))
        return done()
      },

      async voidExpense(id, reason) {
        await call(supabase.from('event_expenses').update({ status: 'voided', void_reason: reason.trim() }).eq('id', id))
        return done()
      },

      /** Admins register confirmed payments; participants report theirs ("Ya pagué"). */
      async addPayment(eventId, { from, to, amount, confirmed }) {
        await call(supabase.from('event_payments').insert({
          event_id: eventId, from_participant: from, to_participant: to, amount, status: confirmed ? 'confirmed' : 'reported',
        }))
        return done()
      },

      async confirmPayment(id) {
        await call(supabase.from('event_payments').update({ status: 'confirmed' }).eq('id', id))
        return done()
      },

      async voidPayment(id, reason) {
        await call(supabase.from('event_payments').update({ status: 'voided', void_reason: reason.trim() }).eq('id', id))
        return done()
      },

      async closeEvent(id) {
        await call(supabase.from('events').update({ status: 'closed' }).eq('id', id))
        return done()
      },

      async renewLink(id) {
        await call(supabase.from('events').update({ share_token: randomToken(), share_active: true }).eq('id', id))
        return done()
      },

      async setLinkActive(id, active) {
        await call(supabase.from('events').update({ share_active: active }).eq('id', id))
        return done()
      },
    }
  }, [load, user.id])

  const value = useMemo(() => ({
    status,
    events,
    getEvent: (id) => events.find((e) => e.id === id) ?? null,
    eventsOfGroup: (gid) => events.filter((e) => e.group_id === gid),
    standaloneEvents: events.filter((e) => !e.group_id),
    ...actions,
  }), [status, events, actions])

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>
}

export function useEvents() {
  const ctx = useContext(EventsContext)
  if (!ctx) throw new Error('useEvents must be used inside EventsStoreProvider')
  return ctx
}

/** Display name of a participant (member or guest). */
export const participantName = (p) => p?.profile?.display_name ?? p?.guest_name ?? 'Alguien'

/** Participant in the shape GroupSplitFields / UserAvatar expect. */
export const asMember = (p) => ({
  user_id: p.id,
  profile: { id: p.profile?.id ?? p.id, display_name: participantName(p), username: p.profile?.username, avatar_url: p.profile?.avatar_url },
})
