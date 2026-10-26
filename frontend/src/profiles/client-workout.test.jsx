// @vitest-environment happy-dom
// Coach/client fork (PROJECT.md): a client's live workout keeps the stock screen minus the clock,
// the ⌄ (minimize), Prev/Next (the cards swipe), Add exercise, the session note and the bottom
// Finish button. The coach's screen is the stock one.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

let client = false
vi.mock('./profiles.js', () => ({ isClientUI: () => client }))
vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))

const { default: Workout } = await import('../views/Workout.jsx')
const { DEF, useStore } = await import('../store/useStore.js')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, container

function mount(asClient, extra = {}) {
  client = asClient
  const S = JSON.parse(JSON.stringify(DEF))
  S.active = {
    id: 'w', d: '2026-10-25', start: Date.now() - 65000, routineIds: [], name: 'Push Day', bw: null, cur: 0, workoutView: 'cards',
    entries: ['0025', '0047'].map(id => ({ id, target: { sets: 2, min: 8, max: 8 }, sets: [{ w: 60, r: 8, done: false }, { w: 60, r: 8, done: false }] })),
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

describe('the workout screen', () => {
  it('for a client: no clock, ⌄, Prev/Next, Add exercise, session note or bottom Finish', () => {
    mount(true)
    expect(container.querySelector('.whdr-mid .sub').textContent).toBe('0/4 sets')
    expect(container.querySelector('.whdr-bar [aria-label="Minimize"]')).toBeNull()   // the animation's own Minimize stays
    for (const gone of ['Prev', 'Next', 'Add exercise', 'Add session note', 'Finish workout early']) expect(text()).not.toContain(gone)
    expect(labels()).toContain('Finish')   // the header's Finish stays
  })

  it('for the coach: all of it, as openGym has it', () => {
    mount(false)
    expect(container.querySelector('.whdr-mid .sub').textContent).toMatch(/^\d+:\d\d · 0\/4 sets$/)
    expect(container.querySelector('.whdr-bar [aria-label="Minimize"]')).not.toBeNull()
    for (const kept of ['Prev', 'Next', 'Add exercise', 'Add session note', 'Finish workout early']) expect(text()).toContain(kept)
  })
})
