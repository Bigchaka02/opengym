// Coach/client fork (PROJECT.md) — the GitHub Pages build's "server": openGym's API answered in
// the browser, with the client files in the repo (data/state-<uid>.json) as the database.
//
// lib/api.js hands every /api/* call here when the build sets VITE_GITHUB_DATA ("owner/repo",
// optionally "owner/repo@branch"). Reads and writes go to the GitHub Contents API with a token
// kept on this device (setup: PROJECT.md), so every change the app syncs is a commit in the repo,
// and every phone reads the same files. The store's own sync — revisions, conflict merge, polling
// — runs unchanged: PUT /api/data below is api/server.js's, rule for rule.
import { stampPut } from '../../../api/sync-stamps.js'

export const GITHUB_DATA = import.meta.env.VITE_GITHUB_DATA || ''
const [REPO, BRANCH = 'main'] = GITHUB_DATA.split('@')
const DIR = 'data'
const TOKEN_KEY = 'og_github_token'   // this device's token for the repo
const UID_KEY = 'og_github_uid'       // the client "signed in" here (the server's session cookie)
const DEFAULT_CLIENTS = [{ id: 'client1', name: 'Client 1' }, { id: 'client2', name: 'Client 2' }]

const ls = {
  get: k => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* private mode */ } }
}
export const githubToken = () => ls.get(TOKEN_KEY) || ''
export const setGithubToken = tok => ls.set(TOKEN_KEY, (tok || '').trim() || null)
export const repoName = () => REPO
// The link that sets up another phone: the token rides in the address's fragment, which no server
// ever sees, and comes off the address as soon as the app has kept it (takeTokenFromUrl).
export const setupLink = () => location.origin + location.pathname + '#key=' + encodeURIComponent(githubToken())
export function takeTokenFromUrl() {
  const m = /[#?&]key=([^&#]+)/.exec(location.hash + location.search)
  if (!m) return false
  setGithubToken(decodeURIComponent(m[1]))
  history.replaceState(null, '', location.pathname)
  return true
}

const fail = (message, status, data, code) => Object.assign(new Error(message), { status, data: data || {}, code })

// One call to the Contents API. A token GitHub refuses is reported as the repo being unreachable
// (503), never as a 401: to the store a 401 means "signed out", and there is no sign-in here.
async function gh(path, { method = 'GET', body, headers = {} } = {}) {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}` + (method === 'GET' ? `?ref=${encodeURIComponent(BRANCH)}` : '')
  let r
  try {
    r = await fetch(url, {
      method, cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + githubToken(), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined
    })
  } catch { throw fail('GitHub could not be reached.') }   // no status: offline, as the store reads it
  if (r.status === 403 && r.headers.get('x-ratelimit-remaining') === '0') throw fail('GitHub rate limit reached, try again in a few minutes.', 503, {}, 'github-rate')
  if (r.status === 401 || r.status === 403) throw fail('GitHub refused the key on this device.', 503, {}, 'github-auth')
  return r
}

// UTF-8 <-> base64, the Contents API's encoding.
const toB64 = text => {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
const fromB64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, '')), c => c.charCodeAt(0)))

// What this device last knew of each client's file: { doc, sha, etag, wroteAt }.
const files = new Map()
const fileOf = uid => `${DIR}/state-${String(uid).replace(/[^a-zA-Z0-9_-]/g, '')}.json`
const STALE_MS = 90000   // GitHub can serve the copy before a write for a little while after it

async function readJson(path) {
  const r = await gh(path)
  if (r.status === 404) return { doc: null, sha: null }
  if (!r.ok) throw fail('GitHub answered ' + r.status, 503)
  const meta = await r.json()
  let text = meta.encoding === 'base64' ? fromB64(meta.content) : null
  if (text == null) {   // over 1 MB the JSON answer leaves the content out: fetch it raw
    const raw = await gh(path, { headers: { Accept: 'application/vnd.github.raw+json' } })
    if (!raw.ok) throw fail('GitHub answered ' + raw.status, 503)
    text = await raw.text()
  }
  let doc = null
  try { doc = JSON.parse(text) } catch { throw fail('state unreadable', 503) }
  return { doc, sha: meta.sha, etag: r.headers.get('etag') }
}

// The client's file, asking GitHub only whether it changed when this device has a copy (a 304
// does not count against the rate limit), and keeping its own just-written copy over an older one
// GitHub may still hand out for a moment after the write.
async function readState(uid) {
  const path = fileOf(uid), known = files.get(uid)
  if (known?.etag) {
    const r = await gh(path, { headers: { 'If-None-Match': known.etag } })
    if (r.status === 304) return known
    if (r.status === 404) { files.set(uid, { doc: null, sha: null }); return files.get(uid) }
  }
  const got = await readJson(path)
  if (known?.wroteAt && Date.now() - known.wroteAt < STALE_MS && (got.doc?._rev || 0) < (known.doc?._rev || 0)) return known
  files.set(uid, got)
  return got
}

// Removed from what a client is handed, as the server does (api/server.js forClient).
function forClient(S) {
  if (!S || typeof S !== 'object' || !('_unstamped' in S || '_prior' in S)) return S
  const { _unstamped, _prior, ...rest } = S
  return rest
}
const record = x => !!x && typeof x === 'object' && !Array.isArray(x)
const randomHex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('')
// The document without the bookkeeping every write moves, to tell a write that changes nothing.
const sameContent = (a, b) => {
  const strip = d => { if (!d) return d; const { _rev, _ts, _wid, _wids, active, ...rest } = d; return rest }
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b))
}

let clientsCache = null
async function clients() {
  if (clientsCache) return clientsCache
  try {
    const { doc } = await readJson(`${DIR}/profiles.json`)
    if (Array.isArray(doc) && doc.length) clientsCache = doc.filter(p => p && p.id).map(p => ({ id: String(p.id), name: String(p.name || p.id) }))
  } catch (e) { if (e.code === 'github-auth' || e.status == null) throw e }
  return (clientsCache ||= DEFAULT_CLIENTS)
}
const userOf = async uid => { const c = (await clients()).find(p => p.id === uid); return c ? { id: c.id, name: c.name, admin: false } : null }

// Whether this device's token can read the repo — the setup screen's check.
export async function checkGithubToken() {
  clientsCache = null
  await clients()
}

async function putState(uid, user, body) {
  if (!body.state || typeof body.state !== 'object' || Array.isArray(body.state)) throw fail('state required', 400)
  if (!Object.keys(body.state).some(k => k !== '_rev' && k !== '_ts')) throw fail('state required', 400)
  const list = v => v == null || Array.isArray(v)
  if (!list(body.state.workouts) || !list(body.state.routines)) throw fail('invalid state', 400)
  for (const k of ['workouts', 'routines']) if (Array.isArray(body.state[k])) body.state[k] = body.state[k].filter(record)
  for (let attempt = 0; ; attempt++) {
    const known = files.get(uid) || await readState(uid)
    const cur = known.doc
    const curRev = cur?._rev || 0
    if ((body.baseRev != null && body.baseRev !== curRev) ||
        (body.baseRev != null && typeof body.baseWid === 'string' && cur?._wid && body.baseWid !== cur._wid)) {
      throw fail('conflict', 409, { error: 'conflict', rev: curRev, state: forClient(cur) })
    }
    const next = JSON.parse(JSON.stringify(body.state))
    delete next.active   // in-progress workouts stay on the device
    const storedReset = Number(cur?.resetAt) || 0
    if (storedReset > (Number(next.resetAt) || 0)) {
      next.resetAt = cur.resetAt
      if (cur.resetIds && typeof cur.resetIds === 'object') next.resetIds = cur.resetIds
      else delete next.resetIds
    }
    const report = {}
    stampPut(cur, next, { overRead: body.baseRev != null && body.baseRev === curRev, stamped: body.stamped === true, report })
    // Nothing in the profile moved (a tick inside a running workout, say): no commit for it.
    if (cur && !report.changed && sameContent(cur, next)) return { ok: true, ts: body.state._ts || null, rev: curRev, wid: cur._wid }
    next._rev = curRev + (report.changed ? 2 : 1)
    next._wids = [...(Array.isArray(cur?._wids) ? cur._wids : []), ...(cur?._wid ? [cur._wid] : [])].filter(x => typeof x === 'string').slice(-50)
    next._wid = randomHex(8)
    const text = JSON.stringify(next)
    const r = await gh(fileOf(uid), {
      method: 'PUT',
      body: { message: `${user.name}: data from the app`, content: toB64(text), branch: BRANCH, ...(known.sha ? { sha: known.sha } : {}) }
    })
    if (r.ok) {
      const res = await r.json()
      files.set(uid, { doc: next, sha: res.content?.sha || null, etag: null, wroteAt: Date.now() })
      return { ok: true, ts: body.state._ts || null, rev: curRev + 1, wid: next._wid }
    }
    // Another device committed since this one read the file: read it again and answer as the
    // server does, a 409 with the stored document, for the store to merge and push again.
    if (r.status === 409 || r.status === 422) {
      files.delete(uid)
      const fresh = await readState(uid)
      if (attempt < 1 && (fresh.doc?._rev || 0) === curRev && fresh.sha !== known.sha) continue
      throw fail('conflict', 409, { error: 'conflict', rev: fresh.doc?._rev || 0, state: forClient(fresh.doc) })
    }
    throw fail('GitHub answered ' + r.status, 503)
  }
}

// The routes the app calls, as api/server.js answers them. Anything else has no server here.
export async function githubApi(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase()
  const route = method + ' ' + path.split('?')[0]
  const body = opts.body ? JSON.parse(opts.body) : {}
  const uid = ls.get(UID_KEY)
  const user = uid ? await userOf(uid) : null
  switch (route) {
    case 'GET /api/config': return { invite_only: false, allow_guest: false }
    case 'GET /api/profiles': return { profiles: await clients() }
    case 'POST /api/profiles/login': {
      const u = await userOf(body.uid)
      if (!u) throw fail('unknown profile', 404)
      ls.set(UID_KEY, u.id)
      return { user: u }
    }
    case 'POST /api/logout': case 'POST /api/logout/all': ls.set(UID_KEY, null); return { ok: true }
  }
  if (!user) throw fail('not signed in', 401)
  switch (route) {
    case 'GET /api/me': return { user }
    case 'GET /api/data': { const f = await readState(user.id); return { state: forClient(f.doc), rev: f.doc?._rev || 0 } }
    case 'GET /api/data/rev': { const f = await readState(user.id); return { rev: f.doc?._rev || 0, ...(f.doc?._wid ? { wid: f.doc._wid } : {}) } }
    case 'PUT /api/data': return putState(user.id, user, body)
  }
  throw fail('not available in the GitHub Pages build', 404)
}
