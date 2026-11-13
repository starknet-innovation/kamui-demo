// The session registry: a server-side list of the sessions an account has approved, so the
// keychain can show them and offer to revoke them. The account contract cannot enumerate its
// sessions, which is why the list has to be kept somewhere.
//
// The registry is a convenience, not an authority. What a session can do is decided by the
// chain. Whoever reads the list must treat every field as untrusted input: check that each
// session exists on the account, and show names and origins as text.
//
// Every request is authorised by an owner (device key) signature over
//   poseidon('kamui.registry.v2', chainId, account, action, timestamp, nonce, subject, content)
// which the server checks with the account's `is_valid_signature`. It accepts exactly two
// signature elements, so a session key (four elements) can never authorise a request.
//
// - `subject` is the session public key for `put` and `remove`, and 0 for `list`.
// - `content` is `registryContentHash(session)` for `put`, and 0 otherwise: the signature
//   covers everything the record says, so nobody can change a record on its way to the server.
// - `nonce` is a random felt. The server accepts each signed message once.
import { hash, shortString } from 'starknet';
import type { WireSession } from './keychain';
import { randomFelt, signHash, toHex, u256Calldata } from './utils';

export type RegistryAction = 'put' | 'list' | 'remove';

/** A session as the registry stores it: the wire session, and the site it was approved for. */
export type RegistrySession = WireSession & {
  /** Origin of the app the session was approved for. */
  origin: string;
  /** What the app called itself. A claim. */
  appName?: string;
};

/** A session as the registry lists it. `createdAt` is unix seconds. */
export type RegistryEntry = RegistrySession & { createdAt: number };

/** The server accepts a timestamp within this many seconds of its own clock. */
export const REGISTRY_MAX_CLOCK_SKEW = 300;
/** Bounds on what a listing may hold. Anything beyond them is dropped, not shown. */
export const REGISTRY_MAX_ENTRIES = 50;
export const REGISTRY_MAX_ORIGIN_LENGTH = 200;
export const REGISTRY_MAX_APP_NAME_LENGTH = 60;
/** The server keeps at most this many spending limits for one session. */
export const REGISTRY_MAX_LIMITS = 32;
const MAX_CALLS = 64;

const DOMAIN = shortString.encodeShortString('kamui.registry.v2');

const text = (value: string) => toHex(hash.starknetKeccak(value));

/**
 * A hash of everything a record says, for the `put` signature. Strings (the origin, the app
 * name) enter as their starknet keccak, an entry point as its selector, and a spending amount
 * as two 128-bit halves. Throws if a value does not fit a felt.
 */
export function registryContentHash(session: RegistrySession): string {
  return hash.computePoseidonHashOnElements([
    text(session.origin),
    session.appName ? text(session.appName) : '0x0',
    toHex(session.validUntil),
    toHex(session.maxCalls),
    session.maxFeePerTx,
    toHex(session.calls.length),
    ...session.calls.flatMap((call) => [call.to, hash.getSelectorFromName(call.entrypoint)]),
    toHex(session.limits.length),
    ...session.limits.flatMap((limit) => [limit.token, ...u256Calldata(limit.maxPerCall), ...u256Calldata(limit.maxPerWindow), toHex(limit.windowSeconds)]),
  ]);
}

export type RegistryRequest = {
  chainId: string;
  account: string;
  action: RegistryAction;
  /** Unix seconds. */
  timestamp: number;
  /** A random felt, new for every request. */
  nonce: string;
  /** The session public key, for `put` and `remove`. */
  subject?: string;
  /** The record, for `put`. */
  session?: RegistrySession;
};

/** The hash an owner key signs for a registry request. */
export function registryMessageHash(args: RegistryRequest): string {
  if (!Number.isInteger(args.timestamp) || args.timestamp <= 0) throw new Error('registry: bad timestamp');
  if (args.action !== 'list' && args.subject === undefined) throw new Error(`registry: '${args.action}' needs a session key`);
  if (args.action === 'put' && args.session === undefined) throw new Error("registry: 'put' needs the session");
  if (args.action === 'put' && BigInt(args.session!.publicKey) !== BigInt(args.subject!)) throw new Error('registry: the session is not the one named');
  return hash.computePoseidonHashOnElements([
    DOMAIN,
    args.chainId,
    args.account,
    shortString.encodeShortString(args.action),
    toHex(args.timestamp),
    args.nonce,
    args.action === 'list' ? '0x0' : args.subject!,
    args.action === 'put' ? registryContentHash(args.session!) : '0x0',
  ]);
}

/** An owner key's `[r, s]` signature for a registry request. */
export function signRegistryRequest(args: RegistryRequest & { ownerPrivateKey: string }): [string, string] {
  return signHash(registryMessageHash(args), args.ownerPrivateKey);
}

const isHex = (value: unknown): value is string => typeof value === 'string' && /^0x[0-9a-fA-F]{1,64}$/.test(value);
const isPositiveInt = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const isEntrypoint = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(value);

function parseEntry(data: any): RegistryEntry | null {
  if (typeof data !== 'object' || data === null) return null;
  if (!isHex(data.publicKey) || !isHex(data.maxFeePerTx)) return null;
  if (!isPositiveInt(data.validUntil) || !isPositiveInt(data.maxCalls)) return null;
  if (typeof data.createdAt !== 'number' || !Number.isSafeInteger(data.createdAt) || data.createdAt < 0) return null;
  if (typeof data.origin !== 'string' || data.origin.length === 0 || data.origin.length > REGISTRY_MAX_ORIGIN_LENGTH) return null;
  if (data.appName !== undefined && data.appName !== null && (typeof data.appName !== 'string' || data.appName.length > REGISTRY_MAX_APP_NAME_LENGTH)) return null;
  if (!Array.isArray(data.calls) || data.calls.length > MAX_CALLS) return null;
  if (!Array.isArray(data.limits) || data.limits.length > REGISTRY_MAX_LIMITS) return null;
  for (const call of data.calls) {
    if (!isHex(call?.to) || !isEntrypoint(call?.entrypoint)) return null;
  }
  for (const limit of data.limits) {
    if (!isHex(limit?.token) || !isHex(limit?.maxPerCall) || !isHex(limit?.maxPerWindow) || !isPositiveInt(limit?.windowSeconds)) return null;
  }
  return {
    publicKey: data.publicKey,
    origin: data.origin,
    ...(typeof data.appName === 'string' && data.appName !== '' ? { appName: data.appName } : {}),
    validUntil: data.validUntil,
    maxCalls: data.maxCalls,
    maxFeePerTx: data.maxFeePerTx,
    calls: data.calls.map((call: { to: string; entrypoint: string }) => ({ to: call.to, entrypoint: call.entrypoint })),
    limits: data.limits.map((limit: WireSession['limits'][number]) => ({
      token: limit.token,
      maxPerCall: limit.maxPerCall,
      maxPerWindow: limit.maxPerWindow,
      windowSeconds: limit.windowSeconds,
    })),
    createdAt: data.createdAt,
  };
}

/**
 * Reads a listing from the registry. The answer is untrusted: an entry that is not shaped as
 * the protocol says is dropped, a session key listed twice is kept once, and at most
 * `REGISTRY_MAX_ENTRIES` entries are kept. `origin` and `appName` are only bounded in length;
 * they are arbitrary text and must be shown as text. Throws if the answer is not a listing.
 */
export function parseRegistryList(body: unknown): RegistryEntry[] {
  const list = (body as any)?.sessions;
  if (!Array.isArray(list)) throw new Error('registry: the answer is not a list of sessions');
  const entries: RegistryEntry[] = [];
  const seen = new Set<bigint>();
  for (const item of list) {
    if (entries.length >= REGISTRY_MAX_ENTRIES) break;
    const entry = parseEntry(item);
    if (!entry || seen.has(BigInt(entry.publicKey))) continue;
    seen.add(BigInt(entry.publicKey));
    entries.push(entry);
  }
  return entries;
}

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>;

export type RegistryClient = {
  /**
   * Records a session. Call it once the session exists on chain. The server refuses a session
   * that has expired (`registry: SESSION_EXPIRED`) and an account that already has 50 live
   * records (`registry: REGISTRY_FULL`).
   */
  put(session: RegistrySession): Promise<void>;
  /** The account's recorded sessions, newest first. Untrusted: see `parseRegistryList`. */
  list(): Promise<RegistryEntry[]>;
  /** Removes a session's record. Succeeds when there was nothing to remove. */
  remove(sessionPublicKey: string): Promise<void>;
};

/**
 * A client for the registry at `{apiUrl}/registry/sessions`. Each call is signed by
 * `ownerPrivateKey`, which must be an owner key of `account`.
 */
export function registryClient(args: {
  apiUrl: string;
  chainId: string;
  account: string;
  ownerPrivateKey: string;
  fetch?: Fetch;
  /** Unix seconds. Defaults to this machine's clock. */
  now?: () => number;
  /** A random felt per request. Defaults to `randomFelt`. */
  nonce?: () => string;
}): RegistryClient {
  const send = args.fetch ?? ((url, init) => fetch(url, init));
  const now = args.now ?? (() => Math.floor(Date.now() / 1000));
  const newNonce = args.nonce ?? randomFelt;
  const base = `${args.apiUrl.replace(/\/$/, '')}/registry/sessions`;

  async function post(path: string, action: RegistryAction, subject: string | undefined, extra: { session?: RegistrySession; publicKey?: string }): Promise<unknown> {
    const timestamp = now();
    const nonce = newNonce();
    const signature = signRegistryRequest({ chainId: args.chainId, account: args.account, action, timestamp, nonce, subject, session: extra.session, ownerPrivateKey: args.ownerPrivateKey });
    const response = await send(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account: args.account, timestamp, nonce, signature, ...extra }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: unknown };
    if (!response.ok) throw new Error(`registry: ${typeof body?.error === 'string' ? body.error : response.status}`);
    return body;
  }

  return {
    async put(session) {
      if (session.limits.length > REGISTRY_MAX_LIMITS) throw new Error(`registry: more than ${REGISTRY_MAX_LIMITS} spending limits`);
      const body: RegistrySession = {
        publicKey: session.publicKey,
        origin: session.origin,
        ...(session.appName ? { appName: session.appName } : {}),
        validUntil: session.validUntil,
        maxCalls: session.maxCalls,
        maxFeePerTx: session.maxFeePerTx,
        calls: session.calls.map((call) => ({ to: call.to, entrypoint: call.entrypoint })),
        limits: session.limits.map((limit) => ({ token: limit.token, maxPerCall: limit.maxPerCall, maxPerWindow: limit.maxPerWindow, windowSeconds: limit.windowSeconds })),
      };
      await post('', 'put', session.publicKey, { session: body });
    },
    async list() {
      return parseRegistryList(await post('/list', 'list', undefined, {}));
    },
    async remove(sessionPublicKey) {
      await post('/remove', 'remove', sessionPublicKey, { publicKey: sessionPublicKey });
    },
  };
}
