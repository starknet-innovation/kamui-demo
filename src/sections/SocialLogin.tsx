import { useMemo, useState } from 'react';
import { authUrl, beginLogin, keyProof, loginNonce, newKeyPair } from '@kamui/sdk';
import { FEATURES } from '../lib/features';
import { GOOGLE_CLIENT_ID, LIVE_LOGIN } from '../lib/config';
import { Button, Callout, Card, Output, Section, Steps } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'social-login')!;

export function SocialLogin() {
  const [log, setLog] = useState('Press “Run the SDK steps” to create a device key, a login attempt and a pepper key proof. Nothing is sent to Google.');
  const [url, setUrl] = useState('');

  const steps = useMemo(
    () => [
      { title: 'beginLogin', body: 'The keychain creates a device key and an attempt: a blinding value, a nonce = poseidon(device public key, blinding), and a CSRF state. The attempt holds no secret key.' },
      { title: 'authUrl', body: 'The user is sent to Google (Apple is implemented but deferred for this rollout) with that nonce. The id_token comes back in the redirect fragment.' },
      { title: 'parseLoginRedirect', body: 'The SDK checks state and that the token’s nonce matches the attempt. It does not verify the JWT signature: the pepper service, the backend and the contract each do.' },
      { title: 'fetchPepper (or a recovery file)', body: 'The pepper service requires a key proof: the device key signs poseidon(‘kamui.pepper.v1’, nonce). A captured token alone cannot produce it. pepperFromFile can be used instead, after pepperFileMatchesLogin.' },
      { title: 'completeLogin', body: 'If this device already owns the account, two reads and no proof. Otherwise the browser proves the token and the backend deploys (first time) and submits recover. Adding a device revokes every session. A fifth new key replaces the oldest.' },
    ],
    [],
  );

  function run() {
    const device = newKeyPair();
    const attempt = beginLogin('google', device.publicKey);
    const proof = keyProof(attempt, device);
    const nonce = loginNonce(device.publicKey, attempt.blinding);
    const clientId = GOOGLE_CLIENT_ID || 'demo-client-id.apps.googleusercontent.com';
    const redirect = 'http://localhost:5175/callback';
    const href = authUrl(attempt, clientId, redirect);
    setUrl(href);
    setLog(
      [
        'device public key:  ' + device.publicKey,
        'blinding:           ' + attempt.blinding,
        'nonce:              ' + attempt.nonce,
        'nonce recomputed:   ' + nonce,
        'nonce matches:      ' + String(nonce === attempt.nonce),
        'state:              ' + attempt.state,
        'key proof pubkey:   ' + proof.public_key,
        'key proof sig r:    ' + proof.signature[0],
        'key proof sig s:    ' + proof.signature[1],
        '',
        'authUrl (Google):',
        href,
        '',
        LIVE_LOGIN
          ? 'Live login is configured. A real sign-in would now redirect to Google and finish through the pepper service and recover API.'
          : 'Live login is not configured. The URL above is a real Google OAuth URL with a placeholder client id — opening it will be refused by Google. Set VITE_GOOGLE_CLIENT_ID, VITE_PEPPER_URL and VITE_API_URL to enable a live run.',
      ].join('\n'),
    );
  }

  return (
    <Section feature={feature}>
      <Steps items={steps} />
      <Callout tone="info">
        <strong>A login on a new device revokes every session</strong> on the account. The keychain warns the
        user before that. Apple sign-in is retained in the SDK but hidden in the current Google-only rollout.
      </Callout>
      <Card title="SDK playground: a login attempt and its key proof">
        <p>
          This uses the real <code>beginLogin</code>, <code>loginNonce</code>, <code>keyProof</code> and{' '}
          <code>authUrl</code> helpers. It does not contact Google or the pepper service.
        </p>
        <div className="actions">
          <Button variant="primary" onClick={run}>
            Run the SDK steps
          </Button>
        </div>
        <Output>{log}</Output>
        {url ? (
          <p style={{ marginTop: 10, fontSize: 13, color: 'var(--mute)' }}>
            Issuer host: <code>{new URL(url).host}</code>
            {LIVE_LOGIN ? (
              <>
                {' '}
                — <a href={url}>open Google sign-in</a> (will leave this page)
              </>
            ) : null}
          </p>
        ) : null}
      </Card>
    </Section>
  );
}
