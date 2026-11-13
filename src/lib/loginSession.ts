/** Persist a Kamui login attempt and device key across the Google redirect. */
import {
  accountAddressFromLogin,
  identity,
  keyProof,
  loginNonce,
  parseLoginRedirect,
  type IdTokenClaims,
  type KeyProof,
  type KeyPair,
  type LoginAttempt,
  NO_PEPPER,
} from '@kamui/sdk';
import { CLASS_HASH, GOOGLE_CLIENT_ID } from './config';

const ATTEMPT_KEY = 'kamui-demo.login.attempt';
const RESULT_KEY = 'kamui-demo.login.result';

export type StoredLogin = {
  device: KeyPair;
  attempt: LoginAttempt;
  startedAt: number;
};

/** Verified Google identity shown after the callback. Never includes the raw id_token or the private key. */
export type VerifiedLogin = {
  claims: IdTokenClaims;
  /** Present only if Google included it; the SDK's authUrl requests `openid` only, so this is often absent. */
  email?: string;
  audMatchesClient: boolean;
  nonceBound: boolean;
  keyProof: KeyProof;
  /** poseidon(iss, aud, sub, 0) — testnet-only illustration, not the account a real pepper would produce. */
  identityPepperZero: string;
  addressPepperZero: string;
  verifiedAt: number;
};

export function saveLoginSession(device: KeyPair, attempt: LoginAttempt, store: Storage = sessionStorage): void {
  const payload: StoredLogin = { device, attempt, startedAt: Date.now() };
  store.setItem(ATTEMPT_KEY, JSON.stringify(payload));
}

export function loadLoginSession(store: Storage = sessionStorage): StoredLogin | null {
  const raw = store.getItem(ATTEMPT_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as StoredLogin;
    if (
      typeof data?.device?.privateKey !== 'string' ||
      typeof data?.device?.publicKey !== 'string' ||
      typeof data?.attempt?.nonce !== 'string' ||
      typeof data?.attempt?.state !== 'string' ||
      typeof data?.attempt?.blinding !== 'string'
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearLoginSession(store: Storage = sessionStorage): void {
  store.removeItem(ATTEMPT_KEY);
}

export function saveVerifiedLogin(result: VerifiedLogin, store: Storage = sessionStorage): void {
  store.setItem(RESULT_KEY, JSON.stringify(result));
}

export function loadVerifiedLogin(store: Storage = sessionStorage): VerifiedLogin | null {
  const raw = store.getItem(RESULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VerifiedLogin;
  } catch {
    return null;
  }
}

export function clearVerifiedLogin(store: Storage = sessionStorage): void {
  store.removeItem(RESULT_KEY);
}

/** Optional `email` claim; not part of the SDK's decoded set and not required by Kamui. */
export function optionalEmailFromToken(idToken: string): string | undefined {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return undefined;
    const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)))) as {
      email?: unknown;
    };
    return typeof payload.email === 'string' && payload.email ? payload.email : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse the Google redirect fragment with the SDK, check nonce/state/aud, build a key proof,
 * and derive the pepper-0 identity (labelled as illustration only). Throws on issuer errors
 * or a failed check. Returns null when the fragment is not a login answer.
 */
export function processLoginRedirect(fragment: string, session: StoredLogin): VerifiedLogin | null {
  const parsed = parseLoginRedirect(fragment, session.attempt);
  if (!parsed) return null;
  const { claims } = parsed;
  const recomputed = loginNonce(session.device.publicKey, session.attempt.blinding);
  const nonceBound = claims.nonce === session.attempt.nonce && claims.nonce === recomputed;
  if (!nonceBound) throw new Error('login: nonce binding check failed');
  const proof = keyProof(session.attempt, session.device);
  const identityPepperZero = identity(claims, NO_PEPPER);
  const addressPepperZero = accountAddressFromLogin(CLASS_HASH, claims, NO_PEPPER);
  return {
    claims,
    email: optionalEmailFromToken(parsed.idToken),
    audMatchesClient: claims.aud === GOOGLE_CLIENT_ID,
    nonceBound,
    keyProof: proof,
    identityPepperZero,
    addressPepperZero,
    verifiedAt: Date.now(),
  };
}

export { ATTEMPT_KEY, RESULT_KEY };
