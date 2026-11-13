import { FEATURES } from '../lib/features';
import { Seal } from './ui';
import { WalletEntry } from './WalletEntry';

export const WALLET_NAV = [
  { id: 'wallet', nav: 'Wallet' },
  { id: 'send', nav: 'Send' },
  { id: 'interact', nav: 'Interact' },
  { id: 'activity', nav: 'Activity' },
] as const;

export function Nav({ current, connected }: { current: string; connected: boolean }) {
  return (
    <nav className="nav" aria-label="Features">
      <a className="nav-brand" href={connected ? '#wallet' : '#top'}>
        <Seal />
        <div>
          <strong>Kamui</strong>
          <span>Wallet demo</span>
        </div>
      </a>
      <div className="nav-wallet">
        <WalletEntry variant="nav" />
      </div>
      {connected ? (
        <>
          <div className="nav-kicker">Wallet</div>
          {WALLET_NAV.map((item) => (
            <a key={item.id} href={`#${item.id}`} className={`item ${current === item.id ? 'active' : ''}`}>
              {item.nav}
            </a>
          ))}
        </>
      ) : null}
      <div className="nav-kicker">How it works</div>
      <a href="#how-it-works" className={`item ${current === 'how-it-works' ? 'active' : ''}`}>
        Overview
      </a>
      {FEATURES.filter((f) => f.id !== 'overview').map((f) => (
        <a key={f.id} href={`#${f.id}`} className={`item ${current === f.id ? 'active' : ''}`}>
          {f.nav}
          {f.badges.includes('live') ? <small>live</small> : null}
        </a>
      ))}
    </nav>
  );
}
