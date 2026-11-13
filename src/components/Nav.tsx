import { FEATURES } from '../lib/features';
import { Seal } from './ui';
import { WalletEntry } from './WalletEntry';

export function Nav({ current }: { current: string }) {
  return (
    <nav className="nav" aria-label="Features">
      <a className="nav-brand" href="#overview">
        <Seal />
        <div>
          <strong>Kamui</strong>
          <span>Feature demo</span>
        </div>
      </a>
      <div className="nav-wallet">
        <WalletEntry variant="nav" />
      </div>
      <div className="nav-kicker">Features</div>
      {FEATURES.map((f) => (
        <a key={f.id} href={`#${f.id}`} className={`item ${current === f.id ? 'active' : ''}`}>
          {f.nav}
          {f.badges.includes('live') ? <small>live</small> : null}
        </a>
      ))}
    </nav>
  );
}
