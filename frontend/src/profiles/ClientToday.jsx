// Coach/client fork (PROJECT.md): the client's "Today" tab. Today's assigned session opens
// straight on the stock workout screen — what Start shows, minus the weigh-in question (and the
// screen hides its clock for a client, views/Workout.jsx). A rest day, or a session already
// logged today, gets one quiet card instead of the stock screen's workout picker.
import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { effectiveRoutines, effectiveRoutineIds, nextTrainingDay } from '../lib/history.js'
import { todayISO, DAYN } from '../lib/format.js'
import { queueOf } from '../lib/queue.js'
import { t, dateLocale } from '../lib/i18n.js'
import { beginWorkout } from '../sheets.jsx'
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

export default function ClientToday() {
  const S = useStore(s => s.S)
  const today = todayISO()
  const planned = effectiveRoutines(S, today).some(r => r.ex.length)
  const done = loggedToday(S)
  const start = !S.active && planned && !done
  useEffect(() => {
    // The live store, not this render's: StrictMode runs this twice, and the first run started it.
    if (start && !useStore.getState().S.active) beginWorkout(effectiveRoutineIds(useStore.getState().S, todayISO()), null)
  }, [start])

  if (S.active) return <Workout />
  if (start) return null
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
