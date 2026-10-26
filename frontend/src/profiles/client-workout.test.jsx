// @vitest-environment happy-dom
// Coach/client fork (PROJECT.md): a client's live workout keeps the stock screen minus the clock,
// the ⌄ (minimize), Prev/Next (the cards swipe), Add exercise, the session note, the bottom
// Finish button and the plan / last time / progression lines; the profile sits in the header and
// Finish beside the exercise chips, in every view. The coach's screen is the stock one.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

let client = false
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

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, container

function mount(asClient, extra = {}) {
  client = asClient
  const S = JSON.parse(JSON.stringify(DEF))
  // A history and a plan, so "Last time", "Plan: 2 × 8" and the progression line have something to say.
  S.workouts = [{ id: 'old', d: '2026-10-20', start: 1, end: 2, routineIds: ['r'], routineId: 'r', name: 'Push Day', entries: [{ id: '0025', sets: [{ w: 60, r: 8, done: true }, { w: 60, r: 8, done: true }] }] }]
  S.active = {
    id: 'w', d: '2026-10-25', start: Date.now() - 65000, routineIds: ['r'], name: 'Push Day', bw: null, cur: 0, workoutView: 'cards',
    entries: ['0025', '0047'].map(id => ({
      id, rid: 'r', target: { sets: 2, reps: 8 }, planned: { sets: 2, reps: 8 },
      plan: { kind: 'up', policy: 'linear', why: ['Every rep last time. {0} more.', '5 lb'] },
      sets: [{ w: 62.5, r: 8, done: false }, { w: 62.5, r: 8, done: false }]
    })),
    ...extra
  }
  useStore.setState({ S, user: null })
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}
afterEach(() => { act(() => root.unmount()); container.remove() })

const text = () => container.textContent
const labels = () => [...container.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || b.textContent.trim())

const GONE = ['Prev', 'Next', 'Add exercise', 'Add session note', 'Finish workout early', 'Plan:', 'Last time', 'Linear progression']
const finishIn = sel => [...container.querySelectorAll(sel + ' button')].some(b => b.textContent === 'Finish')

describe('the workout screen', () => {
  for (const view of ['cards', 'list', 'compact', 'focus']) {
    it(`for a client (${view}): profile in the header, Finish beside the chips, none of the rest`, () => {
      mount(true, { workoutView: view })
      expect(container.querySelector('.whdr-mid .sub').textContent).toBe('0/4 sets')
      expect(container.querySelector('.whdr-bar [aria-label="Minimize"]')).toBeNull()   // the animation's own Minimize stays
      expect(container.querySelector('.whdr-bar .og-pname').textContent).toBe('Haitham')
      for (const gone of GONE) expect(text(), gone).not.toContain(gone)
      expect(finishIn('.og-chipline')).toBe(true)
      expect(finishIn('.whdr-bar')).toBe(false)
      expect(labels().filter(l => l === 'Finish')).toHaveLength(1)
      expect(text()).not.toMatch(/\bkg\b/i)
    })
  }

  it('a profile starts in lb, and nothing on the screen says kg', () => {
    expect(DEF.unit).toBe('lb')
    for (const asClient of [true, false]) {
      mount(asClient)
      expect(text()).toContain('Weight (lb)')
      expect(text()).not.toMatch(/\bkg\b/i)
      act(() => root.unmount()); container.remove()
    }
    mount(false)   // for afterEach
  })

  it('for the coach: all of it, as openGym has it', () => {
    mount(false)
    expect(container.querySelector('.whdr-mid .sub').textContent).toMatch(/^\d+:\d\d · 0\/4 sets$/)
    expect(container.querySelector('.whdr-bar [aria-label="Minimize"]')).not.toBeNull()
    expect(container.querySelector('.og-pname')).toBeNull()
    for (const kept of GONE) expect(text(), kept).toContain(kept)
    expect(finishIn('.whdr-bar')).toBe(true)
    expect(container.querySelector('.og-chipline')).toBeNull()
  })
})
