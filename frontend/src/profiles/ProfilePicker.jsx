// Coach/client fork (PROJECT.md): "who is using the app" — on every fresh launch, and from the
// profile icon at the top left. Presentational: the caller decides what a tap does.
import Icon from '../components/Icon.jsx'
import { clientList } from './profiles.js'
import './profiles.css'

export default function ProfilePicker({ current, onPick, onClose }) {
  const tiles = [
    { key: 'coach', name: 'Coach', sub: 'Plans the workouts · every client’s stats and settings', icon: 'clipboard' },
    ...clientList().map(c => ({ key: c.id, name: c.name, sub: 'Today’s workout and stats', icon: 'person' }))
  ]
  const on = k => !!current && (k === 'coach' ? current.role === 'coach' : current.role === 'client' && current.uid === k)
  return <div className="og-picker" role="dialog" aria-modal="true" aria-label="Choose a profile">
    <div className="og-picker-in">
      {onClose && <button className="iconbtn og-picker-x" aria-label="Close" onClick={onClose}><Icon name="xmark" /></button>}
      <div className="og-picker-logo"><Icon name="dumbbell" /></div>
      <h1>Who&rsquo;s using openGym?</h1>
      <div className="list">
        {tiles.map(p => <button key={p.key} className={'item og-tile' + (on(p.key) ? ' on' : '')} onClick={() => onPick(p.key)}>
          <span className={'og-av' + (p.key === 'coach' ? ' coach' : '')}><Icon name={p.icon} /></span>
          <span className="grow"><span className="tt">{p.name}</span><span className="ss">{p.sub}</span></span>
          {on(p.key) ? <Icon name="check" className="og-tick" /> : <Icon name="chevronRight" className="chev" />}
        </button>)}
      </div>
    </div>
  </div>
}
