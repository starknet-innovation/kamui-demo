import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isConnectionAlive, type Connection } from '@kamui/sdk';
import { RpcProvider } from 'starknet';
import { Button } from './ui';
import {
  DEFAULT_KEYCHAIN_URL,
  LIVE_SPONSOR,
  RPC_URL,
  isDemoKeychain,
  preferDemoKeychain,
  setPreferDemoKeychain,
} from '../lib/config';
import { consumeKeychainReturn, disconnectKamui, startKamuiConnect } from '../lib/connect';

type WalletContextValue = {
  connection: Connection | null;
  message: string;
  tone: 'ok' | 'bad' | 'info';
  preferDemo: boolean;
  setPreferDemo: (value: boolean) => void;
  start: () => void;
  disconnect: () => void;
  error: string;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'ok' | 'bad' | 'info'>('info');
  const [preferDemo, setPreferDemoState] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPreferDemoState(preferDemoKeychain());
    const result = consumeKeychainReturn();
    setConnection(result.connection);
    setMessage(result.message);
    setTone(result.tone);
    setReady(true);
  }, []);

  const setPreferDemo = useCallback((value: boolean) => {
    setPreferDemoKeychain(value);
    setPreferDemoState(value);
  }, []);

  const start = useCallback(() => {
    setError('');
    try {
      const href = startKamuiConnect(preferDemo);
      window.location.assign(href);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [preferDemo]);

  const disconnect = useCallback(() => {
    disconnectKamui();
    setConnection(null);
    setMessage('Disconnected. The session key was dropped from this tab’s sessionStorage.');
    setTone('info');
  }, []);

  const value = useMemo(
    () => ({ connection, message, tone, preferDemo, setPreferDemo, start, disconnect, error }),
    [connection, message, tone, preferDemo, setPreferDemo, start, disconnect, error],
  );

  // Don't render children until the return fragment has been consumed, so
  // KeychainConnect does not try to finishConnect a second time.
  if (!ready) return null;
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}

function formatExpiry(validUntil: number): string {
  const mins = Math.max(0, Math.round((validUntil - Date.now() / 1000) / 60));
  return `~${mins} min left`;
}

/** Prominent connect entry: button, or the connected account and session. */
export function WalletEntry({ variant = 'hero' }: { variant?: 'hero' | 'section' | 'nav' }) {
  const { connection, message, tone, preferDemo, setPreferDemo, start, disconnect, error } = useWallet();
  const demo = isDemoKeychain(preferDemo);

  if (connection) {
    const who = connection.account;
    const short = who.slice(0, 10) + '…' + who.slice(-6);
    return (
      <div className={`wallet-status wallet-status-${variant}`}>
        <div className="wallet-status-who">
          <strong>{demo ? 'Connected (demo keychain)' : 'Connected with Kamui'}</strong>
          <span>{variant === 'nav' ? short : who}</span>
        </div>
        {variant !== 'nav' ? (
          <>
            <p className="wallet-status-session">
              Session key <code>{connection.session.publicKey.slice(0, 18)}…</code>
              {' · '}maxCalls {connection.session.maxCalls}
              {' · '}{formatExpiry(connection.session.validUntil)}
              {demo ? ' · simulated — not registered on Sepolia' : ''}
            </p>
            {!demo && !LIVE_SPONSOR ? (
              <p className="wallet-status-account">
                Sponsored session calls (ping) are not available on this static site: they need a server
                that injects a private sponsor token, like <code>apps/demo-dapp/server.ts</code>. Connect
                and one-off execute (which the keychain itself submits) work without that. The recover and
                Google login steps already happened on <code>{DEFAULT_KEYCHAIN_URL}</code>.
              </p>
            ) : null}
            {message ? <p className={`wallet-status-msg ${tone}`}>{message}</p> : null}
            <div className="actions">
              <Button onClick={disconnect}>Disconnect</Button>
            </div>
          </>
        ) : (
          <div className="actions">
            <Button onClick={disconnect}>Disconnect</Button>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'nav') {
    return (
      <button type="button" className="btn primary nav-wallet-btn" onClick={start}>
        Connect with Kamui
      </button>
    );
  }

  return (
    <div className={`wallet-entry wallet-entry-${variant}`}>
      {variant === 'hero' ? (
        <p className="wallet-entry-lead">
          Connect through the Kamui keychain. You sign in with Google on{' '}
          <code>{demo ? 'the in-app demo keychain' : DEFAULT_KEYCHAIN_URL}</code>
          {demo
            ? ' (simulated — no Google, no on-chain session).'
            : ', which handles Google sign-in, pepper and recovery, then returns a scoped session to this app.'}
        </p>
      ) : null}
      <div className="actions">
        <Button variant="primary" onClick={start}>
          Connect with Kamui (Google)
        </Button>
      </div>
      {variant === 'hero' ? (
        <>
          <p className="wallet-entry-note">
            {LIVE_SPONSOR
              ? ''
              : 'Sponsored pings need a server-side sponsor token this GitHub Pages site cannot hold. After you connect, one-off execute still goes through the real keychain.'}
          </p>
          <label className="wallet-demo-toggle">
            <input
              type="checkbox"
              checked={preferDemo}
              onChange={(e) => setPreferDemo(e.target.checked)}
            />
            Use the in-app demo keychain instead (simulated approval, no on-chain session)
          </label>
        </>
      ) : null}
      {message ? <p className={`wallet-status-msg ${tone}`}>{message}</p> : null}
      {error ? <p className="wallet-entry-error">{error}</p> : null}
    </div>
  );
}

/** Optional on-chain liveness check, used by the Keychain section. */
export async function checkConnectionAlive(connection: Connection): Promise<boolean> {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  return isConnectionAlive(connection, provider);
}
