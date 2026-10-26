// Coach/client fork (PROJECT.md): the profile icon at the top left of every page, and — for the
// coach only — the dropdown under it that picks which client he is looking at and acting for.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../components/Icon.jsx'
import ProfilePicker from './ProfilePicker.jsx'
import { clientList, clientName, currentProfile, profileFor, switchProfile } from './profiles.js'

// `inline`: inside a client's workout header (views/Workout.jsx), in place of the page-top bar.
export default function ProfileBar({ inline = false }) {
  const p = currentProfile()
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!p) return null
  const coach = p.role === 'coach'
  const name = coach ? 'Coach' : clientName(p.uid)
  const go = async next => { setBusy(true); try { await switchProfile(next) } finally { setBusy(false) } }
  return <div className={'og-pbar' + (inline ? ' inline' : '')}>
    <button className="og-pme" onClick={() => setPicking(true)} aria-label={'Profile: ' + name + '. Switch profile'}>
      <span className={'og-pbtn' + (coach ? ' coach' : '')}><Icon name={coach ? 'clipboard' : 'person'} /></span>
      <span className="og-pname">{name}</span>
    </button>
    {coach && <label className="og-csel">
      <span className="og-sr">Client</span>
      <select value={p.uid} disabled={busy} onChange={e => go({ role: 'coach', uid: e.target.value })}>
        {clientList().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <Icon name="chevronDown" />
    </label>}
    {picking && createPortal(<ProfilePicker current={p} onClose={() => setPicking(false)}
      onPick={key => { setPicking(false); go(profileFor(key)) }} />, document.body)}
  </div>
}
