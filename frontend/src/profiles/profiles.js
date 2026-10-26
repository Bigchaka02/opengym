// Coach/client fork (PROJECT.md) — who is using openGym on this device.
//
// The server only ever has client accounts (Client 1, Client 2 — api/server.js PROFILES). Every
// profile signs this browser in as one of them, with no passkey:
//   · a client signs in as themselves and gets the two-tab client UI (ClientShell bits in this folder);
//   · the coach has no account of his own: he signs in as whichever client his dropdown names and
//     gets the stock openGym UI, untouched, acting on that client's data.
// Switching profile or client reloads the page, so the app's store boots cleanly as that account
// (its own sign-in logic keeps aside anything the previous account still owed the server).
import { api } from '../lib/api.js'

const SAVED = 'og_profile'          // localStorage: the last profile picked here — { role, uid }
const CHOSEN = 'og_profile_chosen'  // sessionStorage: picked in this launch, so no picker on reload
const COACH_CLIENT = 'og_coach_client'  // localStorage: the client the coach had selected last

// Used until /api/profiles answers (and if it never does).
let clients = [{ id: 'client1', name: 'Client 1' }, { id: 'client2', name: 'Client 2' }]
let current = null

export const clientList = () => clients
export const clientName = uid => clients.find(c => c.id === uid)?.name || uid
export const currentProfile = () => current
// The two-tab client UI — false for the coach, and false when no profile is set (stock app).
export const isClientUI = () => current?.role === 'client'
export const isCoachUI = () => current?.role === 'coach'

function readSaved() {
  try {
    const p = JSON.parse(localStorage.getItem(SAVED))
    if (p && (p.role === 'coach' || p.role === 'client') && clients.some(c => c.id === p.uid)) return p
  } catch { /* none */ }
  return null
}
function save(p) {
  current = p
  try {
    localStorage.setItem(SAVED, JSON.stringify(p))
    if (p.role === 'coach') localStorage.setItem(COACH_CLIENT, p.uid)
    sessionStorage.setItem(CHOSEN, '1')
  } catch { /* private mode */ }
}

// This browser's session is the client's: asks the server who is signed in, and signs in as `uid`
// when that is anyone else or no one. A server that cannot be reached is left alone — the app then
// opens on what it kept from last time, offline, the way it always does.
async function ensureSession(uid) {
  let me
  try { me = await api('/api/me', { timeout: 6000 }) } catch (e) { if (!e?.status) return }
  if (me?.user?.id === uid) return
  try { await api('/api/profiles/login', { method: 'POST', body: JSON.stringify({ uid }), timeout: 8000 }) } catch { /* the app shows why */ }
}

// Before the app boots (main.jsx): the profile picker on a fresh launch, then the session.
// `showPicker(defaultProfile)` renders the picker and resolves with what was tapped.
export async function bootProfile(showPicker) {
  try {
    const r = await api('/api/profiles', { timeout: 6000 })
    if (Array.isArray(r?.profiles) && r.profiles.length) clients = r.profiles
  } catch { /* keep the defaults */ }
  const saved = readSaved()
  let chosen = false
  try { chosen = sessionStorage.getItem(CHOSEN) === '1' } catch { /* ask */ }
  const resume = saved && chosen
  const p = resume ? saved : await showPicker(saved)
  // A fresh launch starts on the profile's first page, not on whatever the last one left open.
  if (!resume) history.replaceState(null, '', location.pathname + location.search)
  save(p)
  await ensureSession(p.uid)
}

// From inside the app: the profile icon's picker, or the coach's client dropdown.
export async function switchProfile(p) {
  if (current && p.role === current.role && p.uid === current.uid) return
  // Whatever is waiting in the push debounce goes to the server first, so the other devices see
  // it now; anything that still cannot get there is kept aside by the store's own sign-in logic.
  try {
    const { useStore } = await import('../store/useStore.js')
    await Promise.race([useStore.getState().pushState(), new Promise(r => setTimeout(r, 4000))])
  } catch { /* kept aside on the next boot */ }
  // A new role starts on its own first page; the coach changing client stays where he is.
  const roleChanged = current?.role !== p.role
  save(p)
  await ensureSession(p.uid)
  if (roleChanged) history.replaceState(null, '', location.pathname + location.search)
  window.location.reload()
}

// The profile a picker tile stands for. The coach goes back to the client he had last.
export function profileFor(key) {
  if (key !== 'coach') return { role: 'client', uid: key }
  let uid = null
  try { uid = localStorage.getItem(COACH_CLIENT) } catch { /* the first client */ }
  return { role: 'coach', uid: clients.some(c => c.id === uid) ? uid : clients[0].id }
}
