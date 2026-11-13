// Session keys (SNIP-41) and their spending policies (Part H).
// See contracts/src/session/component.cairo and spending.cairo.
import { hash, type BigNumberish, type Call } from 'starknet';
import { BLOCKED_ENTRYPOINTS, MAX_SESSION_SCOPE_ENTRIES, SPENDING_ENTRYPOINTS } from './constants';
import { sameFelt, signHash, toHex, u256Calldata } from './utils';

/** What a session may call. */
export type SessionScope =
  /** Anything that is not blocked. Avoid: the session can then call any contract. */
  | { kind: 'any' }
  /** These entry points, on any contract (plain SNIP-41). */
  | { kind: 'entrypoints'; entrypoints: string[] }
  /** These entry points on these contracts only (Kamui extension). Prefer this. */
  | { kind: 'contracts'; calls: ScopedCall[] };

export type ScopedCall = { to: string; entrypoint: string };

export type SessionParams = {
  sessionPublicKey: string;
  /** Unix seconds. The session stops validating after this. */
  validUntil: number;
  /** Maximum number of transactions, counted separately on the self-paid and sponsored paths. */
  maxCalls: number;
  /** Fee cap per self-paid transaction, in fri. 0 makes the session sponsored-only. */
  maxFeePerTx: BigNumberish;
  scope: SessionScope;
};

/** A spending policy for one token (SNIP-41 Part H). */
export type SpendingLimit = {
  token: string;
  maxPerCall: BigNumberish;
  maxPerWindow: BigNumberish;
  windowSeconds: number;
};

const isBlocked = (entrypoint: string) => (BLOCKED_ENTRYPOINTS as readonly string[]).includes(entrypoint);
const isSpending = (entrypoint: string) => (SPENDING_ENTRYPOINTS as readonly string[]).includes(entrypoint);

/**
 * Checks a session before it is sent on chain. Throws with a readable reason. The contracts
 * enforce the same rules at validation time, where a mistake only shows up as a refusal.
 */
export function assertValidSession(account: string, params: SessionParams, now = Math.floor(Date.now() / 1000)): void {
  if (BigInt(params.sessionPublicKey) === 0n) throw new Error('session: the public key is zero');
  if (params.validUntil <= now) throw new Error('session: validUntil is in the past');
  if (!Number.isInteger(params.maxCalls) || params.maxCalls <= 0) throw new Error('session: maxCalls must be a positive integer');
  if (BigInt(params.maxFeePerTx) < 0n) throw new Error('session: maxFeePerTx is negative');

  const entries =
    params.scope.kind === 'entrypoints'
      ? params.scope.entrypoints.map((entrypoint) => ({ to: undefined as string | undefined, entrypoint }))
      : params.scope.kind === 'contracts'
        ? params.scope.calls
        : [];
  if (params.scope.kind !== 'any' && entries.length === 0) throw new Error('session: the scope is empty');
  if (entries.length > MAX_SESSION_SCOPE_ENTRIES) throw new Error(`session: more than ${MAX_SESSION_SCOPE_ENTRIES} scope entries`);
  for (const entry of entries) {
    if (isBlocked(entry.entrypoint)) throw new Error(`session: '${entry.entrypoint}' can never be called by a session`);
    if (entry.to !== undefined && sameFelt(entry.to, account)) throw new Error('session: a session can never call the account itself');
  }
}

/**
 * Token calls in the scope that no spending policy covers. Under SNIP-41 a token without a
 * policy is unrestricted for the session, so each entry returned here lets the session move
 * any amount. `to: '*'` means "on any contract".
 */
export function unlimitedTokenCalls(scope: SessionScope, limits: SpendingLimit[] = []): ScopedCall[] {
  if (scope.kind === 'any') return [{ to: '*', entrypoint: '*' }];
  if (scope.kind === 'entrypoints') {
    return scope.entrypoints.filter(isSpending).map((entrypoint) => ({ to: '*', entrypoint }));
  }
  return scope.calls.filter(
    (call) => isSpending(call.entrypoint) && !limits.some((limit) => sameFelt(limit.token, call.to)),
  );
}

/** The call that registers or replaces a session. Must be sent by the account (an owner). */
export function addSessionCall(account: string, params: SessionParams): Call {
  const head = [
    params.sessionPublicKey,
    toHex(params.validUntil),
    toHex(params.maxCalls),
    toHex(params.maxFeePerTx),
  ];
  if (params.scope.kind === 'contracts') {
    return {
      contractAddress: account,
      entrypoint: 'add_or_update_scoped_session_key',
      calldata: [
        ...head,
        toHex(params.scope.calls.length),
        ...params.scope.calls.flatMap((call) => [call.to, hash.getSelectorFromName(call.entrypoint)]),
      ],
    };
  }
  const selectors = params.scope.kind === 'entrypoints' ? params.scope.entrypoints.map((e) => hash.getSelectorFromName(e)) : [];
  return {
    contractAddress: account,
    entrypoint: 'add_or_update_session_key',
    calldata: [...head, toHex(selectors.length), ...selectors],
  };
}

export function setSpendingPolicyCall(account: string, sessionPublicKey: string, limit: SpendingLimit): Call {
  if (BigInt(limit.maxPerWindow) === 0n) throw new Error('spending: maxPerWindow must be above zero');
  return {
    contractAddress: account,
    entrypoint: 'set_spending_policy',
    calldata: [
      sessionPublicKey,
      limit.token,
      ...u256Calldata(limit.maxPerCall),
      ...u256Calldata(limit.maxPerWindow),
      toHex(limit.windowSeconds),
    ],
  };
}

export function removeSpendingPolicyCall(account: string, sessionPublicKey: string, token: string): Call {
  return { contractAddress: account, entrypoint: 'remove_spending_policy', calldata: [sessionPublicKey, token] };
}

export function revokeSessionCall(account: string, sessionPublicKey: string): Call {
  return { contractAddress: account, entrypoint: 'revoke_session_key', calldata: [sessionPublicKey] };
}

/** Revokes every session in one write. */
export function revokeAllSessionsCall(account: string): Call {
  return { contractAddress: account, entrypoint: 'revoke_all_sessions', calldata: [] };
}

export type CreateSessionOptions = {
  /**
   * Allow token calls that no spending policy covers. Off by default: the SDK then refuses a
   * session that could move unlimited amounts of a token.
   */
  allowUnlimitedSpending?: boolean;
};

/**
 * The calls an owner sends to approve a session: the session itself, then one spending policy
 * per limit. Send them in one transaction so the session never exists without its limits.
 */
export function createSessionCalls(
  account: string,
  params: SessionParams,
  limits: SpendingLimit[] = [],
  options: CreateSessionOptions = {},
): Call[] {
  assertValidSession(account, params);
  if (!options.allowUnlimitedSpending) {
    const unlimited = unlimitedTokenCalls(params.scope, limits);
    if (unlimited.length > 0) {
      const list = unlimited.map((call) => `${call.entrypoint} on ${call.to}`).join(', ');
      throw new Error(`session: no spending limit for ${list}. Add a limit, or pass allowUnlimitedSpending.`);
    }
  }
  return [
    addSessionCall(account, params),
    ...limits.map((limit) => setSpendingPolicyCall(account, params.sessionPublicKey, limit)),
  ];
}

/** SNIP-41 session signature: `[session_pubkey, r, s, valid_until]`. */
export function sessionSignature(
  messageHash: string,
  session: { privateKey: string; publicKey: string; validUntil: number },
): string[] {
  return [session.publicKey, ...signHash(messageHash, session.privateKey), toHex(session.validUntil)];
}
