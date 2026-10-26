// @vitest-environment happy-dom
// Coach/client fork (PROJECT.md): a client's day is a checklist, never a timed workout — no rest
// timer after a tick, the saved workout spans the first tick to the last, and a day left open
// closes itself on a later day (saved if anything was ticked, dropped if not).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let client = true
vi.mock('./profiles.js', () => ({
  isClientUI: () => client,
  currentProfile: () => (client ? { role: 'client', uid: 'client1' } : null),
  clientName: () => 'Haitham', clientList: () => [], profileFor: vi.fn(), switchProfile: vi.fn(),
  needsKey: () => false, usesGithub: () => false, connectGithub: vi.fn(),
}))
vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))

const { default: Workout } = await import('../views/Workout.jsx')
const { DEF, useStore } = await import('../store/useStore.js')
const { useUI } = await import('../store/useUI.js')
const { finishWorkoutQuietly } = await import('../sheets.jsx')
const { closeEarlierDay } = await import('./ClientToday.jsx')
const { todayISO, isoOf } = await import('../lib/format.js')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return isoOf(d) }
const day = (d, sets) => ({
  id: 'day', d, start: Date.now() - 3 * 3600000, routineIds: [], name: 'Push Day', bw: null, cur: 0, workoutView: 'cards',
  entries: [{ id: '0025', target: { sets: sets.length, reps: 8 }, sets }],
})
const open = (w = 135) => ({ w, r: 8, done: false })
const ticked = at => ({ w: 135, r: 8, done: true, at })
function setState(active) {
  const S = JSON.parse(JSON.stringify(DEF))
  S.active = active
  useStore.setState({ S, user: null })
}
beforeEach(() => { useUI.getState().stopRest() })

let root, container
afterEach(() => { if (root) { act(() => root.unmount()); container.remove(); root = null } })

describe("a client's day", () => {
  for (const asClient of [true, false]) {
    it(`${asClient ? 'client: no rest timer' : 'coach: the rest timer as openGym has it'} after a tick`, () => {
      client = asClient
      setState(day(todayISO(), [open(), open()]))
      container = document.body.appendChild(document.createElement('div'))
      root = createRoot(container)
      act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
      act(() => container.querySelector('[role="checkbox"][aria-label="Set 1 done"]').click())
      expect(useStore.getState().S.active.entries[0].sets[0].done).toBe(true)
      expect(!!useUI.getState().timer).toBe(!asClient)
    })
  }

  it('is saved from the first tick to the last, however long the page sat open', () => {
    client = true
    const first = Date.now() - 25 * 60000, last = Date.now() - 12 * 60000
    setState(day(todayISO(), [ticked(first), ticked(first + 6 * 60000), ticked(last)]))
    finishWorkoutQuietly()
    const [w] = useStore.getState().S.workouts
    expect(w.start).toBe(first)
    expect(w.end).toBeGreaterThanOrEqual(last)
    expect(w.end - w.start).toBeLessThan(45 * 60000)   // not the three hours since the page opened
    expect(useStore.getState().S.active).toBeNull()
  })

  it('left open past midnight: saved under its own day when something was ticked', () => {
    client = true
    const at = Date.now() - 20 * 3600000
    setState(day(yesterday(), [ticked(at), open()]))
    closeEarlierDay()
    const S = useStore.getState().S
    expect(S.active).toBeNull()
    expect(S.workouts.map(w => w.d)).toEqual([yesterday()])
  })

  it('left open past midnight with nothing ticked: dropped, nothing logged', () => {
    client = true
    setState(day(yesterday(), [open(), open()]))
    closeEarlierDay()
    const S = useStore.getState().S
    expect(S.active).toBeNull()
    expect(S.workouts).toEqual([])
  })

  it("today's open day is left alone", () => {
    client = true
    setState(day(todayISO(), [open(), open()]))
    closeEarlierDay()
    expect(useStore.getState().S.active?.id).toBe('day')
  })
})
