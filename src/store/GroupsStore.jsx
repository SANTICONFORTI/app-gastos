import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { newId } from '../lib/id'
import { compressImage } from '../lib/receipts'
import { useAuth } from './AuthProvider'

// Groups: my memberships, the selected group's data, realtime updates and who's online.
// Permissions live in the database (RLS + triggers); this store just calls it.

const SELECTED_KEY = 'puly:grupo'
const MEMBER_FIELDS = 'group_id, user_id, role, status, joined_at, profile:profiles(id, display_name, username, avatar_url, alias_cvu)'

const GroupsContext = createContext(null)

function readSelected() {
  try {
    return localStorage.getItem(SELECTED_KEY)
  } catch {
    return null
  }
}

export function GroupsStoreProvider({ children }) {
  const { user } = useAuth()
  // Latest thing someone else did in the selected group (shown as a notice).
  const [activity, setActivity] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [listStatus, setListStatus] = useState('loading')
  const [selectedId, setSelectedId] = useState(readSelected)
  const [current, setCurrent] = useState({ groupId: null, members: [], expenses: [], settlements: [], invites: [], status: 'idle' })
  const [online, setOnline] = useState(() => new Set())

  // ----- My groups -----
  const loadList = useCallback(async () => {
    const { data, error } = await supabase
      .from('group_members')
      .select('role, status, joined_at, group:groups(*)')
      .eq('user_id', user.id)
      .in('status', ['active', 'pending', 'invited'])
    if (error) {
      setListStatus((s) => (s === 'ready' ? s : 'error'))
      return []
    }
    const list = data.filter((m) => m.group).sort((a, b) => a.group.name.localeCompare(b.group.name))
    setMemberships(list)
    setListStatus('ready')
    return list
  }, [user.id])

  useEffect(() => {
    loadList()
  }, [loadList])

  // Keep a valid selection: the saved one if I'm still active there, else my first active group.
  const activeGroups = memberships.filter((m) => m.status === 'active')
  const selected = memberships.find((m) => m.group.id === selectedId && m.status !== 'invited')
    ?? activeGroups[0] ?? null
  const groupId = selected?.group.id ?? null

  const selectGroup = useCallback((id) => {
    setSelectedId(id)
    try {
      localStorage.setItem(SELECTED_KEY, id)
    } catch {
      // Ignore.
    }
  }, [])

  // ----- Selected group's data -----
  const loadCurrent = useCallback(async (gid, isActive, isAdmin) => {
    if (!gid) return
    if (!isActive) {
      setCurrent({ groupId: gid, members: [], expenses: [], settlements: [], invites: [], status: 'ready' })
      return
    }
    const [members, expenses, settlements, invites] = await Promise.all([
      supabase.from('group_members').select(MEMBER_FIELDS).eq('group_id', gid),
      supabase.from('expenses').select('*').eq('group_id', gid).order('spent_at', { ascending: false }),
      supabase.from('settlements').select('*').eq('group_id', gid).order('created_at', { ascending: false }),
      isAdmin
        ? supabase.from('group_invites').select('*').eq('group_id', gid).eq('active', true).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])
    const error = members.error || expenses.error || settlements.error || invites.error
    if (error) {
      setCurrent((c) => ({ ...c, status: c.groupId === gid && c.status === 'ready' ? 'ready' : 'error' }))
      return
    }
    setCurrent({
      groupId: gid,
      members: members.data,
      expenses: expenses.data,
      settlements: settlements.data,
      invites: invites.data,
      status: 'ready',
    })
  }, [])

  const isActiveMember = selected?.status === 'active'
  const isAdmin = isActiveMember && selected?.role === 'admin'

  useEffect(() => {
    if (!groupId) return
    setCurrent((c) => (c.groupId === groupId ? c : { groupId, members: [], expenses: [], settlements: [], invites: [], status: 'loading' }))
    loadCurrent(groupId, isActiveMember, isAdmin)
  }, [groupId, isActiveMember, isAdmin, loadCurrent])

  const reloadCurrent = useCallback(
    () => loadCurrent(groupId, isActiveMember, isAdmin),
    [groupId, isActiveMember, isAdmin, loadCurrent],
  )

  // ----- Realtime: changes in the group + who's online -----
  useEffect(() => {
    if (!groupId || !isActiveMember) return
    let timer = null
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        loadCurrent(groupId, true, isAdmin)
        loadList()
      }, 250)
    }

    const channel = supabase.channel(`grupo:${groupId}`, { config: { presence: { key: user.id } } })
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${groupId}` }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.created_by !== user.id) {
          setActivity({ id: payload.new.id, type: 'expense', row: payload.new, groupId })
        }
        refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${groupId}` }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.created_by !== user.id) {
          setActivity({ id: payload.new.id, type: 'settlement', row: payload.new, groupId })
        }
        refresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` }, refresh)
      .on('presence', { event: 'sync' }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track({ online_at: new Date().toISOString() })
      })

    // Catch up after the phone was asleep.
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      setOnline(new Set())
      supabase.removeChannel(channel)
    }
  }, [groupId, isActiveMember, isAdmin, user.id, loadCurrent, loadList])

  // Invitations and requests also matter when I'm not looking at that group.
  useEffect(() => {
    const channel = supabase
      .channel(`mis-grupos:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `user_id=eq.${user.id}` }, () => loadList())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id, loadList])

  // ----- Actions -----
  const call = async (promise) => {
    const { data, error } = await promise
    if (error) throw error
    return data
  }

  const actions = useMemo(() => ({
    async createGroup({ name, joinMode, photoFile }) {
      const group = await call(supabase.from('groups').insert({ name: name.trim(), join_mode: joinMode }).select().single())
      if (photoFile) {
        try {
          const url = await uploadGroupPhoto(group.id, photoFile)
          await call(supabase.from('groups').update({ avatar_url: url }).eq('id', group.id))
        } catch {
          // The group exists anyway; the photo can be added later from settings.
        }
      }
      await loadList()
      selectGroup(group.id)
      return group
    },

    async updateGroup(gid, { name, joinMode, photoFile }) {
      const changes = { name: name.trim(), join_mode: joinMode }
      if (photoFile) changes.avatar_url = await uploadGroupPhoto(gid, photoFile)
      await call(supabase.from('groups').update(changes).eq('id', gid))
      await loadList()
    },

    async previewCode(code) {
      return call(supabase.rpc('preview_invite', { invite_code: code.trim() }))
    },

    /** Returns { group_id, status } ('active' or 'pending'). */
    async joinWithCode(code) {
      const result = await call(supabase.rpc('join_group_with_code', { invite_code: code.trim() }))
      await loadList()
      if (result.status === 'active') selectGroup(result.group_id)
      return result
    },

    async respondInvite(gid, accept) {
      await call(supabase.rpc('respond_group_invite', { gid, accept }))
      await loadList()
      if (accept) selectGroup(gid)
    },

    async leaveGroup(gid) {
      await call(supabase.rpc('leave_group', { gid }))
      await loadList()
    },

    /** Invites someone by @username. Returns a message describing what happened. */
    async inviteByUsername(gid, rawUsername) {
      const username = rawUsername.trim().replace(/^@/, '').toLowerCase()
      const profile = await call(supabase.from('profiles').select('id, display_name').eq('username', username).maybeSingle())
      if (!profile) throw new Error(`No encontramos a @${username}`)
      if (profile.id === user.id) throw new Error('Ya estás en el grupo')
      const existing = await call(supabase.from('group_members').select('status').eq('group_id', gid).eq('user_id', profile.id).maybeSingle())
      if (existing?.status === 'active') throw new Error(`${profile.display_name} ya está en el grupo`)
      if (existing?.status === 'invited') throw new Error(`${profile.display_name} ya tiene una invitación pendiente`)
      if (existing?.status === 'pending') {
        await call(supabase.from('group_members').update({ status: 'active' }).eq('group_id', gid).eq('user_id', profile.id))
        await reloadCurrent()
        return `${profile.display_name} había pedido entrar: lo aprobamos`
      }
      if (existing?.status === 'removed') {
        await call(supabase.from('group_members').update({ status: 'invited' }).eq('group_id', gid).eq('user_id', profile.id))
      } else {
        await call(supabase.from('group_members').insert({ group_id: gid, user_id: profile.id, role: 'member', status: 'invited' }))
      }
      await reloadCurrent()
      return `Invitamos a ${profile.display_name}`
    },

    async setMemberStatus(gid, userId, status) {
      await call(supabase.from('group_members').update({ status }).eq('group_id', gid).eq('user_id', userId))
      await reloadCurrent()
    },

    async setMemberRole(gid, userId, role) {
      await call(supabase.from('group_members').update({ role }).eq('group_id', gid).eq('user_id', userId))
      await reloadCurrent()
      await loadList()
    },

    /** Deactivates the current codes and creates a new one. */
    async renewInvite(gid) {
      await call(supabase.from('group_invites').update({ active: false }).eq('group_id', gid).eq('active', true))
      const invite = await call(supabase.from('group_invites').insert({ group_id: gid }).select().single())
      await reloadCurrent()
      return invite
    },

    async disableInvites(gid) {
      await call(supabase.from('group_invites').update({ active: false }).eq('group_id', gid).eq('active', true))
      await reloadCurrent()
    },

    /** Creates or edits a group expense with its split. */
    async saveExpense(gid, input) {
      const id = await call(supabase.rpc('save_group_expense', {
        p_expense_id: input.id ?? null,
        p_group_id: gid,
        p_paid_by: input.paidBy,
        p_amount: input.amount,
        p_currency: input.currency,
        p_exchange_rate: input.exchangeRate,
        p_rate_type: input.rateType,
        p_category_id: input.categoryId,
        p_note: input.note || null,
        p_spent_at: input.spentAt,
        p_receipt_path: input.receiptPath ?? null,
        p_splits: input.splits,
      }))
      await reloadCurrent()
      return id
    },

    async voidExpense(expenseId, reason) {
      await call(supabase.from('expenses').update({ status: 'voided', void_reason: reason.trim() }).eq('id', expenseId))
      await reloadCurrent()
    },

    async uploadReceipt(gid, blob) {
      const path = `groups/${gid}/${newId()}.jpg`
      await call(supabase.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg', upsert: false }))
      return path
    },

    async addSettlement(gid, { from, to, amount }) {
      await call(supabase.from('settlements').insert({ group_id: gid, from_user: from, to_user: to, amount, currency: 'ARS' }))
      await reloadCurrent()
    },

    async voidSettlement(id, reason) {
      await call(supabase.from('settlements').update({ status: 'voided', void_reason: reason.trim() }).eq('id', id))
      await reloadCurrent()
    },

    /** Latest changes of the group's expenses, newest first. */
    async fetchHistory(gid) {
      return call(supabase
        .from('expense_history')
        .select('id, expense_id, action, changed_by, changed_at, before, after, expense:expenses!inner(group_id)')
        .eq('expense.group_id', gid)
        .order('changed_at', { ascending: false })
        .limit(150))
    },

    async fetchExpenseHistory(expenseId) {
      return call(supabase.from('expense_history').select('*').eq('expense_id', expenseId).order('changed_at'))
    },
  }), [user.id, loadList, selectGroup, reloadCurrent])

  const value = useMemo(() => {
    const ready = current.groupId === groupId ? current : { ...current, members: [], expenses: [], settlements: [], invites: [], status: 'loading' }
    const activeMembers = ready.members.filter((m) => m.status === 'active')
    const memberById = Object.fromEntries(ready.members.map((m) => [m.user_id, m]))
    return {
      listStatus,
      memberships,
      invitations: memberships.filter((m) => m.status === 'invited'),
      selected,
      groupId,
      isActiveMember,
      isAdmin,
      selectGroup,
      reloadList: loadList,
      reloadCurrent,
      status: ready.status,
      members: ready.members,
      activeMembers,
      pendingMembers: ready.members.filter((m) => m.status === 'pending'),
      invitedMembers: ready.members.filter((m) => m.status === 'invited'),
      memberById,
      expenses: ready.expenses,
      settlements: ready.settlements,
      invites: ready.invites,
      online,
      activity,
      ...actions,
    }
  }, [listStatus, memberships, selected, groupId, isActiveMember, isAdmin, selectGroup, loadList, reloadCurrent, current, online, activity, actions])

  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>
}

async function uploadGroupPhoto(gid, file) {
  const blob = await compressImage(file, { maxSide: 512, square: true })
  const path = `groups/${gid}/foto-${Date.now()}.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export function useGroups() {
  const ctx = useContext(GroupsContext)
  if (!ctx) throw new Error('useGroups must be used inside GroupsStoreProvider')
  return ctx
}
