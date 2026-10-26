// Coach/client fork (PROJECT.md): "who is using the app" — on every fresh launch, and from the
// profile icon at the top left. The caller decides what a tap does. In the GitHub Pages build it
// first asks for the repo key on a device that has none, and offers the link that sets up another.
import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { clientList, connectGithub, needsKey, usesGithub } from './profiles.js'
import { repoName, setupLink } from './github-data.js'
import './profiles.css'

function KeyForm({ onDone }) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async e => {
    e.preventDefault()
    if (!key.trim()) return
    setBusy(true); setError('')
    try { await connectGithub(key); onDone() }
    catch (err) { setError(err?.code === 'github-auth' ? 'GitHub did not accept that key for ' + repoName() + '.' : (err?.message || 'GitHub could not be reached.')) }
    finally { setBusy(false) }
  }
  return <form className="og-key" onSubmit={submit}>
    <p className="muted small">This app saves straight to the <b>{repoName()}</b> repo on GitHub. Open the setup link from your coach, or paste the repo key once on this device.</p>
    <input className="og-key-in" type="password" autoComplete="off" spellCheck="false" placeholder="github_pat_…"
      value={key} onChange={e => setKey(e.target.value)} aria-label="GitHub key" />
    {error && <p className="og-key-err small">{error}</p>}
    <button className="btn primary" type="submit" disabled={busy || !key.trim()}>{busy ? 'Checking…' : 'Connect'}</button>
  </form>
}

export default function ProfilePicker({ current, onPick, onClose }) {
  const [, setTick] = useState(0)
  const [shared, setShared] = useState('')
  const asking = needsKey()
  const tiles = [
    { key: 'coach', name: 'Coach', sub: 'Plans the workouts · every client’s stats and settings', icon: 'clipboard' },
    ...clientList().map(c => ({ key: c.id, name: c.name, sub: 'Today’s workout and stats', icon: 'person' }))
  ]
  const on = k => !!current && (k === 'coach' ? current.role === 'coach' : current.role === 'client' && current.uid === k)
  const share = async () => {
    const url = setupLink()
    try {
      if (navigator.share) { await navigator.share({ title: 'openGym setup link', url }); return }
      await navigator.clipboard.writeText(url); setShared('Setup link copied.')
    } catch { setShared(url) }
  }
  return <div className="og-picker" role="dialog" aria-modal="true" aria-label="Choose a profile">
    <div className="og-picker-in">
      {onClose && <button className="iconbtn og-picker-x" aria-label="Close" onClick={onClose}><Icon name="xmark" /></button>}
      <div className="og-picker-logo"><Icon name="dumbbell" /></div>
      <h1>{asking ? 'Connect to GitHub' : 'Who’s using openGym?'}</h1>
      {asking ? <KeyForm onDone={() => setTick(n => n + 1)} /> : <div className="list">
        {tiles.map(p => <button key={p.key} className={'item og-tile' + (on(p.key) ? ' on' : '')} onClick={() => onPick(p.key)}>
          <span className={'og-av' + (p.key === 'coach' ? ' coach' : '')}><Icon name={p.icon} /></span>
          <span className="grow"><span className="tt">{p.name}</span><span className="ss">{p.sub}</span></span>
          {on(p.key) ? <Icon name="check" className="og-tick" /> : <Icon name="chevronRight" className="chev" />}
        </button>)}
      </div>}
      {usesGithub() && !asking && onClose && <div className="og-picker-foot">
        <button className="btn ghost" onClick={share}><Icon name="share" /> Share setup link for another phone</button>
        {shared && <p className="small muted og-shared">{shared}</p>}
      </div>}
    </div>
  </div>
}
