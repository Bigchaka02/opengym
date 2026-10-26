import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { MOBILE } from './lib/mobile.js'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { startMediaSync } from './lib/media-sync.js'
import { startNativeKeyboard } from './lib/native-keyboard.js'
import './index.css'
import { hideBoot } from './lib/boot.js'
import { bootProfile, profileFor } from './profiles/profiles.js'
import ProfilePicker from './profiles/ProfilePicker.jsx'

// App.jsx restores per-route scroll itself; the browser's own attempt races it.
// A script that dies before the app draws would otherwise leave the boot logo lifting forever.
window.addEventListener('error', hideBoot, { once: true })

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

// Coach/client fork (PROJECT.md): the profile picker on a fresh launch, in a root of its own,
// gone again once a profile is tapped.
const showPicker = saved => new Promise(resolve => {
  const el = document.body.appendChild(document.createElement('div'))
  const root = createRoot(el)
  root.render(<ProfilePicker current={saved} onPick={key => { root.unmount(); el.remove(); resolve(profileFor(key)) }} />)
  hideBoot()
})

// Coach/client fork: workouts started before the client side went timer-free (2026-10-26) are
// cancelled, on whichever profile opens first — Haitham's open Push Day among them. Checked once
// boot is done: a workout set aside when the phone switched clients comes back during boot.
const TIMER_FREE_SINCE = Date.parse('2026-10-26T22:08:00Z')
const stopWatching = useStore.subscribe(st => {
  if (!st.ready) return
  stopWatching()
  const A = st.S.active
  if (!A || A.editingWorkoutId || A.backfill || !(A.start < TIMER_FREE_SINCE)) return
  st.update(s => { s.active = null })
  useUI.getState().stopRest()
  useUI.getState().stopWork()
})

// Coach/client fork: the app boots once the profile is chosen and its client signed in.
bootProfile(showPicker).then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode><App /></StrictMode>
  )

  // The photos and videos of custom exercises, in every build (the phone and the demo included):
  // uploads of what the server lacks, the local clean-up, and the plan's files kept offline.
  startMediaSync(useStore)

  // Android 15 does not resize the page for the soft keyboard; the app says how much it covers and
  // this keeps the focused field above it. Idle everywhere else.
  startNativeKeyboard()

  // Not in the mobile build: the native shell already serves everything from disk.
  if (!MOBILE && 'serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {})
    // The plan's exercise media, kept by the worker for a workout opened without a network (#281).
    // It only fetches ahead while the page runs as the installed app; a tab keeps what it has shown.
    import('./lib/media-prefetch.js').then(m => m.startMediaPrefetch(useStore)).catch(() => {})
  }
})
