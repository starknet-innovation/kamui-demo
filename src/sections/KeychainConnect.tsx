import { useEffect, useState } from 'react';
import {
  beginConnect,
  finishConnect,
  finishExecute,
  forgetConnection,
  isConnectionAlive,
  loadConnection,
  pendingRequestKind,
  type Connection,
} from '@kamui/sdk';
import { RpcProvider } from 'starknet';
import { FEATURES } from '../lib/features';
import { APP_NAME, LIVE_KEYCHAIN, RPC_URL, TARGET, activeKeychainUrl, isDemoKeychain } from '../lib/config';
import { Button, Callout, Card, Output, Section, Steps } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'keychain')!;

function redirectUri(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

export function KeychainConnect() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [log, setLog] = useState('');
  const [alive, setAlive] = useState<boolean | null>(null);

  useEffect(() => {
    const store = sessionStorage;
    try {
      if (pendingRequestKind(store) === 'execute') {
        try {
          const sent = finishExecute(window.location.hash, store);
          if (sent) setLog('You approved a one-off call: ' + sent.transactionHash);
        } catch (error) {
          setLog('One-off call not sent: ' + (error as Error).message);
        }
        history.replaceState(null, '', window.location.pathname + window.location.search + '#keychain');
      } else {
        const fresh = finishConnect(window.location.hash, store);
        if (fresh) {
          history.replaceState(null, '', window.location.pathname + window.location.search + '#keychain');
          setConnection(fresh);
          setLog(
            isDemoKeychain()
              ? 'The demo keychain returned a simulated approval. No session was registered on Sepolia.'
              : 'The keychain approved the session.',
          );
          return;
        }
      }
    } catch (error) {
      if (window.location.hash.includes('kamui=')) {
        setLog('Not connected: ' + (error as Error).message);
        history.replaceState(null, '', window.location.pathname + window.location.search + '#keychain');
      }
    }
    setConnection(loadConnection(sessionStorage));
  }, []);

  async function checkAlive() {
    if (!connection) return;
    try {
      const provider = new RpcProvider({ nodeUrl: RPC_URL });
      const ok = await isConnectionAlive(connection, provider);
      setAlive(ok);
    } catch (error) {
      setAlive(false);
      setLog('Could not read the account: ' + (error as Error).message);
    }
  }

  function connect() {
    const url = beginConnect(
      {
        keychainUrl: activeKeychainUrl(),
        redirectUri: redirectUri(),
        appName: APP_NAME,
        validUntil: Math.floor(Date.now() / 1000) + 2 * 3600,
        maxCalls: 20,
        calls: [{ to: TARGET, entrypoint: 'ping' }],
      },
      sessionStorage,
    );
    window.location.assign(url);
  }

  function disconnect() {
    forgetConnection(sessionStorage);
    setConnection(null);
    setAlive(null);
    setLog('Disconnected. The session key was dropped from this tab’s sessionStorage.');
  }

  return (
    <Section feature={feature}>
      <Steps
        items={[
          { title: 'beginConnect', body: 'The app creates a session key, stores it, and sends the user to /connect with the request in the URL fragment.' },
          { title: 'The keychain', body: 'Signs the user in if needed, checks who is asking (referrer must match the redirect origin), runs sessionProblems, and on approval has the account register the session (an owner-signed sponsored call).' },
          { title: 'finishConnect', body: 'The user comes back with the account address. From then on the app signs calls itself. The session private key never left the app; the device key never left the keychain.' },
        ]}
      />
      <Callout tone={LIVE_KEYCHAIN ? 'ok' : 'info'}>
        {LIVE_KEYCHAIN ? (
          <>
            A hosted keychain is configured at <code>{activeKeychainUrl()}</code>. Connect will leave this page
            for a real approval.
          </>
        ) : (
          <>
            <strong>No hosted keychain is configured</strong> (<code>sepolia.kamui.page</code> is the planned
            origin, not yet deployed). Connect opens this demo’s in-app keychain, which runs the real{' '}
            <code>parseConnectRequest</code> and <code>sessionProblems</code> checks and returns a simulated
            approval. It does not submit a transaction.
          </>
        )}
      </Callout>
      <Card title="Connect">
        {connection ? (
          <>
            <p>
              Connected as <code>{connection.account}</code>
              {isDemoKeychain() ? ' (simulated)' : ''}. Session key{' '}
              <code>{connection.session.publicKey.slice(0, 18)}…</code>, maxCalls {connection.session.maxCalls}.
            </p>
            <div className="actions">
              <Button onClick={() => void checkAlive()}>Check session on chain</Button>
              <Button onClick={disconnect}>Disconnect</Button>
              <Button variant="primary" onClick={connect}>
                Connect again
              </Button>
            </div>
            {alive !== null ? (
              <Output tone={alive ? 'ok' : 'bad'}>
                {alive
                  ? 'The session exists on the account.'
                  : 'The session is not live on the account (expired, revoked, or — in demo mode — never registered).'}
              </Output>
            ) : null}
          </>
        ) : (
          <div className="actions">
            <Button variant="primary" onClick={connect}>
              Connect with Kamui
            </Button>
          </div>
        )}
        {log ? <Output>{log}</Output> : null}
      </Card>
    </Section>
  );
}
