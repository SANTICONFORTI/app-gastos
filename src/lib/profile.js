import { supabase } from './supabase'
import { compressImage } from './receipts'

// Same rule as the database check on profiles.username.
export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/

const AVATAR_COLORS = ['#5AC8FA', '#A78BFA', '#FFB547', '#FF7A96', '#4ADE80', '#8B93FF', '#E879F9', '#F59E0B']

/** Stable color for someone without a photo. */
export function avatarColor(id = '') {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** 'Santi Pérez' -> 'santiperez' (only allowed characters, max 20). */
export function suggestUsername(text = '') {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 20)
}

/** 'available' | 'taken' | 'yours' */
export async function checkUsername(username, myId) {
  const { data, error } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle()
  if (error) throw error
  if (!data) return 'available'
  return data.id === myId ? 'yours' : 'taken'
}

/** Alias (6-20 letters, numbers, dots, dashes) or CVU/CBU (22 digits). Empty is fine. */
export function validateAliasCvu(value) {
  const v = value.trim()
  if (!v) return null
  if (/^\d+$/.test(v)) return v.length === 22 ? null : 'El CVU/CBU tiene 22 números.'
  return /^[a-zA-Z0-9.-]{6,20}$/.test(v) ? null : 'El alias tiene entre 6 y 20 letras, números, puntos o guiones.'
}

/** Square, compressed profile photo -> public URL. */
export async function uploadAvatar(userId, file) {
  const blob = await compressImage(file, { maxSide: 512, square: true })
  const path = `users/${userId}/avatar-${Date.now()}.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}
