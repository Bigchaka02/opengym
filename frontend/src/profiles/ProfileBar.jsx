// Coach/client fork (PROJECT.md): the profile icon at the top left of every page, and — for the
// coach only — the dropdown under it that picks which client he is looking at and acting for.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../components/Icon.jsx'
import ProfilePicker from './ProfilePicker.jsx'
import { clientList, clientName, currentProfile, profileFor, switchProfile } from './profiles.js'

export default function ProfileBar() {
  const p = currentProfile()
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!p) return null
  const coach = p.role === 'coach'
  const go = async next => { setBusy(true); try { await switchProfile(next) } finally { setBusy(false) } }
  return <div className="og-pbar">
    <button className={'og-pbtn' + (coach ? ' coach' : '')} onClick={() => setPicking(true)}
      aria-label={'Profile: ' + (coach ? 'Coach' : clientName(p.uid)) + '. Switch profile'} title={coach ? 'Coach' : clientName(p.uid)}>
      <Icon name={coach ? 'clipboard' : 'person'} />
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
