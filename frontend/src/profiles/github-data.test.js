// @vitest-environment happy-dom
// Coach/client fork (PROJECT.md): the GitHub Pages build's stand-in for the server — the client
// files in the repo read and written through the Contents API, with the server's answers.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_GITHUB_DATA', 'me/gym')

// A tiny Contents API: files by path, sha = a write counter, 409 on a stale sha.
let repo, n, puts
const b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
const answer = (status, body, headers = {}) => ({ status, ok: status < 300, headers: { get: k => headers[k.toLowerCase()] ?? null }, json: async () => body, text: async () => JSON.stringify(body) })
function fakeFetch(url, init = {}) {
  if (init.headers?.Authorization !== 'Bearer tok') return answer(401, {})
  const path = decodeURIComponent(new URL(url).pathname.split('/contents/')[1])
  const f = repo[path]
  if ((init.method || 'GET') === 'GET') {
    if (!f) return answer(404, {})
    if (init.headers['If-None-Match'] === `"${f.sha}"`) return answer(304, null)
    return answer(200, { sha: f.sha, encoding: 'base64', content: b64(f.text) }, { etag: `"${f.sha}"` })
  }
  const body = JSON.parse(init.body)
  if (f && body.sha !== f.sha) return answer(409, {})
  repo[path] = { text: new TextDecoder().decode(Uint8Array.from(atob(body.content), c => c.charCodeAt(0))), sha: 's' + (++n) }
  puts.push(body.message)
  return answer(200, { content: { sha: repo[path].sha } })
}
const docOf = uid => JSON.parse(repo[`data/state-${uid}.json`].text)

let gd
beforeEach(async () => {
  repo = {
    'data/profiles.json': { text: JSON.stringify([{ id: 'client1', name: 'Ana' }]), sha: 'p1' },
    'data/state-client1.json': { text: JSON.stringify({ workouts: [{ id: 'w1', d: '2026-10-01' }], routines: [], targetW: 70 }), sha: 'a1' }
  }
  n = 0; puts = []
  localStorage.clear()
  globalThis.fetch = vi.fn(async (u, i) => fakeFetch(u, i))
  vi.resetModules()
  gd = await import('./github-data.js')
  gd.setGithubToken('tok')
})

describe('github-data', () => {
  it('signs in as a listed client and hands out its file as the server would', async () => {
    expect((await gd.githubApi('/api/profiles')).profiles).toEqual([{ id: 'client1', name: 'Ana' }])
    await expect(gd.githubApi('/api/me')).rejects.toMatchObject({ status: 401 })
    await expect(gd.githubApi('/api/profiles/login', { method: 'POST', body: '{"uid":"nobody"}' })).rejects.toMatchObject({ status: 404 })
    await gd.githubApi('/api/profiles/login', { method: 'POST', body: '{"uid":"client1"}' })
    expect((await gd.githubApi('/api/me')).user).toEqual({ id: 'client1', name: 'Ana', admin: false })
    const { state, rev } = await gd.githubApi('/api/data')
    expect(rev).toBe(0)
    expect(state.targetW).toBe(70)
  })

  it('commits a change, and skips a write that changes nothing in the profile', async () => {
    await gd.githubApi('/api/profiles/login', { method: 'POST', body: '{"uid":"client1"}' })
    const { state } = await gd.githubApi('/api/data')
    const r = await gd.githubApi('/api/data', { method: 'PUT', body: JSON.stringify({ state: { ...state, targetW: 68, active: { id: 'x' } }, baseRev: 0, stamped: true }) })
    expect(r.rev).toBe(1)
    expect(docOf('client1')).toMatchObject({ targetW: 68, _rev: 1 })
    expect(docOf('client1').active).toBeUndefined()   // a running workout stays on the device
    expect(puts).toEqual(['Ana: data from the app'])
    const again = await gd.githubApi('/api/data', { method: 'PUT', body: JSON.stringify({ state: { ...docOf('client1'), active: { id: 'y' } }, baseRev: 1, baseWid: r.wid, stamped: true }) })
    expect(again.rev).toBe(1)
    expect(puts).toHaveLength(1)
  })

  it('answers a stale write with a 409 carrying the newer file, as the server does', async () => {
    await gd.githubApi('/api/profiles/login', { method: 'POST', body: '{"uid":"client1"}' })
    const { state } = await gd.githubApi('/api/data')
    // another phone commits in between
    repo['data/state-client1.json'] = { text: JSON.stringify({ ...state, targetW: 65, _rev: 1, _wid: 'other' }), sha: 'b2' }
    const err = await gd.githubApi('/api/data', { method: 'PUT', body: JSON.stringify({ state: { ...state, targetW: 68 }, baseRev: 0, stamped: true }) }).catch(e => e)
    expect(err.status).toBe(409)
    expect(err.data).toMatchObject({ rev: 1, state: { targetW: 65 } })
    expect(docOf('client1').targetW).toBe(65)
    // the store merges and pushes again over the revision it was handed
    const ok = await gd.githubApi('/api/data', { method: 'PUT', body: JSON.stringify({ state: { ...err.data.state, targetW: 68 }, baseRev: 1, baseWid: 'other', stamped: true }) })
    expect(ok.rev).toBe(2)
    expect(docOf('client1')).toMatchObject({ targetW: 68, _rev: 2 })
  })

  it('reports a refused key as unreachable, never as signed out, and offline as offline', async () => {
    gd.setGithubToken('bad')
    await expect(gd.githubApi('/api/profiles')).rejects.toMatchObject({ status: 503, code: 'github-auth' })
    gd.setGithubToken('tok')
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    const e = await gd.githubApi('/api/profiles').catch(x => x)
    expect(e.status).toBeUndefined()
  })

  it('takes the key from a setup link and clears it off the address', async () => {
    localStorage.clear()
    history.replaceState(null, '', '/gym/#key=github_pat_abc')
    expect(gd.takeTokenFromUrl()).toBe(true)
    expect(gd.githubToken()).toBe('github_pat_abc')
    expect(location.hash).toBe('')
  })
})
