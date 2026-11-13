// Login: from a Google or Apple sign-in to a device key that owns the account.
//
// The steps, in order:
//   1. beginLogin        pick a blinding value; the token's nonce binds the device key to it
//   2. authUrl           send the user to the issuer with that nonce
//   3. parseLoginRedirect read the id_token that comes back and check state and nonce
//   4. fetchPepper       ask the pepper service (with a key proof), or use a recovery file
//   5. completeLogin     find the account; if this device is not an owner yet, use the supplied
//                        recovery adapter (browser proving with browserRecoverBackend)
//
// The flow follows keep-starknet-strange/social-account's client (MIT), changed for Kamui: an
// owner set instead of one key, a pepper, and no proof at all when the device already owns
// the account. Storing the attempt across the redirect and doing the redirect itself are left
// to the caller (the keychain).
import { hash, shortString, type ProviderInterface } from 'starknet';
import { accountAddressFromLogin, type LoginClaims } from './address';
import { signNewOwner } from './owners';
import { pepperFileMatchesLogin, type PepperFile } from './pepper';
import { KamuiReader } from './reader';
import { randomFelt, sameFelt, signHash, toHex, type KeyPair } from './utils';

export type LoginProvider = 'google' | 'apple';

const AUTH_URLS: Record<LoginProvider, string> = {
  google: 'https://accounts.google.com/o/oauth2/v2/auth',
  apple: 'https://appleid.apple.com/auth/authorize',
};

/** What must survive the redirect to the issuer and back. Holds no secret key. */
export type LoginAttempt = {
  provider: LoginProvider;
  /** Random value hidden in the nonce; needed again for the pepper and the proof. */
  blinding: string;
  /** `poseidon(device_public_key, blinding)`, lowercase hex. Sent to the issuer as the nonce. */
  nonce: string;
  /** Random value echoed by the issuer, against login CSRF. */
  state: string;
};

/** The nonce the account contract and the pepper service expect in the token. */
export function loginNonce(devicePublicKey: string, blinding: string): string {
  return toHex(hash.computePoseidonHashOnElements([devicePublicKey, blinding]));
}

export function beginLogin(provider: LoginProvider, devicePublicKey: string): LoginAttempt {
  const blinding = randomFelt();
  return { provider, blinding, nonce: loginNonce(devicePublicKey, blinding), state: randomFelt() };
}

/** Where to send the user. The id_token comes back in the URL fragment of `redirectUri`. */
export function authUrl(attempt: LoginAttempt, clientId: string, redirectUri: string): string {
  const url = new URL(AUTH_URLS[attempt.provider]);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    nonce: attempt.nonce,
    state: attempt.state,
    ...(attempt.provider === 'google'
      ? { response_type: 'id_token', scope: 'openid', prompt: 'select_account' }
      // Apple refuses a bare id_token, and any scope forces form_post. Without a scope the token
      // lands in the fragment like Google's. The code that comes with it is ignored.
      : { response_type: 'code id_token', response_mode: 'fragment' }),
  }).toString();
  return url.toString();
}

export type IdTokenClaims = LoginClaims & { nonce: string; exp: number; iat: number };

/**
 * Reads an id_token's claims WITHOUT checking its signature. That is deliberate: the pepper
 * service, the backend and the account contract each verify the token. Nothing here may be
 * trusted for a security decision on the client's side.
 */
export function decodeIdToken(idToken: string): IdTokenClaims {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('login: the id_token is not a JWT');
  let payload: any;
  try {
    const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('login: the id_token payload cannot be read');
  }
  for (const field of ['iss', 'aud', 'sub', 'nonce'] as const) {
    if (typeof payload[field] !== 'string' || payload[field] === '') throw new Error(`login: the id_token has no ${field}`);
  }
  for (const field of ['exp', 'iat'] as const) {
    if (typeof payload[field] !== 'number') throw new Error(`login: the id_token has no ${field}`);
  }
  return { iss: payload.iss, aud: payload.aud, sub: payload.sub, nonce: payload.nonce, exp: payload.exp, iat: payload.iat };
}

/**
 * Reads the issuer's answer from the redirect URL fragment (`#id_token=...&state=...`).
 * Returns null when the fragment is not a login answer. Throws on an issuer error, a state
 * that does not match the attempt, or a token issued for another nonce.
 */
export function parseLoginRedirect(
  fragment: string,
  attempt: LoginAttempt,
): { idToken: string; claims: IdTokenClaims } | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  if (!params.has('id_token') && !params.has('error')) return null;
  if (params.has('error')) throw new Error(`login: ${attempt.provider} answered ${params.get('error')}`);
  if (params.get('state') !== attempt.state) throw new Error('login: state mismatch');
  const idToken = params.get('id_token')!;
  const claims = decodeIdToken(idToken);
  if (claims.nonce !== attempt.nonce) throw new Error('login: the token was issued for another nonce');
  return { idToken, claims };
}

/** 'kamui.pepper.v1' as a short string: separates this signature from any other use of the key. */
const KEY_PROOF_DOMAIN = shortString.encodeShortString('kamui.pepper.v1');

export type KeyProof = { public_key: string; blinding: string; signature: [string, string] };

/**
 * Proof for the pepper service that the caller holds the device key the token was issued for:
 * the key and blinding behind the nonce, and the key's signature over
 * `poseidon('kamui.pepper.v1', nonce)`. A token captured on its own cannot produce it.
 */
export function keyProof(attempt: LoginAttempt, device: KeyPair): KeyProof {
  if (!sameFelt(loginNonce(device.publicKey, attempt.blinding), attempt.nonce)) {
    throw new Error('login: this device key is not the one the attempt was started with');
  }
  const message = hash.computePoseidonHashOnElements([KEY_PROOF_DOMAIN, attempt.nonce]);
  return { public_key: device.publicKey, blinding: attempt.blinding, signature: signHash(message, device.privateKey) };
}

export type Pepper = { pepper: string; keyVersion: number };

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<Response>;

/** Asks the pepper service for this user's pepper. Never falls back to pepper 0. */
export async function fetchPepper(args: {
  serviceUrl: string;
  idToken: string;
  attempt: LoginAttempt;
  device: KeyPair;
  fetch?: Fetch;
}): Promise<Pepper> {
  const send = args.fetch ?? ((url, init) => fetch(url, init));
  const response = await send(`${args.serviceUrl.replace(/\/$/, '')}/v1/pepper`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jwt: args.idToken, ...keyProof(args.attempt, args.device) }),
  });
  const body = (await response.json().catch(() => ({}))) as { pepper?: unknown; key_version?: unknown; error?: unknown };
  if (!response.ok) throw new Error(`pepper service: ${typeof body.error === 'string' ? body.error : response.status}`);
  if (typeof body.pepper !== 'string' || !/^0x[0-9a-f]{1,64}$/.test(body.pepper) || BigInt(body.pepper) === 0n) {
    throw new Error('pepper service: no usable pepper in the answer');
  }
  if (typeof body.key_version !== 'number') throw new Error('pepper service: no key version in the answer');
  return { pepper: body.pepper, keyVersion: body.key_version };
}

/**
 * Takes the pepper from a recovery file, after checking the file belongs to this login. Pass
 * `classHash` (the account class in use) to also refuse a file made for another class: such a
 * file is consistent with itself, so only the caller can tell.
 */
export function pepperFromFile(file: PepperFile, claims: LoginClaims, chainId: string, classHash?: string): Pepper {
  if (!pepperFileMatchesLogin(file, claims, chainId) || (classHash !== undefined && !sameFelt(file.classHash, classHash))) {
    throw new Error('login: this recovery file is for another user, application, class or network');
  }
  return { pepper: file.pepper, keyVersion: file.keyVersion };
}

/** Private login input passed locally to the recovery adapter, not necessarily to an API. */
export type RecoverRequest = {
  jwt: string;
  account: string;
  newPubkey: string;
  /** The new key's signature accepting ownership, bound to the account's owners anchor. */
  signature: [string, string];
  /** Local signature anchor, checked again before browser proving; omitted by older callers. */
  ownersAnchor?: string;
  blinding: string;
  pepper: string;
  /**
   * The key proof signature, so the backend can confirm the pepper with the pepper service
   * before it pays for a deployment or a proof.
   */
  keyProof: [string, string];
  override: false;
};

export interface RecoverBackend {
  /** Deploys if needed, generates a proof and submits recovery using the chosen adapter. */
  recover(request: RecoverRequest): Promise<{ transaction_hash: string }>;
}

export type RecoveryPollingOptions = {
  pollIntervalMs?: number;
  timeoutMs?: number;
  requestTimeoutMs?: number;
};

/** Submit once, then poll. Lost submissions are retried with the same random job capability. */
export function httpRecoverBackend<T = RecoverRequest>(
  apiUrl: string,
  send: Fetch = (url, init) => fetch(url, init),
  options: RecoveryPollingOptions = {},
  submissionPath: '/recover' | '/relay' | '/deploy/authenticated' = '/recover',
): { recover(request: T): Promise<{ transaction_hash: string }> } {
  const base = apiUrl.replace(/\/$/, '');
  const interval = options.pollIntervalMs ?? 2000;
  const timeout = options.timeoutMs ?? 20 * 60_000;
  const requestTimeout = options.requestTimeoutMs ?? 15_000;
  if (interval < 0 || timeout <= 0 || requestTimeout <= 0 || ![interval, timeout, requestTimeout].every(Number.isFinite)) {
    throw new Error('recover API: invalid polling options');
  }
  return {
    async recover(request) {
      const jobId = randomFelt();
      const deadline = Date.now() + timeout;
      const remaining = () => {
        const ms = deadline - Date.now();
        if (ms <= 0) throw new Error('recover API: polling timed out; recovery may still complete');
        return ms;
      };
      const pause = async (ms = interval) => {
        await new Promise((resolve) => setTimeout(resolve, Math.min(ms, remaining())));
      };
      const post = async (path: string, body: unknown) => {
        const controller = new AbortController();
        const ms = Math.max(1, Math.min(requestTimeout, remaining()));
        let timer: ReturnType<typeof setTimeout>;
        const timedOut = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('recover API: request timed out'));
          }, ms);
        });
        try {
          // Bound reading the body too, even if an injected transport ignores the signal.
          return await Promise.race([timedOut, (async () => {
            const response = await send(`${base}${path}`, {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body), signal: controller.signal,
            });
            return { response, answer: await response.json() };
          })()]);
        } finally {
          clearTimeout(timer!);
        }
      };
      const retryable = (status: number) => [429, 502, 503, 504].includes(status);
      const fail = (answer: any, status: number): never => {
        const code = typeof answer?.error === 'string' ? answer.error : String(status);
        const advice: Record<string, string> = {
          RECOVERY_INTERRUPTED: '; recovery was interrupted. Start a fresh sign-in to continue',
          RECOVERY_SUPERSEDED: '; the recovery transaction was replaced. Start a fresh sign-in to continue',
          RECOVERY_REVERTED: '; the recovery transaction reverted. Start a fresh sign-in to continue',
          RECOVERY_JOB_NOT_FOUND: '; recovery may still have completed. Check account ownership before signing in again',
        };
        throw new Error(`recover API: ${code}${advice[code] ?? ''}`);
      };
      for (let attempt = 0; ; attempt++) {
        let reply;
        try { reply = await post(submissionPath, { ...request, jobId }); }
        catch {
          if (attempt >= 2) throw new Error('recover API: submission unavailable; recovery may still complete');
          await pause(); continue;
        }
        const { response, answer } = reply;
        if (response.status === 202 && answer?.jobId === jobId) break;
        if (!retryable(response.status) || attempt >= 2) fail(answer, response.status);
        await pause(response.status === 429 ? 60_000 : interval);
      }
      for (;;) {
        let reply;
        try { reply = await post('/recover/status', { jobId }); }
        catch { await pause(); continue; }
        const { response, answer } = reply;
        if (!response.ok) {
          if (!retryable(response.status)) fail(answer, response.status);
          await pause(response.status === 429 ? 60_000 : interval); continue;
        }
        if (answer?.status === 'failed') fail(answer, answer.httpStatus);
        if (answer?.status === 'succeeded' && typeof answer.result?.transaction_hash === 'string') {
          return { transaction_hash: answer.result.transaction_hash };
        }
        if (answer?.status !== 'running') throw new Error('recover API: malformed job status');
        await pause();
      }
    },
  };
}

export type LoginResult = {
  account: string;
  /**
   * 'already-owner': this device's key was already an owner; nothing was sent.
   * 'added': the key was added by a recovery. Every session on the account was revoked.
   */
  status: 'already-owner' | 'added';
  /** Whether the account existed before this login. */
  existed: boolean;
  transactionHash?: string;
  pepper: string;
  keyVersion: number;
};

/**
 * Step 5: makes this device an owner of the user's account, if it is not one already.
 *
 * A returning device costs two reads and no proof. A new device (or a first login) costs a
 * proof: the recovery adapter deploys if needed, proves the token and submits `recover`,
 * which adds the device key. If the account already has the maximum number of owners, the
 * oldest key is replaced.
 */
export async function completeLogin(args: {
  provider: ProviderInterface;
  backend: RecoverBackend;
  chainId: string;
  classHash: string;
  idToken: string;
  attempt: LoginAttempt;
  device: KeyPair;
  pepper: Pepper;
}): Promise<LoginResult> {
  const claims = decodeIdToken(args.idToken);
  if (claims.nonce !== args.attempt.nonce) throw new Error('login: the token was issued for another nonce');
  if (!sameFelt(loginNonce(args.device.publicKey, args.attempt.blinding), args.attempt.nonce)) {
    throw new Error('login: this device key is not the one the attempt was started with');
  }
  if (BigInt(args.pepper.pepper) === 0n && args.chainId === shortString.encodeShortString('SN_MAIN')) {
    throw new Error('login: pepper 0 is not allowed on mainnet');
  }

  const account = accountAddressFromLogin(args.classHash, claims, args.pepper.pepper);
  const reader = new KamuiReader(args.provider, account);
  const result = { account, pepper: args.pepper.pepper, keyVersion: args.pepper.keyVersion };

  const existed = await reader.isDeployed();
  if (existed && (await reader.isOwner(args.device.publicKey))) {
    return { ...result, status: 'already-owner', existed };
  }

  // A fresh account has no owners and anchor 0. The signature is bound to the anchor, so it is
  // useless once the owners change; if they change before `recover` lands, the proof is refused
  // and the login has to be retried.
  const anchor = existed ? await reader.ownersAnchor() : '0x0';
  const { transaction_hash } = await args.backend.recover({
    jwt: args.idToken,
    account,
    newPubkey: args.device.publicKey,
    signature: signNewOwner(account, anchor, args.device.privateKey),
    ownersAnchor: anchor,
    blinding: args.attempt.blinding,
    pepper: args.pepper.pepper,
    keyProof: keyProof(args.attempt, args.device).signature,
    override: false,
  });
  await args.provider.waitForTransaction(transaction_hash);
  if (!(await reader.isOwner(args.device.publicKey))) {
    throw new Error('login: the recovery was sent but this device is not an owner of the account');
  }
  return { ...result, status: 'added', existed, transactionHash: transaction_hash };
}
