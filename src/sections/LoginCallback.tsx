import { useEffect, useState } from 'react';
import { fetchPepper } from '@kamui/sdk';
import { Button, Callout, Output, Seal } from '../components/ui';
import { API_URL, GOOGLE_CLIENT_ID, LIVE_PEPPER, PEPPER_URL, loginRedirectUri } from '../lib/config';
import {
  clearLoginSession,
  loadLoginSession,
  loadVerifiedLogin,
  processLoginRedirect,
  saveVerifiedLogin,
  type VerifiedLogin,
} from '../lib/loginSession';

function homeHref(): string {
  return `${import.meta.env.BASE_URL}#social-login`;
}

export function LoginCallback() {
  const [phase, setPhase] = useState<'working' | 'ok' | 'empty' | 'error'>('working');
  const [result, setResult] = useState<VerifiedLogin | null>(null);
  const [error, setError] = useState('');
  const [pepperLog, setPepperLog] = useState('');

  useEffect(() => {
    const fragment = window.location.hash;
    // Drop the id_token from the address bar immediately; keep a copy in `fragment`.
    history.replaceState(null, '', window.location.pathname + window.location.search);

    const existing = loadVerifiedLogin();
    const session = loadLoginSession();

    if (!fragment || fragment === '#') {
      if (existing) {
        setResult(existing);
        setPhase('ok');
        return;
      }
      setPhase('empty');
      return;
    }

    if (!session) {
      setError(
        'No login attempt was found in this tab’s sessionStorage. Start again from Social login in the same tab (the device key cannot be recovered from another tab or after the tab is closed).',
      );
      setPhase('error');
      return;
    }

    try {
      const verified = processLoginRedirect(fragment, session);
      if (!verified) {
        setPhase('empty');
        return;
      }
      saveVerifiedLogin(verified);
      setResult(verified);
      setPhase('ok');
      if (LIVE_PEPPER) {
        const idToken = new URLSearchParams(fragment.replace(/^#/, '')).get('id_token');
        if (idToken) {
          void requestPepper(idToken, session);
        }
      } else {
        setPepperLog('Pepper service URL is empty; the fetch was skipped.');
      }
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  }, []);

  async function requestPepper(idToken: string, session: NonNullable<ReturnType<typeof loadLoginSession>>) {
    try {
      setPepperLog(`Asking ${PEPPER_URL}/v1/pepper with a real key proof…`);
      const pepper = await fetchPepper({
        serviceUrl: PEPPER_URL,
        idToken,
        attempt: session.attempt,
        device: session.device,
      });
      setPepperLog(
        `Pepper received (key version ${pepper.keyVersion}). completeLogin is still blocked: no recover API is reachable at ${API_URL || '(unset — api-sepolia.kamui.page did not complete a TLS handshake)'}.`,
      );
    } catch (err) {
      const message = (err as Error).message;
      setPepperLog(
        [
          'Pepper fetch did not succeed (this is the real service response, not a simulated error):',
          '  ' + message,
          '',
          `The pepper service is deployed at ${PEPPER_URL} (GET /health returns ok) but it allowlists origins.`,
          'A POST from this demo currently returns ORIGIN_NOT_ALLOWED (and the browser may surface that as a CORS failure).',
          'To complete the pepper step, allow these origins on the pepper service:',
          '  https://starknet-innovation.github.io',
          '  http://localhost:5175',
          'No pepper is invented here. completeLogin is not called without one.',
        ].join('\n'),
      );
    }
  }

  function startOver() {
    clearLoginSession();
    window.location.assign(homeHref());
  }

  return (
    <div className="kc">
      <div className="kc-seal">
        <Seal size={44} />
      </div>
      <p className="eyebrow">Kamui demo · Google callback</p>
      <h1>Sign-in result</h1>
      <p className="sub" style={{ marginBottom: 16 }}>
        Redirect URI used: <code>{loginRedirectUri()}</code>
      </p>

      {phase === 'working' ? <Output>Verifying the Google redirect with the Kamui SDK…</Output> : null}

      {phase === 'empty' ? (
        <Callout tone="info">
          There is no Google login answer in this URL. Open{' '}
          <a href={homeHref()}>Social login</a> and use <strong>Sign in with Google</strong>.
        </Callout>
      ) : null}

      {phase === 'error' ? (
        <Callout tone="bad">
          <strong>The redirect could not be verified.</strong>
          <div style={{ marginTop: 8 }}>{error}</div>
        </Callout>
      ) : null}

      {phase === 'ok' && result ? (
        <>
          <Callout tone="ok">
            <strong>Google identity verified by the Kamui SDK.</strong> <code>parseLoginRedirect</code> checked
            the CSRF state and that the token’s nonce matches the attempt started in this tab.{' '}
            <code>keyProof</code> was produced from the persisted device key. The JWT signature is not checked
            on the client — that is deliberate; the pepper service, the backend and the contract each verify it.
          </Callout>
          <Output tone="ok">
            {[
              'iss:                 ' + result.claims.iss,
              'aud:                 ' + result.claims.aud,
              'aud matches client:  ' + String(result.audMatchesClient) + ' (' + GOOGLE_CLIENT_ID + ')',
              'sub:                 ' + result.claims.sub,
              'email:               ' +
                (result.email ??
                  '(not in this token — the SDK’s authUrl requests scope=openid only, not email)'),
              'token nonce:         ' + result.claims.nonce,
              'nonce bound:         ' + String(result.nonceBound),
              'exp:                 ' + new Date(result.claims.exp * 1000).toISOString(),
              '',
              'key proof public key: ' + result.keyProof.public_key,
              'key proof blinding:   ' + result.keyProof.blinding,
              'key proof sig r:      ' + result.keyProof.signature[0],
              'key proof sig s:      ' + result.keyProof.signature[1],
              'keyProof() succeeds:  yes (this device signed poseidon(kamui.pepper.v1, nonce))',
              '',
              'Illustration only — identity and address with pepper 0 (NO_PEPPER).',
              'A real pepper is never 0, so these are NOT the account completeLogin would use.',
              'Anyone who knows your sub can compute the same values; they are shown because',
              'the derivation is possible without a pepper, and are clearly labelled.',
              'identity (pepper 0): ' + result.identityPepperZero,
              'address  (pepper 0): ' + result.addressPepperZero,
            ].join('\n')}
          </Output>
          {pepperLog ? <Output>{pepperLog}</Output> : null}
          {!API_URL ? (
            <Callout tone="info">
              <strong>Next steps, still blocked:</strong> a real pepper from the allowlisted service, then a
              recover API so <code>completeLogin</code> can deploy the account and add this device as an owner.
              <code>api-sepolia.kamui.page</code> did not complete a TLS handshake from the environment that
              built this demo; <code>VITE_API_URL</code> is unset. Nothing past this point is faked.
            </Callout>
          ) : null}
        </>
      ) : null}

      <div className="actions" style={{ marginTop: 16 }}>
        <Button variant="primary" onClick={() => window.location.assign(homeHref())}>
          Back to Social login
        </Button>
        <Button onClick={startOver}>Clear this tab’s login and start again</Button>
      </div>
    </div>
  );
}
