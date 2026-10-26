// Coach/client fork (PROJECT.md): the client's "Today" tab — the day's assigned workout as a
// checklist on the stock workout screen. Nothing is started or timed: opening the tab lays out
// today's exercises, the client ticks sets off and taps Finish. The screen hides the clock and
// runs no rest timers for a client (views/Workout.jsx), and the saved workout spans the first tick
// to the last (sheets.jsx doFinishWorkout). A day left open closes itself the next time the app
// opens on a later day: saved if anything was ticked, dropped if not. A rest day, or a day already
// logged, gets one quiet card instead.
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { effectiveRoutines, effectiveRoutineIds, nextTrainingDay, setsDoneActive } from '../lib/history.js'
import { todayISO, DAYN } from '../lib/format.js'
import { queueOf } from '../lib/queue.js'
import { t, dateLocale } from '../lib/i18n.js'
import { beginWorkout, finishWorkoutQuietly } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import Workout from '../views/Workout.jsx'

// Whether today's plan is already logged — the same reading as Home's today row.
function loggedToday(S) {
  const today = todayISO()
  const routines = effectiveRoutines(S, today)
  const logged = S.workouts.filter(w => w.d === today)
  const queueIds = queueOf(S)?.ids || []
  const covered = id => !queueIds.includes(id) && logged.some(w => (Array.isArray(w.routineIds) ? w.routineIds : [w.routineId]).includes(id))
  return (routines.every(r => covered(r.id)) && logged.at(-1)) || null
}

// A day that is over: kept if anything on it was ticked, dropped if not.
export function closeEarlierDay() {
  const A = useStore.getState().S.active
  if (!A || A.editingWorkoutId || A.d === todayISO()) return
  if (setsDoneActive(A) > 0) finishWorkoutQuietly()
  else {
    useStore.getState().update(s => { s.active = null })
    useUI.getState().stopRest()
    useUI.getState().stopWork()
  }
}

export default function ClientToday() {
  const S = useStore(s => s.S)
  // Coming back to the app (it may have sat open past midnight) reads the day again.
  const [, wake] = useState(0)
  useEffect(() => {
    const again = () => { if (document.visibilityState !== 'hidden') wake(n => n + 1) }
    document.addEventListener('visibilitychange', again)
    window.addEventListener('focus', again)
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('focus', again) }
  }, [])
  const today = todayISO()
  const earlier = !!S.active && !S.active.editingWorkoutId && S.active.d !== today
  const planned = effectiveRoutines(S, today).some(r => r.ex.length)
  const done = loggedToday(S)
  const start = !S.active && planned && !done
  useEffect(() => { if (earlier) closeEarlierDay() }, [earlier])
  useEffect(() => {
    // The live store, not this render's: StrictMode runs this twice, and the first run started it.
    if (start && !useStore.getState().S.active) beginWorkout(effectiveRoutineIds(useStore.getState().S, todayISO()), null)
  }, [start])

  if (earlier || start) return null
  if (S.active) return <Workout />
  const next = nextTrainingDay(S, today)
  return <div className="narrow">
    <div className="hdr"><div>
      <h1>{t('Today')}</h1>
      <div className="sub">{new Date().toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    </div></div>
    <div className="card og-today-empty">
      <span className="og-today-ic"><Icon name={done ? 'checkCircle' : 'moon'} /></span>
      <div className="og-today-t">{done ? (done.name ? t('{0} (done)', done.name) : t('Workout done')) : t('Rest day')}</div>
      {next && <div className="muted small">{t('Next session: {0}, {1}', t(DAYN[next.weekday]), next.routine.name)}</div>}
    </div>
  </div>
}
