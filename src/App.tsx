import { useEffect, useState } from 'react';
import { Nav } from './components/Nav';
import { WalletEntry, WalletProvider } from './components/WalletEntry';
import { Seal } from './components/ui';
import { FEATURES } from './lib/features';
import { KAMUI_COMMIT, LIVE_KEYCHAIN, LIVE_SPONSOR, RPC_URL, isLoginCallbackPath } from './lib/config';
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

function keychainKind(): 'connect' | 'execute' | null {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path.endsWith('/keychain/connect') || path.endsWith('/connect') && path.includes('keychain')) return 'connect';
  if (path.endsWith('/keychain/execute') || path.endsWith('/execute') && path.includes('keychain')) return 'execute';
  return null;
}

function currentSection(): string {
  const id = window.location.hash.replace(/^#/, '');
  return FEATURES.some((f) => f.id === id) ? id : 'overview';
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
    <div className="shell">
      <Nav current={current} />
      <main className="main">
        <header className="hero" id="top">
          <div className="hero-mark">神威</div>
          <p className="eyebrow">Starknet Innovation · Sepolia</p>
          <h1>
            Kamui, <em>in full</em>
          </h1>
          <p className="lede">
            An interactive tour of every user-facing feature of Kamui — the embedded wallet with social login,
            session keys, spending limits and sponsored calls. Each section runs the real TypeScript SDK in
            your browser. Two of them also read Starknet Sepolia.
          </p>
          <WalletEntry variant="hero" />
          <div className="chips">
            <span className="chip seal">神 Kamui</span>
            <span className="chip">Starknet Sepolia</span>
            <span className="chip">SDK @{KAMUI_COMMIT.slice(0, 7)}</span>
            <span className="chip warn">Not audited</span>
            <span className={`chip ${LIVE_KEYCHAIN ? 'ok' : ''}`}>
              {LIVE_KEYCHAIN ? 'Hosted keychain' : 'Demo keychain'}
            </span>
            <span className={`chip ${LIVE_SPONSOR ? 'ok' : 'warn'}`}>
              {LIVE_SPONSOR ? 'Sponsor gateway' : 'Sponsored calls need a server'}
            </span>
            <span className="chip">RPC {new URL(RPC_URL).host}</span>
          </div>
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

        <p className="legal">
          <Seal size={24} /> &nbsp; Kamui and this demo are MIT-licensed. Contracts and SDK are unaudited;
          do not hold real funds. Vendored SDK from{' '}
          <a href="https://github.com/starknet-innovation/kamui">starknet-innovation/kamui</a> at{' '}
          <code>{KAMUI_COMMIT}</code>.
        </p>
      </main>
    </div>
    </WalletProvider>
  );
}
