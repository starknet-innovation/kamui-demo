import { useState } from 'react';
import { FEATURES } from '../lib/features';
import { DEFAULT_KEYCHAIN_URL, LIVE_KEYCHAIN, isDemoKeychain } from '../lib/config';
import { Button, Callout, Card, Output, Section, Steps } from '../components/ui';
import { checkConnectionAlive, useWallet } from '../components/WalletEntry';

const feature = FEATURES.find((f) => f.id === 'keychain')!;

export function KeychainConnect() {
  const { connection, message, start, disconnect, preferDemo } = useWallet();
  const [alive, setAlive] = useState<boolean | null>(null);
  const [log, setLog] = useState('');
  const demo = isDemoKeychain(preferDemo);

  async function checkAlive() {
    if (!connection) return;
    try {
      const ok = await checkConnectionAlive(connection);
      setAlive(ok);
      setLog('');
    } catch (error) {
      setAlive(false);
      setLog('Could not read the account: ' + (error as Error).message);
    }
  }

  return (
    <Section feature={feature}>
      <Steps
        items={[
          { title: 'beginConnect', body: 'The app creates a session key, stores it, and sends the user to /connect with the request in the URL fragment.' },
          { title: 'The keychain', body: 'Signs the user in if needed (Google, pepper, recovery), checks who is asking (referrer origin must match the redirect origin), runs sessionProblems, and on approval has the account register the session.' },
          { title: 'finishConnect', body: 'The user comes back with the account address. From then on the app signs calls itself. The session private key never left the app; the device key never left the keychain.' },
        ]}
      />
      <Callout tone={demo ? 'info' : 'ok'}>
        {demo ? (
          <>
            The in-app demo keychain is selected. Connect stays on this origin, runs the real{' '}
            <code>parseConnectRequest</code> and <code>sessionProblems</code> checks, and returns a
            simulated approval. It does not submit a transaction. Turn the toggle off in the header to
            use the hosted keychain at <code>{DEFAULT_KEYCHAIN_URL}</code>.
          </>
        ) : (
          <>
            Connect uses the hosted keychain at <code>{DEFAULT_KEYCHAIN_URL}</code>
            {LIVE_KEYCHAIN ? '' : ' (override empty — unexpected)'}. The same button lives in the page header.
          </>
        )}
      </Callout>
      <Card title="Connect">
        {connection ? (
          <>
            <p>
              Connected as <code>{connection.account}</code>
              {demo ? ' (simulated)' : ''}. Session key{' '}
              <code>{connection.session.publicKey.slice(0, 18)}…</code>, maxCalls {connection.session.maxCalls}.
            </p>
            <div className="actions">
              <Button onClick={() => void checkAlive()}>Check session on chain</Button>
              <Button onClick={disconnect}>Disconnect</Button>
              <Button variant="primary" onClick={start}>
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
            <Button variant="primary" onClick={start}>
              Connect with Kamui (Google)
            </Button>
          </div>
        )}
        {message || log ? <Output>{[message, log].filter(Boolean).join('\n')}</Output> : null}
      </Card>
    </Section>
  );
}
