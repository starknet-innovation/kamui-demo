import { useMemo, useState } from 'react';
import { authUrl, beginLogin, newKeyPair } from '@kamui/sdk';
import { FEATURES } from '../lib/features';
import { GOOGLE_CLIENT_ID, LIVE_PEPPER, PEPPER_URL, loginRedirectUri } from '../lib/config';
import { clearVerifiedLogin, loadVerifiedLogin, saveLoginSession } from '../lib/loginSession';
import { Button, Callout, Card, Output, Section, Steps } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'social-login')!;

export function SocialLogin() {
  const [error, setError] = useState('');
  const previous = useMemo(() => loadVerifiedLogin(), []);
  const redirectUri = loginRedirectUri();

  const steps = useMemo(
    () => [
      { title: 'beginLogin', body: 'This page creates a device key and an attempt: a blinding value, a nonce = poseidon(device public key, blinding), and a CSRF state. Both the key and the attempt are stored in this tab’s sessionStorage so they survive the Google redirect.' },
      { title: 'authUrl → Google', body: 'You are sent to Google with that nonce and state. The redirect_uri is this site’s /callback (including the Pages base path). The id_token comes back in the URL fragment.' },
      { title: 'parseLoginRedirect', body: 'The /callback route reads the fragment, checks state and that the token’s nonce matches the attempt, and builds a key proof from the persisted device key. The JWT signature is not checked here: the pepper service, the backend and the contract each do.' },
      { title: 'fetchPepper (or a recovery file)', body: 'The pepper service requires the key proof. It is deployed and healthy, but this demo’s origin is not yet allowlisted, so the call is attempted and the real refusal is shown. pepperFromFile remains available in the Pepper file section.' },
      { title: 'completeLogin', body: 'Needs a real pepper and a recover API (deploy + prove + recover). The recover API is not reachable, so this demo stops at a verified Google identity. Nothing past that is faked.' },
    ],
    [],
  );

  function startGoogleLogin() {
    setError('');
    try {
      const device = newKeyPair();
      const attempt = beginLogin('google', device.publicKey);
      saveLoginSession(device, attempt);
      const href = authUrl(attempt, GOOGLE_CLIENT_ID, redirectUri);
      window.location.assign(href);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Section feature={feature}>
      <Steps items={steps} />
      <Callout tone="warn">
        <strong>A login on a new device revokes every session</strong> on the account. The keychain warns the
        user before that. Apple sign-in is retained in the SDK but hidden in the current Google-only rollout.
      </Callout>
      <Card title="Sign in with Google">
        <p>
          This is the real Kamui SDK flow: <code>beginLogin</code>, <code>authUrl</code>, a redirect to Google,
          then <code>parseLoginRedirect</code> and <code>keyProof</code> on{' '}
          <a href={`${import.meta.env.BASE_URL}callback`}>/callback</a>. The device private key never leaves
          this tab’s sessionStorage and is never shown.
        </p>
        <p>
          Client ID: <code>{GOOGLE_CLIENT_ID}</code>
        </p>
        <p>
          Redirect URI (must match the Google Cloud console exactly): <code>{redirectUri}</code>
        </p>
        {LIVE_PEPPER ? (
          <p>
            Pepper service: <code>{PEPPER_URL}</code> (live, origin-allowlisted — this origin is currently
            refused).
          </p>
        ) : null}
        <div className="actions">
          <Button variant="primary" onClick={startGoogleLogin}>
            Sign in with Google
          </Button>
        </div>
        {error ? <Output tone="bad">{error}</Output> : null}
        {previous ? (
          <>
            <Output tone="ok">
              {[
                'A verified Google identity is already in this tab (from /callback):',
                'sub:    ' + previous.claims.sub,
                'email:  ' + (previous.email ?? '(not in the token)'),
                'aud:    ' + previous.claims.aud,
                'iss:    ' + previous.claims.iss,
                'nonce:  ' + previous.claims.nonce,
                '',
                'Open /callback to see the full checks, or sign in again to replace it.',
              ].join('\n')}
            </Output>
            <div className="actions">
              <Button onClick={() => window.location.assign(`${import.meta.env.BASE_URL}callback`)}>
                Open /callback result
              </Button>
              <Button
                onClick={() => {
                  clearVerifiedLogin();
                  window.location.reload();
                }}
              >
                Clear saved result
              </Button>
            </div>
          </>
        ) : null}
      </Card>
    </Section>
  );
}
