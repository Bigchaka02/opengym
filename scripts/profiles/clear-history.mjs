// Coach/client fork (PROJECT.md): wipes clients' logged history — workouts, weigh-ins, body
// measurements, last-used weights and PRs, the weight goal, rescheduled days — and keeps the plan
// (routines and the weekly schedule) and every setting, the unit included.
//
//   node scripts/profiles/clear-history.mjs              # every data/state-*.json
//   node scripts/profiles/clear-history.mjs client2      # just one client
//
// The removals are stamped exactly as the app stamps a delete (stampChange, which the store runs
// on every change): a phone still holding the old history drops it when it next syncs instead of
// merging it back. Then commit and push data/ (pull first: the phones commit there too).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { stampChange } from '../../frontend/src/lib/sync-merge.js'

export function clearHistory(S0, wall = Date.now()) {
  const S = JSON.parse(JSON.stringify(S0))
  S.workouts = []
  S.bodyweight = []
  S.measurements = []
  S.exWeights = {}
  S.dayPlan = {}
  S.targetW = null
  const now = stampChange(S0, S, wall)
  // A new revision, as the app's own push would get: the phones see it moved and pull it.
  S._rev = (S0._rev || 0) + 1
  S._wids = [...(Array.isArray(S0._wids) ? S0._wids : []), ...(S0._wid ? [S0._wid] : [])].slice(-50)
  S._wid = randomBytes(8).toString('hex')
  S._ts = now
  return S
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = fileURLToPath(new URL('../../data/', import.meta.url))
  const only = process.argv.slice(2)
  const uids = only.length ? only : readdirSync(dir).map(f => /^state-(.+)\.json$/.exec(f)?.[1]).filter(Boolean)
  for (const uid of uids) {
    const file = dir + `state-${uid}.json`
    const S0 = JSON.parse(readFileSync(file, 'utf8'))
    const S = clearHistory(S0)
    writeFileSync(file, JSON.stringify(S))
    console.log(`${uid}: cleared ${S0.workouts?.length || 0} workouts, ${S0.bodyweight?.length || 0} weigh-ins, ${S0.measurements?.length || 0} measurements (rev ${S._rev}); kept ${S.routines?.length || 0} routines`)
  }
}
