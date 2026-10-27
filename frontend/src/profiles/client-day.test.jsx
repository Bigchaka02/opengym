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
const { closeEarlierDay, planChangedSince } = await import('./ClientToday.jsx')
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

const mountDay = sets => {
  setState(day(todayISO(), sets))
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}
const finishBtn = () => container.querySelector('.og-chipline .whdr-finish')
const lastSheet = () => {
  const sheet = useUI.getState().sheets.at(-1)
  if (!sheet) return null
  const el = document.body.appendChild(document.createElement('div'))
  const r = createRoot(el)
  act(() => r.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return { el, text: el.textContent, done: () => { act(() => r.unmount()); el.remove() } }
}

describe("a client's Finish", () => {
  beforeEach(() => { client = true; useUI.setState({ sheets: [] }) })

  it('is dimmed until every set is ticked', () => {
    mountDay([open(), open()])
    expect(finishBtn().classList.contains('og-dim')).toBe(true)
    act(() => container.querySelector('[role="checkbox"][aria-label="Set 1 done"]').click())
    expect(finishBtn().classList.contains('og-dim')).toBe(true)
    act(() => container.querySelector('[role="checkbox"][aria-label="Set 2 done"]').click())
    expect(finishBtn().classList.contains('og-dim')).toBe(false)
  })

  it('with every set ticked: saves at once, nothing pops up', () => {
    const at = Date.now() - 60000
    mountDay([ticked(at), ticked(at + 30000)])
    act(() => finishBtn().click())
    expect(useUI.getState().sheets).toHaveLength(0)
    const S = useStore.getState().S
    expect(S.active).toBeNull()
    expect(S.workouts).toHaveLength(1)
  })

  it('with sets left: asks to end the incomplete workout, End Workout saves it, no Discard anywhere', () => {
    mountDay([ticked(Date.now() - 60000), open()])
    act(() => finishBtn().click())
    const sheet = lastSheet()
    expect(sheet.text).toContain('End Today’s Incomplete Workout?')
    expect(sheet.text).not.toContain('Discard')
    act(() => [...sheet.el.querySelectorAll('.menu-item')].find(b => b.textContent.includes('End Workout')).click())
    sheet.done()
    const S = useStore.getState().S
    expect(S.active).toBeNull()
    expect(S.workouts).toHaveLength(1)
  })

  it("the ⋯ menu has no Discard for a client, and still has it for the coach", () => {
    for (const asClient of [true, false]) {
      client = asClient
      useUI.setState({ sheets: [] })
      mountDay([open(), open()])
      act(() => container.querySelector('[aria-label="Workout options"]').click())
      const sheet = lastSheet()
      expect(sheet.text.includes('Discard workout'), asClient ? 'client' : 'coach').toBe(!asClient)
      sheet.done()
      act(() => root.unmount()); container.remove(); root = null
    }
  })
})

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

describe("a client's open day follows the coach's plan until something is ticked", () => {
  const plan = (routineTs = 1000, today = todayISO()) => {
    const S = JSON.parse(JSON.stringify(DEF))
    S.routines = [{ id: 'push', name: 'Push Day', ex: [{ id: '0576', sets: 3, reps: 10 }], _ts: routineTs }, { id: 'pull', name: 'Pull Day', ex: [{ id: '0027', sets: 3, reps: 10 }], _ts: 1 }]
    S.dayPlan = { [today]: 'push' }
    return S
  }
  const laidOut = (extra = {}, sets = [open()]) => ({ ...day(todayISO(), sets), routineIds: ['push'], clientDay: true, planAt: 1000, ...extra })

  it('stays when nothing changed', () => {
    expect(planChangedSince(plan(1000), laidOut())).toBe(false)
  })
  it('is laid out again when the routine was edited after it was built', () => {
    expect(planChangedSince(plan(2000), laidOut())).toBe(true)
  })
  it('is laid out again when today now has another routine', () => {
    const S = plan(1000); S.dayPlan[todayISO()] = 'pull'
    expect(planChangedSince(S, laidOut())).toBe(true)
  })
  it("stays once a set is ticked: that day is the client's own", () => {
    expect(planChangedSince(plan(2000), laidOut({}, [ticked(Date.now()), open()]))).toBe(false)
  })
  it('a day from before planAt was kept is judged by when it was laid out', () => {
    expect(planChangedSince(plan(5000), laidOut({ planAt: undefined, start: 4000 }))).toBe(true)
    expect(planChangedSince(plan(3000), laidOut({ planAt: undefined, start: 4000 }))).toBe(false)
  })
})
