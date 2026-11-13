// Read-only view of a Kamui account.
import { hash, uint256, type BigNumberish, type ProviderInterface } from 'starknet';
import { toHex } from './utils';

export type SessionData = {
  validUntil: number;
  maxCalls: number;
  maxFeePerTx: bigint;
  scopeEntries: number;
  /** False when the session does not exist, was revoked, or died with an owner change. */
  exists: boolean;
};

export type SpendingPolicy = {
  maxPerCall: bigint;
  maxPerWindow: bigint;
  windowSeconds: number;
  spentInWindow: bigint;
  windowStart: number;
  /** False when the token has no policy, which means unrestricted. */
  exists: boolean;
};

export class KamuiReader {
  constructor(
    readonly provider: ProviderInterface,
    readonly address: string,
  ) {}

  private call(entrypoint: string, calldata: string[] = []): Promise<string[]> {
    return this.provider.callContract({ contractAddress: this.address, entrypoint, calldata });
  }

  private async felt(entrypoint: string, calldata: string[] = []): Promise<string> {
    return (await this.call(entrypoint, calldata))[0]!;
  }

  async isDeployed(): Promise<boolean> {
    try {
      await this.provider.getClassHashAt(this.address);
      return true;
    } catch (error) {
      // Providers and SDKs can bundle separate starknet.js copies; instanceof would then
      // miss the provider's RpcError. Its typed code check still distinguishes absence from
      // network/auth/rate-limit failures without trusting an error-message substring.
      if (typeof error === 'object' && error !== null && 'isType' in error &&
          typeof error.isType === 'function' && error.isType('CONTRACT_NOT_FOUND')) return false;
      throw error;
    }
  }

  /** Owner keys, oldest first. */
  async owners(): Promise<string[]> {
    const [, ...keys] = await this.call('get_owners');
    return keys;
  }

  async isOwner(publicKey: string): Promise<boolean> {
    return BigInt(await this.felt('is_owner', [publicKey])) === 1n;
  }

  /** Changes whenever the owners change. New-owner signatures and recovery proofs bind to it. */
  ownersAnchor(): Promise<string> {
    return this.felt('get_owners_anchor');
  }

  identity(): Promise<string> {
    return this.felt('identity');
  }

  /** Increases whenever every session is revoked (any owner change, or `revoke_all_sessions`). */
  async sessionEpoch(): Promise<number> {
    return Number(BigInt(await this.felt('get_session_epoch')));
  }

  async session(sessionPublicKey: string): Promise<SessionData> {
    const [validUntil, maxCalls, maxFeePerTx, scopeEntries] = await this.call('get_session_data', [sessionPublicKey]);
    return {
      validUntil: Number(BigInt(validUntil!)),
      maxCalls: Number(BigInt(maxCalls!)),
      maxFeePerTx: BigInt(maxFeePerTx!),
      scopeEntries: Number(BigInt(scopeEntries!)),
      exists: BigInt(validUntil!) !== 0n,
    };
  }

  /** Whether the session may call `entrypoint` on `to`. Does not cover expiry, limits or fees. */
  async isSessionCallAllowed(sessionPublicKey: string, to: string, entrypoint: string): Promise<boolean> {
    const allowed = await this.felt('is_session_call_allowed', [sessionPublicKey, to, hash.getSelectorFromName(entrypoint)]);
    return BigInt(allowed) === 1n;
  }

  /** First SNIP-9 nonce reserved for the session. Sponsored calls use `base .. base + maxCalls - 1`. */
  sessionNonceBase(sessionPublicKey: string): Promise<string> {
    return this.felt('get_session_nonce_base', [sessionPublicKey]);
  }

  /** First account nonce the session can no longer use on the self-paid path; 0 before first use. */
  async sessionNonceLimit(sessionPublicKey: string): Promise<number> {
    return Number(BigInt(await this.felt('get_session_nonce_limit', [sessionPublicKey])));
  }

  async spendingPolicy(sessionPublicKey: string, token: string): Promise<SpendingPolicy> {
    const r = await this.call('get_spending_policy', [sessionPublicKey, token]);
    const u256 = (low: string, high: string) => uint256.uint256ToBN({ low, high });
    const maxPerWindow = u256(r[2]!, r[3]!);
    return {
      maxPerCall: u256(r[0]!, r[1]!),
      maxPerWindow,
      windowSeconds: Number(BigInt(r[4]!)),
      spentInWindow: u256(r[5]!, r[6]!),
      windowStart: Number(BigInt(r[7]!)),
      exists: maxPerWindow !== 0n,
    };
  }

  /** Whether a SNIP-9 nonce is still unused. */
  async isOutsideNonceAvailable(nonce: BigNumberish): Promise<boolean> {
    return BigInt(await this.felt('is_valid_outside_execution_nonce', [toHex(nonce)])) === 1n;
  }

  async supportsInterface(interfaceId: string): Promise<boolean> {
    return BigInt(await this.felt('supports_interface', [interfaceId])) === 1n;
  }
}
