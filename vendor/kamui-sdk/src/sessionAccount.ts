// Self-paid session transactions: a starknet.js Account that signs with a session key.
import { Account, Signer, type AccountOptions, type AllowArray, type Call, type Signature, type UniversalDetails } from 'starknet';
import { sessionSignature } from './sessions';
import { keyPairFromPrivateKey } from './utils';

/** Signs transaction hashes as a session: `[session_pubkey, r, s, valid_until]`. */
export class SessionSigner extends Signer {
  private readonly session: { privateKey: string; publicKey: string; validUntil: number };

  constructor(sessionPrivateKey: string, validUntil: number) {
    super(sessionPrivateKey);
    this.session = { ...keyPairFromPrivateKey(sessionPrivateKey), validUntil };
  }

  protected override async signRaw(msgHash: string): Promise<Signature> {
    return sessionSignature(msgHash, this.session);
  }
}

/**
 * An account driven by a session key.
 *
 * Fee estimation always runs `__validate__` with the real session signature. starknet.js skips
 * it by default; for a session that misses the cost of validating the session and, because
 * `__execute__` then sees no session signature, the spending checks. The estimate comes out too
 * low and the transaction runs out of gas (seen on Sepolia). A skipped validation also hides
 * that a call is outside the session's scope.
 */
export class SessionAccount extends Account {
  override execute(transactions: AllowArray<Call>, details: UniversalDetails = {}) {
    return super.execute(transactions, { ...details, skipValidate: false });
  }

  override estimateInvokeFee(calls: AllowArray<Call>, details: UniversalDetails = {}) {
    return super.estimateInvokeFee(calls, { ...details, skipValidate: false });
  }
}

export function createSessionAccount(args: {
  provider: AccountOptions['provider'];
  address: string;
  sessionPrivateKey: string;
  validUntil: number;
}): SessionAccount {
  return new SessionAccount({
    provider: args.provider,
    address: args.address,
    signer: new SessionSigner(args.sessionPrivateKey, args.validUntil),
  });
}
