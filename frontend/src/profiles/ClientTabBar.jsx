// Coach/client fork (PROJECT.md): the client UI's whole navigation — two tabs, in the stock tab
// bar's styling (#tabbar in index.css), in place of its five.
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'

// The pages the Stats tab opens on its own (History, Structural balance…) keep the tab lit.
export const CLIENT_STATS_PATHS = ['stats', 'history', 'muscles', 'structural-balance', 'progress-photos', 'measurements']

export default function ClientTabBar() {
  const nav = useNavigate()
  const cur = useLocation().pathname.split('/')[1]
  const stats = CLIENT_STATS_PATHS.includes(cur)
  return (
    <nav id="tabbar" className="og-client-tabs">
      <button className={stats ? '' : 'on'} onClick={() => nav('/workout')}>
        <span className="tab-ic"><Icon name="dumbbell" /></span><span>{t('Today')}</span>
      </button>
      <button className={stats ? 'on' : ''} onClick={() => nav('/stats')}>
        <span className="tab-ic"><Icon name="chart" /></span><span>{t('Stats')}</span>
      </button>
    </nav>
  )
}
