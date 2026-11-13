import { useEffect, useState } from 'react';
import { Nav, WALLET_NAV } from './components/Nav';
import { WalletDashboard } from './components/WalletDashboard';
import { WalletEntry, WalletProvider, useWallet } from './components/WalletEntry';
import { Seal } from './components/ui';
import { FEATURES } from './lib/features';
import { KAMUI_COMMIT, isLoginCallbackPath } from './lib/config';
import { DemoKeychain } from './DemoKeychain';
import { LoginCallback } from './sections/LoginCallback';
import {
  Overview,
  SocialLogin,
  PepperFileSection,
  AccountAddress,
  KeychainConnect,
  SessionScopes,
  SpendingPolicies,
  SponsoredCalls,
  OutOfScope,
  OneOffExecute,
  TokenAmounts,
  SelfPaid,
  Owners,
  SessionRegistry,
  Revocation,
  AccountReader,
  OutsideExecution,
  ClientProving,
  Security,
} from './sections';
import { DemoKeychainToggle } from './components/DemoKeychainToggle';

function keychainKind(): 'connect' | 'execute' | null {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path.endsWith('/keychain/connect') || (path.endsWith('/connect') && path.includes('keychain'))) return 'connect';
  if (path.endsWith('/keychain/execute') || (path.endsWith('/execute') && path.includes('keychain'))) return 'execute';
  return null;
}

const PAGE_IDS = [...WALLET_NAV.map((i) => i.id), 'how-it-works', ...FEATURES.map((f) => f.id)];

function currentSection(): string {
  const id = window.location.hash.replace(/^#/, '');
  return PAGE_IDS.includes(id) ? id : 'top';
}

export function App() {
  const kind = keychainKind();
  const [current, setCurrent] = useState(currentSection);

  useEffect(() => {
    const onHash = () => setCurrent(currentSection());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (isLoginCallbackPath(window.location.pathname)) return <LoginCallback />;
  if (kind) return <DemoKeychain kind={kind} />;

  return (
    <WalletProvider>
      <Shell current={current} />
    </WalletProvider>
  );
}

function Shell({ current }: { current: string }) {
  const { connection } = useWallet();

  return (
    <div className="shell">
      <Nav current={current} connected={Boolean(connection)} />
      <main className="main">
        {connection ? (
          <WalletDashboard />
        ) : (
          <header className="hero hero-clean" id="top">
            <div className="hero-mark">神威</div>
            <p className="eyebrow">Starknet Innovation · Sepolia</p>
            <h1>
              Your Starknet wallet, <em>with Google</em>
            </h1>
            <p className="lede lede-one">
              Sign in with Google to get a wallet — then send funds and interact with contracts on Starknet Sepolia.
            </p>
            <WalletEntry variant="hero" />
          </header>
        )}

        <section className="how-it-works" id="how-it-works">
          <header className="how-it-works-head">
            <p className="eyebrow">Under the hood</p>
            <h2>How it works</h2>
            <p className="sub">
              Kamui’s features, one playground per topic. Each section still runs the real SDK in your browser.
              Sponsored session calls stay labeled: this static site cannot hold a sponsor token.
            </p>
            <DemoKeychainToggle />
          </header>
          <Overview />
          <SocialLogin />
          <PepperFileSection />
          <AccountAddress />
          <KeychainConnect />
          <SessionScopes />
          <SpendingPolicies />
          <SponsoredCalls />
          <OutOfScope />
          <OneOffExecute />
          <TokenAmounts />
          <SelfPaid />
          <Owners />
          <SessionRegistry />
          <Revocation />
          <AccountReader />
          <OutsideExecution />
          <ClientProving />
          <Security />
        </section>

        <p className="legal">
          <Seal size={24} /> &nbsp; Kamui and this demo are MIT-licensed. Contracts and SDK are unaudited;
          do not hold real funds. Vendored SDK from{' '}
          <a href="https://github.com/starknet-innovation/kamui">starknet-innovation/kamui</a> at{' '}
          <code>{KAMUI_COMMIT}</code>.
        </p>
      </main>
    </div>
  );
}
