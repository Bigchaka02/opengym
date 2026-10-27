// @vitest-environment happy-dom
// Coach/client fork (PROJECT.md): choosing a profile before the app boots, and signing this
// browser in as its client — the picker on a fresh launch only, the coach back on his last client.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = []
let me = null
vi.mock('../lib/api.js', () => ({
  api: vi.fn(async (path, opts = {}) => {
    calls.push([path, opts.method || 'GET', opts.body ? JSON.parse(opts.body) : undefined])
    if (path === '/api/profiles') return { profiles: [{ id: 'client1', name: 'Ana' }, { id: 'client2', name: 'Ben' }] }
    if (path === '/api/me') { if (!me) throw Object.assign(new Error('no'), { status: 401 }); return { user: me } }
    if (path === '/api/profiles/login') { me = { id: opts.body && JSON.parse(opts.body).uid }; return { user: me } }
    return {}
  })
}))

const fresh = async () => { vi.resetModules(); return import('./profiles.js') }

beforeEach(() => { calls.length = 0; me = null; localStorage.clear(); sessionStorage.clear() })

describe('bootProfile', () => {
  it('asks on a fresh launch and signs in as the client picked', async () => {
    const P = await fresh()
    const picker = vi.fn(async () => P.profileFor('client2'))
    await P.bootProfile(picker)
    expect(picker).toHaveBeenCalledOnce()
    expect(P.currentProfile()).toEqual({ role: 'client', uid: 'client2' })
    expect(P.isClientUI()).toBe(true)
    expect(P.clientName('client2')).toBe('Ben')
    expect(calls).toContainEqual(['/api/profiles/login', 'POST', { uid: 'client2' }])
  })

  it('does not ask again within the same launch, and leaves a matching session alone', async () => {
    let P = await fresh()
    await P.bootProfile(async () => P.profileFor('coach'))
    calls.length = 0
    P = await fresh()
    const picker = vi.fn()
    await P.bootProfile(picker)
    expect(picker).not.toHaveBeenCalled()
    expect(P.currentProfile()).toEqual({ role: 'coach', uid: 'client1' })
    expect(P.isClientUI()).toBe(false)
    expect(calls.some(c => c[0] === '/api/profiles/login')).toBe(false)
  })

  it('asks again on the next launch, with the last profile to highlight', async () => {
    let P = await fresh()
    await P.bootProfile(async () => P.profileFor('client1'))
    sessionStorage.clear()   // the app was closed
    P = await fresh()
    const picker = vi.fn(async () => P.profileFor('client1'))
    await P.bootProfile(picker)
    expect(picker).toHaveBeenCalledWith({ role: 'client', uid: 'client1' })
  })

  it('opens on what it kept when the server cannot be reached', async () => {
    const P = await fresh()
    const { api } = await import('../lib/api.js')
    api.mockImplementationOnce(async () => { throw new Error('offline') })   // /api/profiles
      .mockImplementationOnce(async () => { throw new Error('offline') })   // /api/me
    await P.bootProfile(async () => P.profileFor('client2'))
    expect(calls.some(c => c[0] === '/api/profiles/login')).toBe(false)
    expect(P.currentProfile()).toEqual({ role: 'client', uid: 'client2' })
  })
})

describe('profileFor', () => {
  it('takes the coach back to the client he had last', async () => {
    const P = await fresh()
    await P.bootProfile(async () => ({ role: 'coach', uid: 'client2' }))
    expect(P.profileFor('coach')).toEqual({ role: 'coach', uid: 'client2' })
    expect(P.profileFor('client1')).toEqual({ role: 'client', uid: 'client1' })
  })
})

describe('dropUntouchedClientDay', () => {
  const store = active => {
    const st = { S: { active } }
    return { st, getState: () => ({ S: st.S, update: fn => { const S = JSON.parse(JSON.stringify(st.S)); fn(S); st.S = S } }) }
  }
  const day = (extra, done = false) => ({ id: 'a', d: '2026-10-27', start: 1, entries: [{ id: '0025', sets: [{ w: 135, r: 8, done }] }], ...extra })

  it("clears the day Today laid out when nothing on it is ticked", async () => {
    const P = await fresh()
    const s = store(day({ clientDay: true }))
    await P.dropUntouchedClientDay(s)
    expect(s.st.S.active).toBeNull()
  })

  it('keeps a workout the coach started or edited, and a client day with a tick', async () => {
    const P = await fresh()
    for (const active of [day({}), day({ clientDay: true }, true)]) {
      const s = store(active)
      await P.dropUntouchedClientDay(s)
      expect(s.st.S.active?.id).toBe('a')
    }
  })
})
