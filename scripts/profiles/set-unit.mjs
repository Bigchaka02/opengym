// Coach/client fork (PROJECT.md): switches clients' data files between kg and lb, converting every
// stored weight exactly as the app's Settings → Units does (useStore setUnit), stamped the same way
// so phones still holding the old unit convert their copy when they next sync.
//
//   node scripts/profiles/set-unit.mjs lb                  # every data/state-*.json
//   node scripts/profiles/set-unit.mjs kg client2          # just one client
//
// Then commit and push data/ (pull first: the phones commit there too).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { convertStateUnit } from '../../frontend/src/lib/units.js'
import { highestStamp } from '../../frontend/src/lib/sync-merge.js'

// A state already converted returns it unchanged, so this is safe to run twice.
export function setUnit(S0, unit, now = Date.now()) {
  if ((S0.unit || 'kg') === unit) return null
  const S = JSON.parse(JSON.stringify(convertStateUnit(S0, unit)))
  S.unitSet = { at: Math.max(now, highestStamp(S0) + 1), convert: true }
  // A new revision, as the app's own push would get: the phones see it moved and pull it.
  S._rev = (S0._rev || 0) + 1
  S._wids = [...(Array.isArray(S0._wids) ? S0._wids : []), ...(S0._wid ? [S0._wid] : [])].slice(-50)
  S._wid = randomBytes(8).toString('hex')
  S._ts = now
  return S
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [to, ...only] = process.argv.slice(2)
  if (to !== 'kg' && to !== 'lb') { console.error('usage: set-unit.mjs kg|lb [client ids…]'); process.exit(1) }
  const dir = fileURLToPath(new URL('../../data/', import.meta.url))
  const uids = only.length ? only : readdirSync(dir).map(f => /^state-(.+)\.json$/.exec(f)?.[1]).filter(Boolean)
  for (const uid of uids) {
    const file = dir + `state-${uid}.json`
    const S = setUnit(JSON.parse(readFileSync(file, 'utf8')), to)
    if (!S) { console.log(`${uid}: already ${to}`); continue }
    writeFileSync(file, JSON.stringify(S))
    console.log(`${uid}: now ${to} (rev ${S._rev})`)
  }
}
