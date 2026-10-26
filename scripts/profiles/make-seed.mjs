// Coach/client fork (PROJECT.md): writes the placeholder clients' workout data to data/.
//
//   node scripts/profiles/make-seed.mjs          # writes data/state-client1.json, state-client2.json
//
// Built from the upstream demo generator (frontend/src/lib/demoSeed.js): 12 weeks of
// Push/Pull/Legs history with body weight, measurements and effort ratings, ending today.
// Client 2 is the same plan made lighter, shorter and shifted onto Tue/Thu/Sat so the two
// profiles do not look identical. Weights in lb (the demo is built in kg, then converted the way
// Settings → Units converts). Overwrites what is there — only run it to start over.
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildDemoState } from '../../frontend/src/lib/demoSeed.js'
import { convertStateUnit } from '../../frontend/src/lib/units.js'

const dataDir = fileURLToPath(new URL('../../data/', import.meta.url))
mkdirSync(dataDir, { recursive: true })

const DAY = 86400000
const iso = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
const shiftIso = (d, days) => { const [y, m, dd] = d.split('-').map(Number); return iso(new Date(y, m - 1, dd + days, 12).getTime()) }
const round = (w, step) => Math.round(w / step) * step
const lighter = w => (w ? Math.max(1.25, round(w * 0.65, w >= 40 ? 2.5 : 1.25)) : 0)

function client2() {
  const s = buildDemoState()
  const todayIso = iso(Date.now())
  const cutoff = Date.now() - 8 * 7 * DAY
  s.workouts = s.workouts
    .filter(w => w.start >= cutoff)
    .map(w => {
      const entries = w.entries.map(e => ({ ...e, topW: e.topW ? lighter(e.topW) : e.topW, sets: e.sets.map(x => ({ ...x, w: lighter(x.w) })) }))
      return {
        ...w, d: shiftIso(w.d, 1), start: w.start + DAY, end: w.end + DAY, entries,
        bw: Math.round((w.bw - 17.5) * 10) / 10,
        vol: entries.reduce((v, e) => v + e.sets.reduce((n, x) => n + x.w * x.r, 0), 0)
      }
    })
    .filter(w => w.d <= todayIso)
  s.bodyweight = s.bodyweight.filter(b => b.t >= cutoff).map(b => ({ ...b, w: Math.round((b.w - 17.5) * 10) / 10 }))
  s.measurements = s.measurements.filter(m => m.t >= cutoff)
  s.exWeights = Object.fromEntries(Object.entries(s.exWeights).map(([id, v]) => [id, { w: lighter(v.w), d: shiftIso(v.d, 1) }]))
  s.targetW = 60
  const [push, pull, legs] = s.routines
  s.week = { 2: push.id, 4: pull.id, 6: legs.id }
  return s
}

const seeds = { client1: convertStateUnit(buildDemoState(), 'lb'), client2: convertStateUnit(client2(), 'lb') }
for (const [uid, s] of Object.entries(seeds)) {
  s.effort = 'none'   // no RIR/RPE column (the demo turns it on)
  s._ts = Date.now()
  writeFileSync(dataDir + `state-${uid}.json`, JSON.stringify(s))
  console.log(`data/state-${uid}.json: ${s.workouts.length} workouts, ${s.routines.length} routines, ${s.bodyweight.length} weigh-ins`)
}
