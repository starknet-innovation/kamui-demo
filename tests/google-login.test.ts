import { describe, expect, it, beforeEach } from 'vitest';
import { authUrl, beginLogin, loginNonce, newKeyPair, parseLoginRedirect } from '@kamui/sdk';
import {
  DEFAULT_GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_ID,
  DEFAULT_PEPPER_URL,
  isLoginCallbackPath,
  loginRedirectUri,
} from '../src/lib/config';
import {
  clearLoginSession,
  clearVerifiedLogin,
  loadLoginSession,
  optionalEmailFromToken,
  processLoginRedirect,
  saveLoginSession,
} from '../src/lib/loginSession';

const LOCAL_REDIRECT = 'http://localhost:5175/callback';
const PAGES_REDIRECT = 'https://starknet-innovation.github.io/kamui-demo/callback';

function encodeJwt(claims: Record<string, unknown>): string {
  const enc = (obj: unknown) => {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${enc({ alg: 'none', typ: 'JWT' })}.${enc(claims)}.sig`;
}

describe('baked-in Google client ID and redirect URIs', () => {
  it('defaults VITE_GOOGLE_CLIENT_ID to the public Web client and allows an env override shape', () => {
    expect(DEFAULT_GOOGLE_CLIENT_ID).toBe(
      '612906135098-gclndmmib7jnn6hhj5p55akei3kjtbdv.apps.googleusercontent.com',
    );
    expect(GOOGLE_CLIENT_ID).toBe(DEFAULT_GOOGLE_CLIENT_ID);
    expect(DEFAULT_PEPPER_URL).toBe('https://pepper-sepolia.kamui.page');
  });

  it('builds the exact localhost and Pages redirect URIs registered in the Google console', () => {
    expect(loginRedirectUri('http://localhost:5175', '/')).toBe(LOCAL_REDIRECT);
    expect(loginRedirectUri('http://localhost:5175', '')).toBe(LOCAL_REDIRECT);
    expect(loginRedirectUri('https://starknet-innovation.github.io', '/kamui-demo/')).toBe(PAGES_REDIRECT);
    expect(loginRedirectUri('https://starknet-innovation.github.io', '/kamui-demo')).toBe(PAGES_REDIRECT);
  });

  it('recognises /callback under the Pages base path so the 404.html SPA fallback can route', () => {
    expect(isLoginCallbackPath('/callback')).toBe(true);
    expect(isLoginCallbackPath('/callback/')).toBe(true);
    expect(isLoginCallbackPath('/kamui-demo/callback')).toBe(true);
    expect(isLoginCallbackPath('/kamui-demo/callback/')).toBe(true);
    expect(isLoginCallbackPath('/kamui-demo')).toBe(false);
    expect(isLoginCallbackPath('/kamui-demo/callback-extra')).toBe(false);
    expect(isLoginCallbackPath('/keychain/connect')).toBe(false);
  });
});

describe('authUrl for the localhost Google flow', () => {
  it('sets client_id, redirect_uri (exact), response_type, nonce and state', () => {
    const device = newKeyPair();
    const attempt = beginLogin('google', device.publicKey);
    const href = authUrl(attempt, GOOGLE_CLIENT_ID, loginRedirectUri('http://localhost:5175', '/'));
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe(
      '612906135098-gclndmmib7jnn6hhj5p55akei3kjtbdv.apps.googleusercontent.com',
    );
    expect(url.searchParams.get('redirect_uri')).toBe(LOCAL_REDIRECT);
    expect(url.searchParams.get('response_type')).toBe('id_token');
    expect(url.searchParams.get('scope')).toBe('openid');
    expect(url.searchParams.get('nonce')).toBe(attempt.nonce);
    expect(url.searchParams.get('nonce')).toBe(loginNonce(device.publicKey, attempt.blinding));
    expect(url.searchParams.get('state')).toBe(attempt.state);
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });

  it('sets the public Pages redirect_uri exactly', () => {
    const attempt = beginLogin('google', newKeyPair().publicKey);
    const href = authUrl(attempt, GOOGLE_CLIENT_ID, loginRedirectUri('https://starknet-innovation.github.io', '/kamui-demo/'));
    expect(new URL(href).searchParams.get('redirect_uri')).toBe(PAGES_REDIRECT);
  });
});

describe('sessionStorage across the redirect', () => {
  beforeEach(() => {
    clearLoginSession();
    clearVerifiedLogin();
  });

  it('round-trips the device key and attempt', () => {
    const device = newKeyPair();
    const attempt = beginLogin('google', device.publicKey);
    saveLoginSession(device, attempt);
    const loaded = loadLoginSession();
    expect(loaded).not.toBeNull();
    expect(loaded!.device).toEqual(device);
    expect(loaded!.attempt).toEqual(attempt);
  });

  it('returns null when nothing is stored or the payload is malformed', () => {
    expect(loadLoginSession()).toBeNull();
    sessionStorage.setItem('kamui-demo.login.attempt', '{not json');
    expect(loadLoginSession()).toBeNull();
  });
});

describe('processLoginRedirect', () => {
  beforeEach(() => {
    clearLoginSession();
    clearVerifiedLogin();
  });

  function sessionAndToken(extra: Record<string, unknown> = {}) {
    const device = newKeyPair();
    const attempt = beginLogin('google', device.publicKey);
    saveLoginSession(device, attempt);
    const claims = {
      iss: 'https://accounts.google.com',
      aud: GOOGLE_CLIENT_ID,
      sub: 'google-sub-123',
      nonce: attempt.nonce,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      ...extra,
    };
    const idToken = encodeJwt(claims);
    const fragment = `#id_token=${idToken}&state=${attempt.state}`;
    return { device, attempt, claims, idToken, fragment, session: loadLoginSession()! };
  }

  it('verifies state and nonce, builds a key proof, and surfaces email when present', () => {
    const { fragment, session, claims } = sessionAndToken({ email: 'user@example.com' });
    const verified = processLoginRedirect(fragment, session);
    expect(verified).not.toBeNull();
    expect(verified!.claims.sub).toBe('google-sub-123');
    expect(verified!.claims.nonce).toBe(claims.nonce);
    expect(verified!.email).toBe('user@example.com');
    expect(verified!.audMatchesClient).toBe(true);
    expect(verified!.nonceBound).toBe(true);
    expect(verified!.keyProof.public_key).toBe(session.device.publicKey);
    expect(verified!.identityPepperZero.startsWith('0x')).toBe(true);
    expect(verified!.addressPepperZero.startsWith('0x')).toBe(true);
    expect(optionalEmailFromToken(encodeJwt({ email: 'user@example.com' }))).toBe('user@example.com');
  });

  it('returns null when the fragment is not a login answer', () => {
    const { session } = sessionAndToken();
    expect(processLoginRedirect('', session)).toBeNull();
    expect(processLoginRedirect('#foo=bar', session)).toBeNull();
  });

  it('throws on a state mismatch, a nonce mismatch, or an issuer error', () => {
    const { session, idToken, attempt } = sessionAndToken();
    expect(() => processLoginRedirect(`#id_token=${idToken}&state=0xdead`, session)).toThrow(/state mismatch/);
    const wrongNonce = encodeJwt({
      iss: 'https://accounts.google.com',
      aud: GOOGLE_CLIENT_ID,
      sub: 'google-sub-123',
      nonce: '0x1',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });
    expect(() =>
      processLoginRedirect(`#id_token=${wrongNonce}&state=${attempt.state}`, session),
    ).toThrow(/another nonce/);
    expect(() => processLoginRedirect('#error=access_denied&state=' + attempt.state, session)).toThrow(
      /access_denied/,
    );
    // also the SDK helper itself
    expect(parseLoginRedirect('#foo=bar', attempt)).toBeNull();
  });
});
